#!/bin/bash
# Script to build and publish Docker images to DockerHub
# Usage: ./scripts/publish-docker.sh [tag]
# If no tag is provided, "dev" will be used

set -e

# Check if we're in the correct directory
if [ ! -d "./frontend" ] || [ ! -d "./backend" ]; then
  echo "ERROR: Run this script from the project root directory"
  exit 1
fi

# Get tag from command line or use "dev"
if [ -z "$1" ]; then
  TAG="dev"
else
  TAG="$1"
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
