"""owned_courses dev_round integer to varchar(50)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-07 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "owned_courses",
        "dev_round",
        existing_type=sa.Integer(),
        type_=sa.String(length=50),
        existing_nullable=True,
        postgresql_using="dev_round::text",
    )


def downgrade() -> None:
    op.alter_column(
        "owned_courses",
        "dev_round",
        existing_type=sa.String(length=50),
        type_=sa.Integer(),
        existing_nullable=True,
        postgresql_using="NULLIF(dev_round, '')::integer",
    )
