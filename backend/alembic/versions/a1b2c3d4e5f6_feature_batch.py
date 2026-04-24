"""feature batch: synthesis flag, exercise sources, exam profile depth

Revision ID: a1b2c3d4e5f6
Revises: db69bb333459
Create Date: 2026-04-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "db69bb333459"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "study_sessions",
        sa.Column("synthesis_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("exercises", sa.Column("sources", sa.JSON(), nullable=True))
    op.add_column("exam_profiles", sa.Column("topic_frequency", sa.Text(), nullable=True))
    op.add_column("exam_profiles", sa.Column("difficulty_mix", sa.Text(), nullable=True))
    op.add_column("exam_profiles", sa.Column("common_traps", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("exam_profiles", "common_traps")
    op.drop_column("exam_profiles", "difficulty_mix")
    op.drop_column("exam_profiles", "topic_frequency")
    op.drop_column("exercises", "sources")
    op.drop_column("study_sessions", "synthesis_enabled")
