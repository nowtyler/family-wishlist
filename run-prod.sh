#!/bin/bash

# This script runs the production environment
cd /home/queen-bee/family-wishlist

echo "Starting production environment..."
ENVIRONMENT=prod docker-compose up -d

echo "Production environment started."
echo "Access the application at http://localhost"
echo "The production database is at /home/queen-bee/family-wishlist/data/wishlist.db"
