"""add course_export_job table and seed course_export scheduler job

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-13 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "course_export_job",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("status", sa.String(length=20), server_default="PENDING", nullable=False),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("conditions_summary", sa.Text(), nullable=True),
        sa.Column("params", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=True),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("queue_id", sa.BigInteger(), nullable=True),
        sa.Column("requested_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "is_delete",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_course_export_job_requested_by_user_id"),
        "course_export_job",
        ["requested_by_user_id"],
    )
    op.create_index(
        "ix_course_export_job_status_created",
        "course_export_job",
        ["status", "created_at"],
    )

    op.execute(
        sa.text(
            """
            INSERT INTO scheduler_jobs (
                job_key, title, enabled, cron_hour, cron_minute, timezone, description
            ) VALUES (
                'course_export',
                '과정 내보내기',
                false,
                3,
                0,
                'Asia/Seoul',
                '과정 검색 결과를 비동기로 Excel 파일 생성'
            )
            ON CONFLICT (job_key) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM scheduler_jobs WHERE job_key = 'course_export'"))
    op.drop_index(
        "ix_course_export_job_status_created", table_name="course_export_job"
    )
    op.drop_index(
        op.f("ix_course_export_job_requested_by_user_id"),
        table_name="course_export_job",
    )
    op.drop_table("course_export_job")
