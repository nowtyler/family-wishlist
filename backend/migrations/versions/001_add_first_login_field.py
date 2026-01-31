"""
Add first_login field to family_members table

Revision ID: 001_add_first_login_field
Revises: None
Create Date: 2026-01-26
"""

# revision identifiers, used by Alembic.
revision = "001_add_first_login_field"
down_revision = None
branch_labels = None
depends_on = None

from sqlalchemy import text
import sys
import os

# Add parent directory to path to import database module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.database import engine

def upgrade():
    """Add first_login column to family_members table"""
    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("PRAGMA table_info(family_members)"))
        columns = [row[1] for row in result.fetchall()]

        if 'first_login' not in columns:
            print("Adding first_login column to family_members table...")
            # Add the column with default value TRUE for new users
            conn.execute(text(
                "ALTER TABLE family_members ADD COLUMN first_login BOOLEAN DEFAULT 1"
            ))

            # Set existing users to first_login=FALSE
            # (they've already logged in before this feature was added)
            conn.execute(text(
                "UPDATE family_members SET first_login = 0 WHERE first_login IS NULL OR first_login = 1"
            ))

            conn.commit()
            print("✓ Successfully added first_login column")
            print("✓ Set existing users to first_login=false")
        else:
            print("Column first_login already exists, skipping migration")

def downgrade():
    """Remove first_login column from family_members table"""
    with engine.connect() as conn:
        # SQLite doesn't support DROP COLUMN directly, would need table recreation
        print("Downgrade not implemented for SQLite")
        print("To remove column, you would need to recreate the table")

if __name__ == "__main__":
    print("Running migration: Add first_login field to family_members")
    upgrade()
    print("Migration complete!")
