#!/bin/bash

# This script runs the production environment with the production database

echo "Starting production environment with production database..."
ENVIRONMENT=prod docker-compose -f docker-compose.prod.yml up -d

echo "Production environment started."
echo "Access the application at http://localhost"
echo "The production database is at ./data/wishlist.db"
