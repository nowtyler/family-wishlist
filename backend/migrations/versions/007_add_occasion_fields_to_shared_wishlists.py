"""Add occasion_date and occasion_type to shared wishlists

Revision ID: 007_add_occasion_fields_to_shared_wishlists
Revises: 006_add_household_to_shared_wishlists
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "007_add_occasion_fields_to_shared_wishlists"
down_revision = "006_add_household_to_shared_wishlists"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add occasion_date and occasion_type columns to shared_wishlists table
    with op.batch_alter_table("shared_wishlists", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("occasion_date", sa.String(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("occasion_type", sa.String(), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("shared_wishlists", schema=None) as batch_op:
        batch_op.drop_column("occasion_type")
        batch_op.drop_column("occasion_date")
