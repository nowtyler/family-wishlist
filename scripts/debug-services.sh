#!/bin/bash
# Diagnose common issues with the family-wishlist application
# Usage: ./scripts/debug-services.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

echo -e "${BLUE}=== Family Wishlist Diagnostic Tool ===${RESET}"

# Check if containers are running
echo -e "\n${YELLOW}Checking Docker Containers:${RESET}"
backend_running=$(docker ps -q -f name=backend)
frontend_running=$(docker ps -q -f name=frontend)

if [ -n "$backend_running" ]; then
  echo -e "${GREEN}✓ Backend container is running${RESET}"
else
  echo -e "${RED}✗ Backend container is NOT running${RESET}"
  echo "Try: docker-compose up -d backend"
  
  # Check if container exists but is stopped
  if docker ps -a -q -f name=backend > /dev/null; then
    echo "Container exists but is stopped. Check logs: docker logs backend"
  fi
fi

if [ -n "$frontend_running" ]; then
  echo -e "${GREEN}✓ Frontend container is running${RESET}"
else
  echo -e "${RED}✗ Frontend container is NOT running${RESET}"
  echo "Try: docker-compose up -d frontend"
  
  # Check if container exists but is stopped
  if docker ps -a -q -f name=frontend > /dev/null; then
    echo "Container exists but is stopped. Check logs: docker logs frontend"
  fi
fi

# Check environment file
echo -e "\n${YELLOW}Checking Environment File:${RESET}"
if [ -f .env ]; then
  echo -e "${GREEN}✓ .env file exists${RESET}"
  
  # Check required variables without showing values
  if grep -q "FAMILY_PASSWORD_HASH" .env; then
    echo -e "${GREEN}✓ FAMILY_PASSWORD_HASH is set${RESET}"
  else
    echo -e "${RED}✗ FAMILY_PASSWORD_HASH is missing${RESET}"
  fi
  
  if grep -q "FAMILY_MEMBERS_CONFIG" .env; then
    echo -e "${GREEN}✓ FAMILY_MEMBERS_CONFIG is set${RESET}"
  else
    echo -e "${RED}✗ FAMILY_MEMBERS_CONFIG is missing${RESET}"
  fi
else
  echo -e "${RED}✗ .env file not found${RESET}"
  echo "Create one using .env.example as a template"
fi

# Check network
echo -e "\n${YELLOW}Checking Docker Network:${RESET}"
if docker network ls | grep -q "wishlist-net"; then
  echo -e "${GREEN}✓ wishlist-net network exists${RESET}"
  
  # Check container connections
  if [ -n "$backend_running" ] && docker network inspect wishlist-net | grep -q "backend"; then
    echo -e "${GREEN}✓ Backend container is connected to the network${RESET}"
  else
    echo -e "${RED}✗ Backend container is not connected to the network${RESET}"
  fi
  
  if [ -n "$frontend_running" ] && docker network inspect wishlist-net | grep -q "frontend"; then
    echo -e "${GREEN}✓ Frontend container is connected to the network${RESET}"
  else
    echo -e "${RED}✗ Frontend container is not connected to the network${RESET}"
  fi
else
  echo -e "${RED}✗ wishlist-net network does not exist${RESET}"
  echo "Try: docker network create wishlist-net"
fi

# Test backend API health
echo -e "\n${YELLOW}Testing Backend API:${RESET}"
if [ -n "$backend_running" ]; then
  response=$(docker exec backend curl -s http://localhost:8000/api/health)
  
  if [[ $response == *"healthy"* ]]; then
    echo -e "${GREEN}✓ Backend health check passed${RESET}"
  else
    echo -e "${RED}✗ Backend health check failed${RESET}"
    echo "Response: $response"
  fi
  
  # Check backend logs for errors
  echo -e "\n${YELLOW}Checking Backend Logs for Errors:${RESET}"
  docker logs backend --tail 50 | grep -i 'error\|exception\|traceback'
fi

# Test frontend configuration
echo -e "\n${YELLOW}Checking Frontend Configuration:${RESET}"
if [ -n "$frontend_running" ]; then
  # Check nginx config
  config_test=$(docker exec frontend nginx -t 2>&1)
  
  if [[ $config_test == *"successful"* ]]; then
    echo -e "${GREEN}✓ Nginx configuration is valid${RESET}"
  else
    echo -e "${RED}✗ Nginx configuration has errors${RESET}"
    echo "$config_test"
  fi
  
  # Check if / works
  echo -e "\n${YELLOW}Testing Frontend Routes:${RESET}"
  index_response=$(docker exec frontend curl -s -o /dev/null -w "%{http_code}" http://localhost/)
  
  if [[ $index_response == "200" ]]; then
    echo -e "${GREEN}✓ Frontend index page is accessible${RESET}"
  else
    echo -e "${RED}✗ Frontend index page returned $index_response${RESET}"
  fi
  
  auth_response=$(docker exec frontend curl -s -o /dev/null -w "%{http_code}" http://localhost/auth)
  
  if [[ $auth_response == "200" ]]; then
    echo -e "${GREEN}✓ Frontend auth page is accessible${RESET}"
  else
    echo -e "${RED}✗ Frontend auth page returned $auth_response${RESET}"
  fi
  
  # Check proxy config
  api_response=$(docker exec frontend curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health)
  
  if [[ $api_response == "200" ]]; then
    echo -e "${GREEN}✓ API proxy configuration working${RESET}"
  else
    echo -e "${RED}✗ API proxy configuration error (status $api_response)${RESET}"
    echo "Check if 'backend' hostname resolves inside the frontend container"
  fi
  
  # Check if nginx is logging
  echo -e "\n${YELLOW}Checking Nginx Logs:${RESET}"
  docker exec frontend ls -la /var/log/nginx
  docker exec frontend tail -n 10 /var/log/nginx/error.log
fi

echo -e "\n${BLUE}=== Diagnostic Complete ===${RESET}"
echo "For more detailed logs:"
echo "docker logs backend"
echo "docker logs frontend"
