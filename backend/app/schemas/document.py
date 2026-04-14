from datetime import datetime
from pydantic import BaseModel


class ChapterOut(BaseModel):
    id: int
    title: str
    page_start: int
    page_end: int

    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: int
    filename: str
    upload_date: datetime
    ingested: bool
    subject: str | None = None
    file_type: str = "other"
    chapters: list[ChapterOut] = []

    model_config = {"from_attributes": True}


class DocumentUpdate(BaseModel):
    subject: str | None = None
    file_type: str | None = None


class DocumentListOut(BaseModel):
    documents: list[DocumentOut]
