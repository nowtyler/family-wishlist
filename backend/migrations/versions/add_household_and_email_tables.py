"""Add household and email tables

Revision ID: add_household_email_tables
Revises: user_auth_fields
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = 'add_household_email_tables'
down_revision = 'user_auth_fields'
branch_labels = None
depends_on = None

def upgrade():
    # Create households table
    op.create_table('households',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['family_members.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_households_id'), 'households', ['id'], unique=False)

    # Create user_household_association table
    op.create_table('user_household_association',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('household_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
        sa.Column('requested_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['household_id'], ['households.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['family_members.id'], ),
        sa.PrimaryKeyConstraint('user_id', 'household_id')
    )

    # Create email_settings table
    op.create_table('email_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('smtp_server', sa.String(), nullable=False),
        sa.Column('smtp_port', sa.Integer(), nullable=False),
        sa.Column('smtp_username', sa.String(), nullable=False),
        sa.Column('smtp_password', sa.String(), nullable=False),
        sa.Column('from_email', sa.String(), nullable=False),
        sa.Column('from_name', sa.String(), nullable=False),
        sa.Column('use_tls', sa.Boolean(), nullable=True),
        sa.Column('use_ssl', sa.Boolean(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create email_templates table
    op.create_table('email_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Create email_logs table
    op.create_table('email_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('recipient_email', sa.String(), nullable=False),
        sa.Column('recipient_name', sa.String(), nullable=True),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('template_name', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Add new columns to family_members table
    op.add_column('family_members', sa.Column('password_expires_at', sa.DateTime(), nullable=True))
    op.add_column('family_members', sa.Column('temp_password_hash', sa.String(), nullable=True))
    op.add_column('family_members', sa.Column('force_password_change', sa.Boolean(), nullable=True))

    # Insert default email templates
    connection = op.get_bind()
    
    # Password reset template
    connection.execute(sa.text("""
        INSERT INTO email_templates (name, subject, body, is_active, created_at, updated_at)
        VALUES (
            'password_reset',
            'Family Wishlist - Password Reset Request',
            '<html><body><h2>Password Reset Request</h2><p>Hello {user_name},</p><p>You have requested a password reset for your Family Wishlist account.</p><p>Username: {username}</p><p>Click the link below to reset your password:</p><p><a href="{reset_url}">Reset Password</a></p><p>This link will expire in {expires_in}.</p><p>If you didn''t request this reset, please ignore this email.</p><p>Best regards,<br>Family Wishlist Team</p></body></html>',
            1,
            :created_at,
            :updated_at
        )
    """), {'created_at': datetime.utcnow(), 'updated_at': datetime.utcnow()})

    # Welcome email template
    connection.execute(sa.text("""
        INSERT INTO email_templates (name, subject, body, is_active, created_at, updated_at)
        VALUES (
            'welcome_user',
            'Welcome to Family Wishlist',
            '<html><body><h2>Welcome to Family Wishlist!</h2><p>Hello {user_name},</p><p>Welcome to your Family Wishlist account!</p><p>Your account details:</p><ul><li>Username: {username}</li><li>Email: {email}</li></ul><p>You can now:</p><ul><li>Create and manage your wishlist</li><li>View other family members'' wishlists (if in same household)</li><li>Mark items as interested or purchased</li><li>Add comments to wishlist items</li></ul><p>If you have any questions, please contact your family admin.</p><p>Best regards,<br>Family Wishlist Team</p></body></html>',
            1,
            :created_at,
            :updated_at
        )
    """), {'created_at': datetime.utcnow(), 'updated_at': datetime.utcnow()})

    # Password changed template
    connection.execute(sa.text("""
        INSERT INTO email_templates (name, subject, body, is_active, created_at, updated_at)
        VALUES (
            'password_changed',
            'Family Wishlist - Password Changed',
            '<html><body><h2>Password Changed</h2><p>Hello {user_name},</p><p>Your Family Wishlist password has been changed by an administrator.</p><p>Username: {username}</p><p>You will be required to set a new password the next time you log in.</p><p>If you didn''t expect this change, please contact your family admin immediately.</p><p>Best regards,<br>Family Wishlist Team</p></body></html>',
            1,
            :created_at,
            :updated_at
        )
    """), {'created_at': datetime.utcnow(), 'updated_at': datetime.utcnow()})

    # Household request template
    connection.execute(sa.text("""
        INSERT INTO email_templates (name, subject, body, is_active, created_at, updated_at)
        VALUES (
            'household_request',
            'Family Wishlist - Household Join Request',
            '<html><body><h2>Household Join Request</h2><p>Hello {user_name},</p><p>You have requested to join the household: {household_name}</p><p>Your request is pending approval by the household administrator.</p><p>You will receive an email notification once your request is reviewed.</p><p>Best regards,<br>Family Wishlist Team</p></body></html>',
            1,
            :created_at,
            :updated_at
        )
    """), {'created_at': datetime.utcnow(), 'updated_at': datetime.utcnow()})

    # Household approved template
    connection.execute(sa.text("""
        INSERT INTO email_templates (name, subject, body, is_active, created_at, updated_at)
        VALUES (
            'household_approved',
            'Family Wishlist - Household Request Approved',
            '<html><body><h2>Household Request Approved</h2><p>Hello {user_name},</p><p>Great news! Your request to join {household_name} has been approved.</p><p>You can now view and interact with wishlists from other members of this household.</p><p>Best regards,<br>Family Wishlist Team</p></body></html>',
            1,
            :created_at,
            :updated_at
        )
    """), {'created_at': datetime.utcnow(), 'updated_at': datetime.utcnow()})

    # Household declined template
    connection.execute(sa.text("""
        INSERT INTO email_templates (name, subject, body, is_active, created_at, updated_at)
        VALUES (
            'household_declined',
            'Family Wishlist - Household Request Declined',
            '<html><body><h2>Household Request Declined</h2><p>Hello {user_name},</p><p>Your request to join {household_name} has been declined.</p><p>You may contact the household administrator for more information.</p><p>Best regards,<br>Family Wishlist Team</p></body></html>',
            1,
            :created_at,
            :updated_at
        )
    """), {'created_at': datetime.utcnow(), 'updated_at': datetime.utcnow()})

def downgrade():
    # Remove new columns from family_members table
    op.drop_column('family_members', 'force_password_change')
    op.drop_column('family_members', 'temp_password_hash')
    op.drop_column('family_members', 'password_expires_at')

    # Drop tables in reverse order
    op.drop_table('email_logs')
    op.drop_table('email_templates')
    op.drop_table('email_settings')
    op.drop_table('user_household_association')
    op.drop_index(op.f('ix_households_id'), table_name='households')
    op.drop_table('households') 