#!/bin/bash
set -e

# Determine which backend service to use based on environment
if [[ "$ENVIRONMENT" == "production" || "$ENVIRONMENT" == "prod" ]]; then
  export BACKEND_SERVICE=backend
  echo "Production environment: Using backend service"
else
  export BACKEND_SERVICE=dev-backend
  echo "Development environment: Using dev-backend service"
fi

# Debug the environment variable
echo "BACKEND_SERVICE is set to: $BACKEND_SERVICE"

# Apply the environment variables to the nginx configuration
envsubst '\$BACKEND_SERVICE' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
echo "Configured Nginx to use $BACKEND_SERVICE"

# Verify the configuration
echo "Checking generated Nginx configuration:"
grep -n "proxy_pass" /etc/nginx/conf.d/default.conf

# Inject runtime environment into index.html
INDEX_FILE="/usr/share/nginx/html/index.html"
if [ -f "$INDEX_FILE" ]; then
  # Determine mode based on ENVIRONMENT
  if [[ "$ENVIRONMENT" == "production" || "$ENVIRONMENT" == "prod" ]]; then
    RUNTIME_MODE="production"
  else
    RUNTIME_MODE="development"
  fi

  echo "Injecting RUNTIME_MODE=$RUNTIME_MODE into index.html"

  # Inject script before closing </head> tag
  sed -i "s|</head>|<script>window.__RUNTIME_ENV__={mode:'$RUNTIME_MODE',siteKey:'$VITE_SITE_KEY'||''};</script></head>|" "$INDEX_FILE"
fi

# Execute the CMD from the Dockerfile
exec "$@"
