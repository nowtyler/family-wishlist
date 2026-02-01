"""Add shared wishlists tables

Revision ID: 005_add_shared_wishlists
Revises: 004_add_recipient_name_to_shopping_cart
Create Date: 2026-02-01

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "005_add_shared_wishlists"
down_revision = "004_add_recipient_name_to_shopping_cart"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create shared_wishlists table
    op.create_table(
        "shared_wishlists",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("family_members.id"), nullable=False),
    )
    op.create_index("ix_shared_wishlists_id", "shared_wishlists", ["id"], unique=False)
    op.create_index("ix_shared_wishlists_created_by", "shared_wishlists", ["created_by"], unique=False)

    # Create shared_wishlist_owners join table
    op.create_table(
        "shared_wishlist_owners",
        sa.Column("wishlist_id", sa.Integer(), sa.ForeignKey("shared_wishlists.id", ondelete="CASCADE"), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("family_members.id", ondelete="CASCADE"), primary_key=True, nullable=False),
        sa.Column("added_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("added_by", sa.Integer(), sa.ForeignKey("family_members.id"), nullable=True),
    )
    op.create_index("ix_shared_wishlist_owners_wishlist_id", "shared_wishlist_owners", ["wishlist_id"], unique=False)
    op.create_index("ix_shared_wishlist_owners_user_id", "shared_wishlist_owners", ["user_id"], unique=False)

    # Create shared_wishlist_items table
    op.create_table(
        "shared_wishlist_items",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("wishlist_id", sa.Integer(), sa.ForeignKey("shared_wishlists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("link", sa.String(length=2000), nullable=True),
        sa.Column("image_url", sa.String(length=2000), nullable=True),
        sa.Column("priority", sa.Integer(), default=0),
        sa.Column("price", sa.Integer(), nullable=True),
        sa.Column("is_purchased", sa.Boolean(), default=False),
        sa.Column("purchased_by", sa.String(length=100), nullable=True),
        sa.Column("thinking_about_by", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("family_members.id"), nullable=True),
    )
    op.create_index("ix_shared_wishlist_items_id", "shared_wishlist_items", ["id"], unique=False)
    op.create_index("ix_shared_wishlist_items_wishlist_id", "shared_wishlist_items", ["wishlist_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_shared_wishlist_items_wishlist_id", table_name="shared_wishlist_items")
    op.drop_index("ix_shared_wishlist_items_id", table_name="shared_wishlist_items")
    op.drop_table("shared_wishlist_items")

    op.drop_index("ix_shared_wishlist_owners_user_id", table_name="shared_wishlist_owners")
    op.drop_index("ix_shared_wishlist_owners_wishlist_id", table_name="shared_wishlist_owners")
    op.drop_table("shared_wishlist_owners")

    op.drop_index("ix_shared_wishlists_created_by", table_name="shared_wishlists")
    op.drop_index("ix_shared_wishlists_id", table_name="shared_wishlists")
    op.drop_table("shared_wishlists")
