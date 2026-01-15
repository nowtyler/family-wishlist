#!/bin/bash

# This script runs the production environment
cd /home/queen-bee/family-wishlist

# Set the production database path
export DB_PATH="/home/queen-bee/family-wishlist/data"
export ENVIRONMENT=prod
export WISHLIST_DATABASE_URL="sqlite:///./data/wishlist.db"

# Set PUID and PGID if not already set
# This will use the current user's UID and GID by default
if [ -z "$PUID" ]; then
  export PUID=$(id -u)
  echo "Setting PUID to $PUID"
fi

if [ -z "$PGID" ]; then
  export PGID=$(id -g)
  echo "Setting PGID to $PGID"
fi

echo "Starting production environment..."
echo "Using PUID=$PUID and PGID=$PGID for file permissions"
docker-compose up -d frontend backend

echo "Production environment started."
echo "Access the application at http://localhost"
echo "The production database is at ${DB_PATH}/wishlist.db"
