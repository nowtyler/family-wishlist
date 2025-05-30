#!/bin/bash

# This script runs the development environment with the dev database

echo "Starting development environment with dev database..."
ENVIRONMENT=dev docker-compose -f docker-compose.dev.yml up -d

echo "Development environment started."
echo "Access the application at http://localhost"
echo "The development database is at ./data/dev-wishlist.db"
