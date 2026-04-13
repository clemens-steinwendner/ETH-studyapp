from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    upload_date: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    ingested: Mapped[bool] = mapped_column(default=False)
    subject: Mapped[str | None] = mapped_column(String(64), nullable=True)
    file_type: Mapped[str] = mapped_column(String(32), default="other")

    chapters: Mapped[list["Chapter"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class Chapter(Base):
    __tablename__ = "chapters"

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"))
    title: Mapped[str] = mapped_column(String(512))
    page_start: Mapped[int] = mapped_column(default=0)
    page_end: Mapped[int] = mapped_column(default=0)

    document: Mapped["Document"] = relationship(back_populates="chapters")
