"""add system config table

Revision ID: add_system_config
Revises: add_new_fields
Create Date: 2024-03-21 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_system_config'
down_revision = 'add_new_fields'
branch_labels = None
depends_on = None


def upgrade():
    # Create system_config table
    op.create_table(
        'system_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(), nullable=True),
        sa.Column('value', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_system_config_id'), 'system_config', ['id'], unique=False)
    op.create_index(op.f('ix_system_config_key'), 'system_config', ['key'], unique=True)


def downgrade():
    op.drop_index(op.f('ix_system_config_key'), table_name='system_config')
    op.drop_index(op.f('ix_system_config_id'), table_name='system_config')
    op.drop_table('system_config') 