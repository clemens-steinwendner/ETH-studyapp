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
    # In exam mode, defer expensive LLM feedback (coding tutor notes, open-ended
    # grading) until the user hits /finalize. Deterministic checks still run so
    # we can compute pass/fail totals for the review screen.
    exam_mode = bool(session and session.exam_mode)

    # ── Coding: deterministic sandbox grading ────────────────────────────────
    if exercise.question_type == "coding":
        exec_result = await run_in_sandbox(ExecutionRequest(
            exercise_id=exercise_id,
            language=exercise.language or "python",
            user_code=body.answer_text or "",
            test_cases=exercise.test_cases or "",
        ))
        passed = exec_result.passed

        if not passed and not exam_mode:
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
        # Exam mode: skip LLM grading entirely. The submission is stored (answer
        # preserved) and finalized later via POST /sessions/{id}/finalize.
        if exam_mode:
            submission = await ex_repo.add_submission(
                exercise_id=exercise_id,
                answer_text=body.answer_text,
                answer_image_path=body.answer_image_path,
                passed=False,
                disputed=False,
                feedback=None,
            )
            return SubmissionOut.model_validate(submission)

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


async def finalize_exam_session(db: AsyncSession, session_id: int) -> int:
    """Backfill deferred grading for an exam-mode session.

    When a session runs in exam_mode, grade_submission skips the expensive LLM
    paths (coding tutor feedback on failure, open-ended LLM/vision grading) so
    the user isn't slowed down or upsold mid-exam. This function runs those
    steps now, updating the latest submission for each exercise in place.

    Returns the number of submissions that were updated.
    """
    session = await SessionRepository(db).get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.exam_mode:
        return 0

    model = await get_active_model(db)
    budget_svc = BudgetService(db)
    ex_repo = ExerciseRepository(db)
    updated = 0

    for exercise in session.exercises:
        sub = await ex_repo.get_latest_submission(exercise.id)
        if not sub or sub.feedback is not None:
            continue
        passed: bool = sub.passed
        feedback: str | None = None

        if exercise.question_type == "coding" and not sub.passed:
            # Re-run sandbox so we have fresh stderr for the tutor-feedback LLM
            exec_result = await run_in_sandbox(ExecutionRequest(
                exercise_id=exercise.id,
                language=exercise.language or "python",
                user_code=sub.answer_text or "",
                test_cases=exercise.test_cases or "",
            ))
            passed = exec_result.passed
            if not passed:
                feedback, in_tok, out_tok = await generate_feedback(
                    question_text=exercise.question_text,
                    user_code=sub.answer_text or "",
                    error_output=exec_result.stderr or exec_result.stdout,
                    language=exercise.language or "python",
                    model=model,
                )
                await budget_svc.record_usage(model, in_tok, out_tok)

        elif exercise.question_type == "open_ended":
            prompt_path = _PROMPTS_DIR / "grading" / "vision_proof_grading.md"
            if sub.answer_image_path:
                image_bytes = Path(sub.answer_image_path).read_bytes()
                fb_text, in_tok, out_tok = await vision.grade_proof(
                    image_bytes, exercise.question_text, prompt_path
                )
                await budget_svc.record_usage(settings.fireworks_vision_model, in_tok, out_tok)
            else:
                rendered = Template(prompt_path.read_text()).render(
                    question_text=exercise.question_text,
                )
                client = get_llm_client()
                student_answer = sub.answer_text or "(no answer provided)"
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

        else:
            # Deterministic types (MC / TF / MS) — were graded inline, nothing to defer
            continue

        await ex_repo.update_submission_grade(sub.id, passed, feedback)
        updated += 1

    return updated
