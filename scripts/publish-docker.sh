#!/bin/bash

# Script to build and publish Docker images locally
# Usage: ./scripts/publish-docker.sh [tag]
# If no tag is provided, "dev" will be used

set -e

if [ -z "$1" ]
then
  TAG="dev"
else
  TAG="$1"
fi

REPOSITORY="tylernow/family-wishlist"

echo "Building and publishing images with tag: $TAG"

# Build and push backend
echo "Building backend image..."
docker build -t $REPOSITORY:$TAG-backend ./backend

echo "Building frontend image..."
docker build -t $REPOSITORY:$TAG-frontend ./frontend

echo "Logging in to DockerHub..."
docker login

echo "Pushing backend image..."
docker push $REPOSITORY:$TAG-backend

echo "Pushing frontend image..."
docker push $REPOSITORY:$TAG-frontend

echo "Done! Images published as $REPOSITORY:$TAG-backend and $REPOSITORY:$TAG-frontend"
