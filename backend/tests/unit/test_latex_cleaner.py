from app.services.ingestion.latex_cleaner import preserve_latex


def test_passthrough_no_math() -> None:
    text = "Hello world, this has no math."
    assert preserve_latex(text) == text


def test_inline_math_preserved() -> None:
    text = "The formula $E = mc^2$ is famous."
    result = preserve_latex(text)
    assert "$E = mc^2$" in result
