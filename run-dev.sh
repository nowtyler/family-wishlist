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

echo "Starting development environment..."
ENVIRONMENT=dev docker-compose up -d

echo "Development environment started."
echo "Access the application at http://localhost"
echo "The development database is at $DEV_FOLDER/data/wishlist.db"
