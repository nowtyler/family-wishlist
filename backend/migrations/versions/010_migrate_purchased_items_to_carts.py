"""Migrate legacy purchased items into shopping carts

Items that were marked as purchased (is_purchased=True, purchased_by=<name>)
before the shopping cart feature existed need corresponding ShoppingCartItem
entries so the cart correctly reflects all purchases.

Revision ID: 010_migrate_purchased_items_to_carts
Revises: 009_replace_first_login_with_tutorial_status
Create Date: 2026-03-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# revision identifiers, used by Alembic.
revision = "010_migrate_purchased_items_to_carts"
down_revision = "009_replace_first_login_with_tutorial_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    migrated_regular = 0
    migrated_shared = 0
    skipped_regular = []
    skipped_shared = []

    # --- Regular wishlist items ---
    rows = bind.execute(text("""
        SELECT wi.id, wi.title, wi.link, wi.image_url, wi.price, wi.purchased_by, wi.owner_id
        FROM wishlist_items wi
        WHERE wi.is_purchased = 1
          AND wi.purchased_by IS NOT NULL
          AND wi.purchased_by != ''
          AND NOT EXISTS (
              SELECT 1 FROM shopping_cart_items sci
              WHERE sci.wishlist_item_id = wi.id
          )
    """)).fetchall()

    now = datetime.utcnow().isoformat()

    for row in rows:
        item_id, title, link, image_url, price, purchased_by_name, owner_id = row

        buyer = bind.execute(text(
            "SELECT id FROM family_members WHERE name = :name"
        ), {"name": purchased_by_name}).fetchone()

        if not buyer:
            skipped_regular.append(f"'{title}' (purchased_by='{purchased_by_name}' - no matching user)")
            continue

        buyer_id = buyer[0]

        bind.execute(text("""
            INSERT INTO shopping_cart_items
                (buyer_id, recipient_id, wishlist_item_id, title, link, image_url, price, status, purchased_at, created_at)
            VALUES
                (:buyer_id, :recipient_id, :wishlist_item_id, :title, :link, :image_url, :price, 'purchased', :now, :now)
        """), {
            "buyer_id": buyer_id,
            "recipient_id": owner_id,
            "wishlist_item_id": item_id,
            "title": title,
            "link": link,
            "image_url": image_url,
            "price": price,
            "now": now,
        })
        migrated_regular += 1

    # --- Shared wishlist items ---
    shared_rows = bind.execute(text("""
        SELECT swi.id, swi.title, swi.link, swi.image_url, swi.price, swi.purchased_by, sw.name AS wishlist_name
        FROM shared_wishlist_items swi
        JOIN shared_wishlists sw ON sw.id = swi.wishlist_id
        WHERE swi.is_purchased = 1
          AND swi.purchased_by IS NOT NULL
          AND swi.purchased_by != ''
          AND NOT EXISTS (
              SELECT 1 FROM shopping_cart_items sci
              WHERE sci.shared_wishlist_item_id = swi.id
          )
    """)).fetchall()

    for row in shared_rows:
        item_id, title, link, image_url, price, purchased_by_name, wishlist_name = row

        buyer = bind.execute(text(
            "SELECT id FROM family_members WHERE name = :name"
        ), {"name": purchased_by_name}).fetchone()

        if not buyer:
            skipped_shared.append(f"'{title}' in '{wishlist_name}' (purchased_by='{purchased_by_name}' - no matching user)")
            continue

        buyer_id = buyer[0]

        bind.execute(text("""
            INSERT INTO shopping_cart_items
                (buyer_id, recipient_name, shared_wishlist_item_id, title, link, image_url, price, status, purchased_at, created_at)
            VALUES
                (:buyer_id, :recipient_name, :shared_wishlist_item_id, :title, :link, :image_url, :price, 'purchased', :now, :now)
        """), {
            "buyer_id": buyer_id,
            "recipient_name": wishlist_name,
            "shared_wishlist_item_id": item_id,
            "title": title,
            "link": link,
            "image_url": image_url,
            "price": price,
            "now": now,
        })
        migrated_shared += 1

    # --- Summary ---
    logger.info("=== Migration 010: Purchased Items -> Shopping Carts ===")
    logger.info(f"Regular wishlist items migrated: {migrated_regular}")
    logger.info(f"Shared wishlist items migrated: {migrated_shared}")
    logger.info(f"Total migrated: {migrated_regular + migrated_shared}")

    if skipped_regular:
        logger.warning(f"Skipped {len(skipped_regular)} regular item(s) (buyer not found):")
        for s in skipped_regular:
            logger.warning(f"  - {s}")

    if skipped_shared:
        logger.warning(f"Skipped {len(skipped_shared)} shared item(s) (buyer not found):")
        for s in skipped_shared:
            logger.warning(f"  - {s}")

    if not skipped_regular and not skipped_shared:
        logger.info("No items skipped - all purchased items migrated successfully.")


def downgrade() -> None:
    bind = op.get_bind()

    # Remove cart items that were created by this migration.
    # These are cart items linked to wishlist items that are still marked purchased
    # and where the cart item status is 'purchased'.
    bind.execute(text("""
        DELETE FROM shopping_cart_items
        WHERE status = 'purchased'
          AND wishlist_item_id IS NOT NULL
          AND wishlist_item_id IN (
              SELECT id FROM wishlist_items WHERE is_purchased = 1
          )
    """))

    bind.execute(text("""
        DELETE FROM shopping_cart_items
        WHERE status = 'purchased'
          AND shared_wishlist_item_id IS NOT NULL
          AND shared_wishlist_item_id IN (
              SELECT id FROM shared_wishlist_items WHERE is_purchased = 1
          )
    """))
