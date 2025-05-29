#!/bin/bash
# Deployment check script for Family Wishlist
# Usage: ./scripts/check-deployment.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

echo -e "${BLUE}=== Family Wishlist Deployment Check ===${RESET}"
echo "Checking connectivity and configuration..."

# Check backend connectivity
echo -e "\n${YELLOW}Checking Backend API:${RESET}"
backend_status=$(curl -s -o /dev/null -w "%{http_code}" http://backend:8000/api/health)

if [ "$backend_status" = "200" ]; then
  echo -e "${GREEN}✓ Backend API is accessible${RESET}"
else
  echo -e "${RED}✗ Backend API is not accessible (Status: $backend_status)${RESET}"
  echo "Troubleshooting steps:"
  echo "1. Check if backend container is running"
  echo "2. Verify backend is listening on port 8000"
  echo "3. Check for any errors in backend logs"
  echo "4. Verify network connectivity between containers"
fi

# Check Nginx configuration
echo -e "\n${YELLOW}Checking Nginx Configuration:${RESET}"
if docker-compose exec frontend nginx -t 2>/dev/null; then
  echo -e "${GREEN}✓ Nginx configuration is valid${RESET}"
else
  echo -e "${RED}✗ Nginx configuration has errors${RESET}"
  echo "Troubleshooting steps:"
  echo "1. Check nginx.conf for syntax errors"
  echo "2. Verify all referenced paths exist"
  echo "3. Make sure there are no conflicting directives"
fi

# Check frontend files
echo -e "\n${YELLOW}Checking Frontend Files:${RESET}"
if docker-compose exec frontend ls -la /usr/share/nginx/html/index.html 2>/dev/null; then
  echo -e "${GREEN}✓ Frontend files are present${RESET}"
else
  echo -e "${RED}✗ Frontend files are missing${RESET}"
  echo "Troubleshooting steps:"
  echo "1. Check if frontend build completed successfully"
  echo "2. Verify files were correctly copied to the container"
  echo "3. Check if paths in Dockerfile are correct"
fi

# Test API calls
echo -e "\n${YELLOW}Testing API Endpoints:${RESET}"
health_response=$(curl -s http://backend:8000/api/health)
if [[ "$health_response" == *"healthy"* ]]; then
  echo -e "${GREEN}✓ Health check endpoint is working${RESET}"
else
  echo -e "${RED}✗ Health check endpoint returned unexpected response${RESET}"
  echo "Response: $health_response"
fi

# Check environment variables
echo -e "\n${YELLOW}Checking Critical Environment Variables:${RESET}"
if docker-compose exec backend bash -c 'test -n "$FAMILY_PASSWORD_HASH"' 2>/dev/null; then
  echo -e "${GREEN}✓ FAMILY_PASSWORD_HASH is set${RESET}"
else
  echo -e "${RED}✗ FAMILY_PASSWORD_HASH is missing or empty${RESET}"
  echo "This is required for authentication to work!"
fi

echo -e "\n${BLUE}=== Check Complete ===${RESET}"
echo "For more detailed debugging:"
echo "1. Check frontend logs: docker-compose logs frontend"
echo "2. Check backend logs: docker-compose logs backend"
echo "3. Check network settings: docker network inspect wishlist-net"
