"""
LaTeX detection and normalisation (FR-03).

Identifies inline ($...$) and display ($$...$$) math in text blocks
and ensures they are retained as valid LaTeX strings.
"""
import re

# Display must be compiled before inline to avoid $$ being matched as two $
DISPLAY_MATH = re.compile(r"\$\$.+?\$\$", re.DOTALL)
INLINE_MATH = re.compile(r"\$(?!\$).+?(?<!\$)\$", re.DOTALL)


def preserve_latex(text: str) -> str:
    """Return text with LaTeX math regions protected from prose cleanup."""
    placeholders: dict[str, str] = {}

    def stash(match: re.Match) -> str:  # type: ignore[type-arg]
        key = f"\x00MATH{len(placeholders)}\x00"
        placeholders[key] = match.group(0)
        return key

    # Apply display before inline — prevents $$ from matching as two $
    processed = DISPLAY_MATH.sub(stash, text)
    processed = INLINE_MATH.sub(stash, processed)

    # Clean prose: fix PDF hyphenated line-breaks, collapse whitespace
    processed = re.sub(r"-\n", "", processed)       # "algo-\nrithm" → "algorithm"
    processed = re.sub(r"\n", " ", processed)        # remaining newlines → space
    processed = re.sub(r" {2,}", " ", processed)     # multiple spaces → one

    # Restore math verbatim
    for key, original in placeholders.items():
        processed = processed.replace(key, original)

    return processed.strip()
