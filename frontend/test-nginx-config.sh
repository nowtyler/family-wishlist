#!/bin/bash

# Test script to verify nginx config environment variable substitution

# Define test variables
export ENVIRONMENT="development"
export BACKEND_SERVICE="dev-backend"

# Create a test template
cat > test-template.conf << EOF
server {
    # Test configuration
    location /api {
        proxy_pass http://\${BACKEND_SERVICE}:8000;
    }
}
EOF

echo "Testing with envsubst:"
echo "BACKEND_SERVICE=$BACKEND_SERVICE"
cat test-template.conf

echo "After substitution:"
envsubst '\$BACKEND_SERVICE' < test-template.conf

# Clean up
rm test-template.conf
echo "Test complete."
