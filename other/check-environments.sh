#!/bin/bash

# Check environment health for local/test deployment
# Update the URLs and paths below for your deployment

PROD_URL="${PROD_URL:-http://localhost:8000}"
DEV_URL="${DEV_URL:-http://localhost:8001}"
PROD_DB_PATH="${PROD_DB_PATH:-./data/wishlist.db}"
DEV_DB_PATH="${DEV_DB_PATH:-./data-dev/wishlist.db}"

echo "===== Checking Production Environment ====="
curl -s "${PROD_URL}/api/health" | jq

echo -e "\n===== Checking Development Environment ====="
curl -s "${DEV_URL}/api/health" | jq

echo -e "\n===== Checking Databases ====="
echo "Production database:"
if [ -f "$PROD_DB_PATH" ]; then
    ls -la "$PROD_DB_PATH"
else
    echo "Database not found at $PROD_DB_PATH"
fi

echo -e "\nDevelopment database:"
if [ -f "$DEV_DB_PATH" ]; then
    ls -la "$DEV_DB_PATH"
else
    echo "Database not found at $DEV_DB_PATH"
fi
