#!/bin/bash

# Create dev folder if it doesn't exist
DEV_FOLDER="/home/queen-bee/dev-family-wishlist"

if [ ! -d "$DEV_FOLDER" ]; then
  echo "Creating development environment folder at $DEV_FOLDER..."
  mkdir -p "$DEV_FOLDER"
  cp -r /home/queen-bee/family-wishlist/* "$DEV_FOLDER/"
  mkdir -p "$DEV_FOLDER/data"
fi

# This script runs the development environment with a separate database
cd "$DEV_FOLDER"

# Set the development database path
export DB_PATH="$DEV_FOLDER/data"
export ENVIRONMENT=dev

echo "Starting development environment..."
docker-compose up -d

echo "Development environment started."
echo "Access the application at http://localhost"
echo "The development database is at ${DB_PATH}/wishlist.db"
