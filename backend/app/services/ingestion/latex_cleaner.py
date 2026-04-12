"""
LaTeX detection and normalisation (FR-03).

Identifies inline ($...$) and display ($$...$$) math in text blocks
and ensures they are retained as valid LaTeX strings.
"""
import re

INLINE_MATH = re.compile(r"\$(?!\$).+?(?<!\$)\$", re.DOTALL)
DISPLAY_MATH = re.compile(r"\$\$.+?\$\$", re.DOTALL)


def preserve_latex(text: str) -> str:
    """Return text with LaTeX math regions left intact and normalised."""
    # TODO: implement — strip artefacts around math regions, fix common OCR errors
    return text
