#!/bin/bash

# Local development script - runs both frontend and backend without Docker
# Usage: ./run-local.sh [frontend|backend|all]

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Load local environment variables if they exist
if [ -f ".env.local" ]; then
    echo "Loading .env.local..."
    export $(grep -v '^#' .env.local | xargs)
elif [ -f ".env" ]; then
    echo "Loading .env..."
    export $(grep -v '^#' .env | xargs)
else
    echo "Warning: No .env.local or .env file found. Copy .env.local.example to .env.local and configure it."
fi

# Set local development flags
export LOCAL=true
export ENVIRONMENT=dev

# Create data directory if it doesn't exist
mkdir -p backend/data

start_backend() {
    echo "Starting backend on http://localhost:8000..."
    cd backend
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}

start_frontend() {
    echo "Starting frontend on http://localhost:5173..."
    cd frontend
    npm run dev
}

start_all() {
    echo "Starting both frontend and backend..."
    echo "Backend: http://localhost:8000"
    echo "Frontend: http://localhost:5173"
    echo ""

    # Check if concurrently is installed at root level
    if [ -f "node_modules/.bin/concurrently" ]; then
        npm run dev
    else
        echo "Installing concurrently..."
        npm install
        npm run dev
    fi
}

case "${1:-all}" in
    backend)
        start_backend
        ;;
    frontend)
        start_frontend
        ;;
    all)
        start_all
        ;;
    *)
        echo "Usage: $0 [frontend|backend|all]"
        echo "  frontend - Start only the frontend dev server"
        echo "  backend  - Start only the backend API server"
        echo "  all      - Start both (default)"
        exit 1
        ;;
esac
