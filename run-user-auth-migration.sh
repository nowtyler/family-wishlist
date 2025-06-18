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

echo "Migration completed successfully!"
echo ""
echo "Default passwords have been set up for all users:"
echo "- Regular users: {username}123"
echo "- Admin user: Admin123! or the existing family password"
echo ""
echo "Users should change their passwords after first login."
