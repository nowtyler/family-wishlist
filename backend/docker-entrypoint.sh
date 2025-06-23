#!/bin/bash
set -e

# Print environment details for debugging (but not showing sensitive values)
echo "Running with ENVIRONMENT=$ENVIRONMENT"
echo "Running with PUID=${PUID:-0} and PGID=${PGID:-0}"

# Create necessary directories with proper permissions
mkdir -p /app/data
mkdir -p /app/data/backups

# Function to handle file/directory ownership
setup_permissions() {
  # Get PUID and PGID from environment, default to root (0) if not provided
  PUID=${PUID:-0}
  PGID=${PGID:-0}

  echo "Setting up directory permissions..."

  # Set permissions for data directory
  chown -R ${PUID}:${PGID} /app/data

  # Set permissions for migrations directory
  if [ -d "/app/app/migrations/versions" ]; then
    chown -R ${PUID}:${PGID} /app/app/migrations/versions
  fi

  # Create necessary security directories/files with root ownership
  if [ ! -f "/app/data/emergency_key.key" ]; then
    mkdir -p "$(dirname /app/data/emergency_key.key)"
    touch /app/data/emergency_key.key
    chmod 600 /app/data/emergency_key.key
  fi

  # Make sensitive files root-owned for security
  # Database files
  find /app/data -name "*.db" -exec chown root:root {} \; -exec chmod 644 {} \; 2>/dev/null || true
  
  # Emergency token files need to stay root-owned but need to be readable/writable by the app
  find /app/data -name "emergency_*.key" -exec chown root:root {} \; -exec chmod 644 {} \; 2>/dev/null || true
  find /app/data -name "emergency_*.enc" -exec chown root:root {} \; -exec chmod 644 {} \; 2>/dev/null || true
  
  echo "Permission setup completed."
}

# Setup proper permissions
setup_permissions

# Check if we need to run database migrations
if [[ "$1" == "uvicorn" ]]; then
  echo "Starting API server..."
  exec "$@"
elif [[ "$1" == "migrate" ]]; then
  echo "Running migrations..."
  python -m alembic upgrade head
  echo "Migrations completed."
  exit 0
else
  echo "Running custom command..."
  exec "$@"
fi
