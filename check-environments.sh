#!/bin/bash

echo "===== Checking Production Environment ====="
curl -s https://wishlist.ariahive.top/api/health | jq

echo -e "\n===== Checking Development Environment ====="
curl -s https://dev-wishlist.ariahive.top/api/health | jq

echo -e "\n===== Checking Databases ====="
echo "Production database:"
ls -la /home/queen-bee/family-wishlist/data/wishlist.db

echo -e "\nDevelopment database:"
ls -la /home/queen-bee/dev-family-wishlist/data/wishlist.db
