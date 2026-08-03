"""add settlements table

Revision ID: g7a8b9c0d1e2
Revises: f6a7b8c9d0e1
Create Date: 2026-07-31 19:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g7a8b9c0d1e2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "settlements",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("purchase_ym", sa.String(length=6), nullable=False),
        sa.Column("purchase_year", sa.Integer(), nullable=False),
        sa.Column("sales_ym", sa.String(length=6), nullable=True),
        sa.Column("client_name", sa.String(length=255), nullable=False),
        sa.Column("course_name", sa.String(length=500), nullable=False),
        sa.Column("education_period", sa.String(length=100), nullable=True),
        sa.Column("headcount", sa.Integer(), nullable=True),
        sa.Column("base_tuition", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("textbook_fee", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("exclude_amount", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("share_rate", sa.Numeric(precision=10, scale=6), nullable=True),
        sa.Column("net_sales", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("settlement_rate", sa.Numeric(precision=10, scale=6), nullable=True),
        sa.Column("settlement_amount", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("sales_rep", sa.String(length=100), nullable=True),
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
        op.f("ix_settlements_purchase_year"), "settlements", ["purchase_year"], unique=False
    )
    op.create_index(
        op.f("ix_settlements_client_name"), "settlements", ["client_name"], unique=False
    )
    op.create_index(
        op.f("ix_settlements_course_name"), "settlements", ["course_name"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_settlements_course_name"), table_name="settlements")
    op.drop_index(op.f("ix_settlements_client_name"), table_name="settlements")
    op.drop_index(op.f("ix_settlements_purchase_year"), table_name="settlements")
    op.drop_table("settlements")
