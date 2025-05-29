#!/bin/bash
# Script to build and publish Docker images to DockerHub
# Usage: ./scripts/publish-docker.sh [tag] [--run]
# If no tag is provided, "dev" will be used
# The --run flag will run the images locally after building

set -e

# Check if we're in the correct directory
if [ ! -d "./frontend" ] || [ ! -d "./backend" ]; then
  echo "ERROR: Run this script from the project root directory"
  exit 1
fi

# Get tag from command line or use "dev"
if [ -z "$1" ] || [ "$1" == "--run" ]; then
  TAG="dev"
else
  TAG="$1"
fi

# Check if we should run the containers after building
RUN_AFTER_BUILD=false
if [ "$1" == "--run" ] || [ "$2" == "--run" ]; then
  RUN_AFTER_BUILD=true
fi

REPOSITORY="tylernow/family-wishlist"

echo "Building and publishing images with tag: $TAG"

echo "========================================="
echo "Building backend image..."
echo "========================================="
docker build -t $REPOSITORY:$TAG-backend ./backend

echo "========================================="
echo "Building frontend image..."
echo "========================================="
docker build -t $REPOSITORY:$TAG-frontend ./frontend

# Only push if not running locally
if [ "$RUN_AFTER_BUILD" = false ]; then
  echo "========================================="
  echo "Logging in to DockerHub..."
  echo "========================================="
  docker login

  echo "========================================="
  echo "Pushing backend image..."
  echo "========================================="
  docker push $REPOSITORY:$TAG-backend

  echo "========================================="
  echo "Pushing frontend image..."
  echo "========================================="
  docker push $REPOSITORY:$TAG-frontend
  
  echo "========================================="
  echo "Done! Images published as:"
  echo "$REPOSITORY:$TAG-backend"
  echo "$REPOSITORY:$TAG-frontend"
  echo "========================================="
else
  echo "========================================="
  echo "Running containers locally for testing..."
  echo "========================================="
  
  # Create a network if it doesn't exist
  docker network create wishlist-net 2>/dev/null || true
  
  # Stop and remove any existing containers
  docker stop wishlist-backend wishlist-frontend 2>/dev/null || true
  docker rm wishlist-backend wishlist-frontend 2>/dev/null || true
  
  # Run the backend container
  docker run -d --name wishlist-backend \
    --network wishlist-net \
    -p 8000:8000 \
    $REPOSITORY:$TAG-backend
  
  # Run the frontend container, setting the backend URL
  docker run -d --name wishlist-frontend \
    --network wishlist-net \
    -p 5173:80 \
    -e BACKEND_URL=http://wishlist-backend:8000 \
    $REPOSITORY:$TAG-frontend
  
  echo "========================================="
  echo "Containers started! Access the app at:"
  echo "http://localhost:5173"
  echo "========================================="
fi
