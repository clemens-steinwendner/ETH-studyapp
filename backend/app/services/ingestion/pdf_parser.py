"""
PDF text and image extraction using PyMuPDF (fitz).

Returns:
- text_blocks: list of {page, text, bbox}
- image_blocks: list of {page, image_bytes, bbox}
"""
from dataclasses import dataclass
from pathlib import Path


@dataclass
class TextBlock:
    page: int
    text: str
    bbox: tuple[float, float, float, float]


@dataclass
class ImageBlock:
    page: int
    image_bytes: bytes
    bbox: tuple[float, float, float, float]


def parse_pdf(file_path: Path) -> tuple[list[TextBlock], list[ImageBlock]]:
    """Extract all text and image blocks from a PDF file (FR-01, FR-04)."""
    # TODO: implement with fitz.open(file_path)
    raise NotImplementedError
