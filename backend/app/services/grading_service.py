"""
Exercise grading (FR-15, FR-17).

- Code submissions: deterministic — reads sandbox exit code only, no LLM (FR-15)
- Multiple-choice: deterministic — compares selected index to stored correct_index
- Open-ended + text: LLM evaluation using the proof-grading prompt
- Open-ended + image (handwritten proof): Vision LLM evaluation (FR-17)
"""
import json
from pathlib import Path

from fastapi import HTTPException
from jinja2 import Template
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.repositories.exercise_repo import ExerciseRepository
from app.db.repositories.session_repo import SessionRepository
from app.services.settings_service import get_active_model
from app.llm.client import get_llm_client
from app.llm.parsing import extract_json
from app.llm.streaming import collect_response
from app.llm import vision
from app.schemas.execution import ExecutionRequest
from app.schemas.exercise import SubmissionRequest, SubmissionOut
from app.services.budget_service import BudgetService
from app.services.feedback_service import generate_feedback
from app.services.sandbox_service import run_in_sandbox

_PROMPTS_DIR = Path(__file__).parent.parent.parent.parent / "prompts"


def _parse_grading_result(fb_text: str) -> tuple[bool, str]:
    """Parse structured grading JSON from LLM response.

    Expects: {"status": "PASS"|"FAIL", "feedback": "..."}
    Falls back to legacy PASS substring match if JSON extraction fails.
    """
    gr = extract_json(fb_text)
    if gr and "status" in gr:
        passed = gr["status"].upper() == "PASS"
        feedback = gr.get("feedback") or fb_text.strip()
        return passed, feedback
    # Fallback: legacy substring match (handles malformed responses)
    passed = "PASS" in fb_text.upper()
    return passed, fb_text.strip()


async def grade_submission(
    db: AsyncSession, exercise_id: int, body: SubmissionRequest
) -> SubmissionOut:
    """
    Grade a user submission, routing to the appropriate grader based on
    question type and answer modality.

    - coding       → deterministic sandbox (FR-15) + LLM feedback on failure (FR-16)
    - multiple_choice → deterministic index comparison
    - open_ended + image → Vision LLM proof grading (FR-17)
    - open_ended + text  → LLM text evaluation
    """
    ex_repo = ExerciseRepository(db)
    exercise = await ex_repo.get_by_id(exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    session = await SessionRepository(db).get_by_id(exercise.session_id)
    budget_svc = BudgetService(db)
    model = await get_active_model(db)
    passed = False
    feedback: str | None = None

    # ── Coding: deterministic sandbox grading ────────────────────────────────
    if exercise.question_type == "coding":
        exec_result = await run_in_sandbox(ExecutionRequest(
            exercise_id=exercise_id,
            language=exercise.language or "python",
            user_code=body.answer_text or "",
            test_cases=exercise.test_cases or "",
        ))
        passed = exec_result.passed

        if not passed:
            # Generate LLM tutor feedback for failed submissions (FR-16)
            feedback, in_tok, out_tok = await generate_feedback(
                question_text=exercise.question_text,
                user_code=body.answer_text or "",
                error_output=exec_result.stderr or exec_result.stdout,
                language=exercise.language or "python",
                model=model,
            )
            await budget_svc.record_usage(model, in_tok, out_tok)

    # ── Multiple choice: deterministic index comparison ───────────────────────
    elif exercise.question_type == "multiple_choice":
        try:
            mc_meta = json.loads(exercise.test_cases or "{}")
            correct_index = int(mc_meta.get("correct_index", -1))
            selected_index = int(body.answer_text or "-1")
            passed = selected_index == correct_index
            if not passed:
                feedback = mc_meta.get("explanation") or "Incorrect selection."
        except (ValueError, json.JSONDecodeError):
            passed = False
            feedback = "Could not parse answer."

    # ── True/False: deterministic bool comparison ─────────────────────────────
    elif exercise.question_type == "true_false":
        try:
            tf_meta = json.loads(exercise.test_cases or "{}")
            correct_answer: bool = bool(tf_meta.get("correct_answer", False))
            # Frontend sends "0" (True) or "1" (False) using the same index convention as MC
            selected_index = int(body.answer_text or "-1")
            user_answer = selected_index == 0  # index 0 = True, index 1 = False
            passed = user_answer == correct_answer
            if not passed:
                feedback = tf_meta.get("explanation") or "Incorrect."
        except (ValueError, json.JSONDecodeError):
            passed = False
            feedback = "Could not parse answer."

    # ── Multiple select: exact set match ──────────────────────────────────────
    elif exercise.question_type == "multiple_select":
        try:
            ms_meta = json.loads(exercise.test_cases or "{}")
            correct_set = set(ms_meta.get("correct_indices", []))
            selected_set = set(json.loads(body.answer_text or "[]"))
            passed = selected_set == correct_set
            if not passed:
                feedback = ms_meta.get("explanation") or "Incorrect selection."
        except (ValueError, json.JSONDecodeError):
            passed = False
            feedback = "Could not parse answer."

    # ── Open-ended: vision or text grading ───────────────────────────────────
    elif exercise.question_type == "open_ended":
        prompt_path = _PROMPTS_DIR / "grading" / "vision_proof_grading.md"

        if body.answer_image_path:
            # Vision-based proof grading (FR-17): LLM sees the image
            image_bytes = Path(body.answer_image_path).read_bytes()
            fb_text, in_tok, out_tok = await vision.grade_proof(
                image_bytes, exercise.question_text, prompt_path
            )
            await budget_svc.record_usage(settings.fireworks_vision_model, in_tok, out_tok)
        else:
            # Text answer: LLM evaluation via proof-grading prompt
            rendered = Template(prompt_path.read_text()).render(
                question_text=exercise.question_text,
            )
            client = get_llm_client()
            student_answer = body.answer_text or "(no answer provided)"
            fb_text, in_tok, out_tok = await collect_response(
                client,
                model=model,
                messages=[{
                    "role": "user",
                    "content": rendered + f"\n\nStudent answer:\n{student_answer}",
                }],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "grading_result",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "status": {"type": "string", "enum": ["PASS", "FAIL"]},
                                "feedback": {"type": "string"},
                            },
                            "required": ["status", "feedback"],
                            "additionalProperties": False,
                        },
                    },
                },
            )
            await budget_svc.record_usage(model, in_tok, out_tok)

        passed, feedback = _parse_grading_result(fb_text)

    # ── Persist submission ────────────────────────────────────────────────────
    submission = await ex_repo.add_submission(
        exercise_id=exercise_id,
        answer_text=body.answer_text,
        answer_image_path=body.answer_image_path,
        passed=passed,
        disputed=False,
        feedback=feedback,
    )
    return SubmissionOut.model_validate(submission)
