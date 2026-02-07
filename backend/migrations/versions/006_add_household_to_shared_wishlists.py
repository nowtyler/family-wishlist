"""Add household_id to shared wishlists

Revision ID: 006_add_household_to_shared_wishlists
Revises: 005_add_shared_wishlists
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "006_add_household_to_shared_wishlists"
down_revision = "005_add_shared_wishlists"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add household_id column to shared_wishlists table using batch mode for SQLite
    with op.batch_alter_table("shared_wishlists", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("household_id", sa.Integer(), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_shared_wishlists_household_id",
            "households",
            ["household_id"],
            ["id"]
        )
        batch_op.create_index("ix_shared_wishlists_household_id", ["household_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("shared_wishlists", schema=None) as batch_op:
        batch_op.drop_index("ix_shared_wishlists_household_id")
        batch_op.drop_constraint("fk_shared_wishlists_household_id", type_="foreignkey")
        batch_op.drop_column("household_id")
