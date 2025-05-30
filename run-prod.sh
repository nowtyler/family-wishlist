#!/bin/bash

# This script runs the production environment
cd /home/queen-bee/family-wishlist

# Set the production database path
export DB_PATH="/home/queen-bee/family-wishlist/data"
export ENVIRONMENT=prod
export WISHLIST_DATABASE_URL="sqlite:///./data/wishlist.db"

echo "Starting production environment..."
docker-compose up -d frontend backend

echo "Production environment started."
echo "Access the application at http://localhost"
echo "The production database is at ${DB_PATH}/wishlist.db"
