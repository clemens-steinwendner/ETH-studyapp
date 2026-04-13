"""
LLM tutor feedback generation on failed code submissions (FR-16).
"""
from pathlib import Path

from jinja2 import Template

from app.config import settings
from app.llm.client import get_llm_client
from app.llm.streaming import collect_response

_PROMPTS_DIR = Path(__file__).parent.parent.parent.parent / "prompts"


async def generate_feedback(
    question_text: str,
    user_code: str,
    error_output: str,
    language: str,
) -> tuple[str, int, int]:
    """
    Given the exercise question, the user's code, and the sandbox error output,
    call the LLM to produce tutor-style feedback that points out logical or
    syntax errors without giving away the solution.

    Returns (feedback_markdown, input_tokens, output_tokens).
    """
    prompt_path = _PROMPTS_DIR / "grading" / "tutor_feedback.md"
    rendered = Template(prompt_path.read_text()).render(
        question_text=question_text,
        user_code=user_code,
        error_output=error_output,
        language=language,
    )

    # Extract the ## System section as the system message
    import re
    system_match = re.search(r"## System\n(.*?)(?=\n## |\Z)", rendered, re.DOTALL)
    system = system_match.group(1).strip() if system_match else ""

    client = get_llm_client()
    feedback, in_tok, out_tok = await collect_response(
        client,
        model=settings.fireworks_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": rendered},
        ],
    )
    return feedback.strip(), in_tok, out_tok
