#!/bin/bash
# API testing script for Family Wishlist
# Usage: ./scripts/test-api.sh [password]

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

# Default password if not provided
PASSWORD=${1:-"testpassword"}

BACKEND_URL="http://backend:8000"
if [ -z "$INSIDE_CONTAINER" ]; then
  echo "Running outside container, assuming local development"
  BACKEND_URL="http://localhost:8000"
fi

echo -e "${BLUE}=== Family Wishlist API Test ===${RESET}"
echo "Testing API endpoints with password: $PASSWORD"

# Test password verification
echo -e "\n${YELLOW}Testing Password Verification:${RESET}"
password_response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$PASSWORD\"}" \
  $BACKEND_URL/api/auth/verify-password)

echo "Response: $password_response"

if [[ "$password_response" == *"authenticated"* ]]; then
  echo -e "${GREEN}✓ Password verification endpoint is working${RESET}"
else
  echo -e "${RED}✗ Password verification endpoint returned unexpected response${RESET}"
fi

# Test family members endpoint
echo -e "\n${YELLOW}Testing Family Members Endpoint:${RESET}"
members_response=$(curl -s $BACKEND_URL/api/family-members)

echo "Response: $members_response"

if [[ "$members_response" == *"["* ]]; then
  echo -e "${GREEN}✓ Family members endpoint is working${RESET}"
else
  echo -e "${RED}✗ Family members endpoint returned unexpected response${RESET}"
fi

# Test health endpoint
echo -e "\n${YELLOW}Testing Health Endpoint:${RESET}"
health_response=$(curl -s $BACKEND_URL/api/health)

echo "Response: $health_response"

if [[ "$health_response" == *"healthy"* ]]; then
  echo -e "${GREEN}✓ Health check endpoint is working${RESET}"
else
  echo -e "${RED}✗ Health check endpoint returned unexpected response${RESET}"
fi

echo -e "\n${BLUE}=== API Tests Complete ===${RESET}"
