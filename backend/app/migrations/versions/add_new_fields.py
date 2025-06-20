"""Add new fields to family_members table

Revision ID: add_new_fields
Revises: user_auth_fields
Create Date: 2025-01-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_new_fields'
down_revision = 'user_auth_fields'
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to the family_members table
    op.add_column('family_members', sa.Column('password_expires_at', sa.DateTime(), nullable=True))
    op.add_column('family_members', sa.Column('temp_password_hash', sa.String(), nullable=True))
    op.add_column('family_members', sa.Column('force_password_change', sa.Boolean(), nullable=True, default=False))
    
    # Create households table
    op.create_table('households',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create household_members table
    op.create_table('household_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('household_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, default='active'),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
        sa.Column('requested_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['family_members.id'], ondelete='CASCADE')
    )
    
    # Create email_settings table
    op.create_table('email_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('smtp_server', sa.String(length=255), nullable=False),
        sa.Column('smtp_port', sa.Integer(), nullable=False),
        sa.Column('smtp_username', sa.String(length=255), nullable=False),
        sa.Column('smtp_password', sa.String(length=255), nullable=False),
        sa.Column('from_email', sa.String(length=255), nullable=False),
        sa.Column('from_name', sa.String(length=255), nullable=False),
        sa.Column('use_tls', sa.Boolean(), nullable=False, default=True),
        sa.Column('use_ssl', sa.Boolean(), nullable=False, default=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create email_templates table
    op.create_table('email_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('subject', sa.String(length=200), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create email_logs table
    op.create_table('email_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('recipient_email', sa.String(length=255), nullable=False),
        sa.Column('recipient_name', sa.String(length=255), nullable=True),
        sa.Column('subject', sa.String(length=500), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('template_name', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    # Drop the new columns from family_members
    op.drop_column('family_members', 'force_password_change')
    op.drop_column('family_members', 'temp_password_hash')
    op.drop_column('family_members', 'password_expires_at')
    
    # Drop the new tables
    op.drop_table('email_logs')
    op.drop_table('email_templates')
    op.drop_table('email_settings')
    op.drop_table('household_members')
    op.drop_table('households') 