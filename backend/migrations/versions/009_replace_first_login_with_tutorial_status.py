"""Replace first_login boolean with tutorial_status enum

Revision ID: 009_replace_first_login_with_tutorial_status
Revises: 008_add_shared_wishlist_support_to_cart_and_comments
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

# revision identifiers, used by Alembic.
revision = "009_replace_first_login_with_tutorial_status"
down_revision = "008_add_shared_wishlist_support_to_cart_and_comments"
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Add tutorial_status column to family_members
    if not column_exists("family_members", "tutorial_status"):
        op.add_column(
            "family_members",
            sa.Column("tutorial_status", sa.String(length=20), nullable=True, default="new")
        )

        # Migrate existing data from first_login to tutorial_status
        # If first_login is True, set tutorial_status to "new"
        # If first_login is False, set tutorial_status to "completed"
        bind = op.get_bind()
        if bind.dialect.name == 'sqlite':
            # SQLite syntax
            bind.execute(text("""
                UPDATE family_members
                SET tutorial_status = CASE
                    WHEN first_login = 1 THEN 'new'
                    ELSE 'completed'
                END
            """))
        else:
            # PostgreSQL/MySQL syntax
            bind.execute(text("""
                UPDATE family_members
                SET tutorial_status = CASE
                    WHEN first_login = true THEN 'new'
                    ELSE 'completed'
                END
            """))


def downgrade() -> None:
    # Remove tutorial_status column
    if column_exists("family_members", "tutorial_status"):
        op.drop_column("family_members", "tutorial_status")
