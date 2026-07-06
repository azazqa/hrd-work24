"""add owned_courses table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-06 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "owned_courses",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("dev_year", sa.Integer(), nullable=True),
        sa.Column("dev_round", sa.Integer(), nullable=True),
        sa.Column("review_round", sa.String(length=50), nullable=True),
        sa.Column("division", sa.String(length=100), nullable=True),
        sa.Column("ncs_dev_category", sa.String(length=100), nullable=True),
        sa.Column("course_name", sa.String(length=500), nullable=False),
        sa.Column("session_count", sa.Integer(), nullable=True),
        sa.Column("eval_training_volume", sa.String(length=100), nullable=True),
        sa.Column("result", sa.String(length=100), nullable=True),
        sa.Column("grade_initial", sa.String(length=50), nullable=True),
        sa.Column("grade_23", sa.String(length=50), nullable=True),
        sa.Column("ncs_applied", sa.String(length=100), nullable=True),
        sa.Column("ncs_approved", sa.String(length=100), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
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
        op.f("ix_owned_courses_dev_year"),
        "owned_courses",
        ["dev_year"],
    )
    op.create_index(
        op.f("ix_owned_courses_division"),
        "owned_courses",
        ["division"],
    )
    op.create_index(
        op.f("ix_owned_courses_course_name"),
        "owned_courses",
        ["course_name"],
    )
    op.create_index(
        op.f("ix_owned_courses_is_active"),
        "owned_courses",
        ["is_active"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_owned_courses_is_active"), table_name="owned_courses")
    op.drop_index(op.f("ix_owned_courses_course_name"), table_name="owned_courses")
    op.drop_index(op.f("ix_owned_courses_division"), table_name="owned_courses")
    op.drop_index(op.f("ix_owned_courses_dev_year"), table_name="owned_courses")
    op.drop_table("owned_courses")
