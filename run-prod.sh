#!/bin/bash

# This script runs the production environment
cd /home/queen-bee/family-wishlist

# Set the production database path
export DB_PATH="/home/queen-bee/family-wishlist/data"
export ENVIRONMENT=prod

echo "Starting production environment..."
docker-compose up -d

echo "Production environment started."
echo "Access the application at http://localhost"
echo "The production database is at ${DB_PATH}/wishlist.db"
