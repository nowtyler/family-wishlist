"""Add user authentication fields

Revision ID: user_auth_fields
Revises: 
Create Date: 2025-06-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'user_auth_fields'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to the family_members table
    op.add_column('family_members', sa.Column('username', sa.String(), nullable=True))
    op.add_column('family_members', sa.Column('password_hash', sa.String(), nullable=True))
    op.add_column('family_members', sa.Column('email', sa.String(), nullable=True))
    op.add_column('family_members', sa.Column('reset_token', sa.String(), nullable=True))
    op.add_column('family_members', sa.Column('reset_token_expires', sa.DateTime(), nullable=True))
    
    # Create unique index for username
    op.create_index(op.f('ix_family_members_username'), 'family_members', ['username'], unique=True)


def downgrade():
    # Drop the columns if needed
    op.drop_index(op.f('ix_family_members_username'), table_name='family_members')
    op.drop_column('family_members', 'reset_token_expires')
    op.drop_column('family_members', 'reset_token')
    op.drop_column('family_members', 'email')
    op.drop_column('family_members', 'password_hash')
    op.drop_column('family_members', 'username')
