"""
PDF text and image extraction using PyMuPDF (fitz).

Returns:
- text_blocks: list of TextBlock(page, text, bbox)
- image_blocks: list of ImageBlock(page, image_bytes, bbox)
"""
from dataclasses import dataclass
from pathlib import Path

import fitz  # PyMuPDF


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


MIN_IMAGE_DIM = 50  # pixels — skip decorative icons / rules


def parse_pdf(file_path: Path) -> tuple[list[TextBlock], list[ImageBlock]]:
    """Extract all text and image blocks from a PDF file (FR-01, FR-04)."""
    doc = fitz.open(str(file_path))
    text_blocks: list[TextBlock] = []
    image_blocks: list[ImageBlock] = []
    seen_xrefs: set[int] = set()

    for page_num in range(len(doc)):
        page = doc[page_num]

        # --- Text blocks ---
        block_dict = page.get_text("dict")
        for block in block_dict["blocks"]:
            if block["type"] != 0:
                continue
            # Reconstruct text from spans, preserving word boundaries
            span_texts = []
            for line in block["lines"]:
                for span in line["spans"]:
                    t = span["text"].strip()
                    if t:
                        span_texts.append(t)
            text = " ".join(span_texts)
            if not text:
                continue
            x0, y0, x1, y1 = block["bbox"]
            text_blocks.append(TextBlock(page=page_num, text=text, bbox=(x0, y0, x1, y1)))

        # --- Image blocks ---
        for img_info in page.get_images(full=True):
            xref = img_info[0]
            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)

            rects = page.get_image_rects(xref)
            if not rects:
                continue
            rect = rects[0]

            # Skip tiny images (icons, decorators, horizontal rules)
            if (rect.x1 - rect.x0) < MIN_IMAGE_DIM or (rect.y1 - rect.y0) < MIN_IMAGE_DIM:
                continue

            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_blocks.append(
                ImageBlock(
                    page=page_num,
                    image_bytes=image_bytes,
                    bbox=(rect.x0, rect.y0, rect.x1, rect.y1),
                )
            )

    doc.close()
    return text_blocks, image_blocks
