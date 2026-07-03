"""add work24_api_log and scheduler queue payload

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-03 18:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "work24_api_log",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("request_headers", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("response_status", sa.Integer(), nullable=True),
        sa.Column("response_headers", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_work24_api_log_requested_at"),
        "work24_api_log",
        ["requested_at"],
    )

    op.add_column(
        "scheduler_job_queue",
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    op.execute(
        sa.text(
            """
            INSERT INTO scheduler_jobs (
                job_key, title, enabled, cron_hour, cron_minute, timezone, description
            ) VALUES (
                'legacy_course_index',
                '과거 과정 색인',
                false,
                3,
                0,
                'Asia/Seoul',
                'Work24 Open API 과거 훈련과정 월별 수집 및 Elasticsearch 색인'
            )
            ON CONFLICT (job_key) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text("DELETE FROM scheduler_jobs WHERE job_key = 'legacy_course_index'")
    )
    op.drop_column("scheduler_job_queue", "payload")
    op.drop_index(op.f("ix_work24_api_log_requested_at"), table_name="work24_api_log")
    op.drop_table("work24_api_log")
