#!/bin/bash
set -e

# Determine which backend service to use based on environment
if [[ "$ENVIRONMENT" == "dev" ]]; then
  export BACKEND_SERVICE=dev-backend
  echo "Development environment: Using dev-backend service"
else
  export BACKEND_SERVICE=backend
  echo "Production environment: Using backend service"
fi

# Debug the environment variable
echo "BACKEND_SERVICE is set to: $BACKEND_SERVICE"

# Apply the environment variables to the nginx configuration
envsubst '\$BACKEND_SERVICE' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
echo "Configured Nginx to use $BACKEND_SERVICE"

# Verify the configuration
echo "Checking generated Nginx configuration:"
grep -n "proxy_pass" /etc/nginx/conf.d/default.conf

# Execute the CMD from the Dockerfile
exec "$@"
