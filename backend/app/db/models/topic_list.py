from datetime import datetime
from sqlalchemy import String, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SubjectTopicList(Base):
    """Persistent topic outline generated from script documents for a subject."""

    __tablename__ = "subject_topic_lists"

    id: Mapped[int] = mapped_column(primary_key=True)
    subject: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    topics_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON: [{title, subtopics}]
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    source_doc_ids: Mapped[str] = mapped_column(Text, nullable=False)  # JSON: [int, ...]
