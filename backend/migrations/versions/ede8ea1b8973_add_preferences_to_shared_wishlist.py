"""Add preferences to shared_wishlist

Revision ID: ede8ea1b8973
Revises: 011_add_shared_wishlist_external_wishlists
Create Date: 2026-10-04 12:47:04.964297

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ede8ea1b8973'
down_revision = '011_add_shared_wishlist_external_wishlists'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('shared_wishlists', schema=None) as batch_op:
        batch_op.add_column(sa.Column('preferences', sa.Text(), nullable=True))

def downgrade() -> None:
    with op.batch_alter_table('shared_wishlists', schema=None) as batch_op:
        batch_op.drop_column('preferences')
