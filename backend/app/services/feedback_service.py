"""
LLM tutor feedback generation on failed code submissions (FR-16).
"""


async def generate_feedback(user_code: str, error_output: str, language: str) -> str:
    """
    Given the user's code and the sandbox error output, call the LLM to produce
    tutor-style feedback that points out logical or syntax errors.

    Returns a markdown-formatted feedback string.
    """
    # TODO: load prompts/grading/tutor_feedback.md, call llm.client
    raise NotImplementedError
