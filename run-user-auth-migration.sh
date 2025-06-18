#!/bin/bash
# run-user-auth-migration.sh
set -e

echo "Starting user authentication system migration..."

# Step 1: Run the database migration using Alembic
echo "Running database schema migration..."
cd backend
python -m alembic upgrade head
cd ..

# Step 2: Run the script to setup default passwords for existing users
echo "Setting up default passwords for existing users..."
cd backend
python setup_user_passwords.py
cd ..

# Step 3: Reset the schema hash to avoid false "upgrade needed" messages
echo "Resetting schema hash to match new structure..."
cd backend
python -c "
from app.services.migration_service import MigrationService
from app.database import SQLALCHEMY_DATABASE_URL
from app import crud
from app.database import SessionLocal

# Get current schema hash and update it in the database
migration_service = MigrationService(SQLALCHEMY_DATABASE_URL)
current_hash = migration_service.get_schema_hash()
db = SessionLocal()
crud.update_schema_hash(db, current_hash)
db.close()
print(f'Schema hash updated to: {current_hash[:8]}...')
"
cd ..

echo "Migration completed successfully!"
echo ""
echo "Default passwords have been set up for all users:"
echo "- Regular users: {username}123"
echo "- Admin user: Admin123! or the existing family password"
echo ""
echo "Users should change their passwords after first login."
