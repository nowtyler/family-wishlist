#!/bin/bash

# Emergency Admin Access Script
# This script provides emergency access to the admin panel when the database is down
# or when migrations are pending and normal login is not possible.

set -e

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
EMERGENCY_TOKEN="${EMERGENCY_ACCESS_TOKEN}"
ALLOWED_HOSTS="${EMERGENCY_ALLOWED_HOSTS:-127.0.0.1,localhost,::1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if emergency token is set
check_emergency_token() {
    if [ -z "$EMERGENCY_TOKEN" ]; then
        print_error "Emergency access token not set!"
        echo "Please set the EMERGENCY_ACCESS_TOKEN environment variable:"
        echo "export EMERGENCY_ACCESS_TOKEN='your-secure-token-here'"
        echo ""
        echo "You can generate a secure token with:"
        echo "openssl rand -hex 32"
        exit 1
    fi
}

# Function to test backend connectivity
test_backend() {
    print_status "Testing backend connectivity..."
    
    if curl -s --max-time 10 "$BACKEND_URL/api/health" > /dev/null; then
        print_success "Backend is reachable"
        return 0
    else
        print_warning "Backend is not reachable at $BACKEND_URL"
        return 1
    fi
}

# Function to attempt emergency admin access
attempt_emergency_access() {
    print_status "Attempting emergency admin access..."
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-Forwarded-For: 127.0.0.1" \
        -d "{\"emergency_token\": \"$EMERGENCY_TOKEN\"}" \
        "$BACKEND_URL/api/emergency/admin-access")
    
    if echo "$response" | grep -q '"success": true'; then
        print_success "Emergency admin access granted!"
        
        # Extract admin user info
        admin_id=$(echo "$response" | grep -o '"id":[0-9]*' | cut -d':' -f2)
        admin_name=$(echo "$response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
        
        echo ""
        echo "Admin User Details:"
        echo "  ID: $admin_id"
        echo "  Name: $admin_name"
        echo ""
        echo "You can now:"
        echo "  1. Access the admin panel at: $BACKEND_URL/admin"
        echo "  2. Run migrations from the Migration Manager"
        echo "  3. Restore from backups if needed"
        echo ""
        echo "Response: $response"
        return 0
    else
        print_error "Emergency access failed!"
        echo "Response: $response"
        return 1
    fi
}

# Function to attempt legacy emergency access (fallback)
attempt_legacy_emergency_access() {
    print_status "Attempting legacy emergency access..."
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        "$BACKEND_URL/api/admin/emergency-access")
    
    if echo "$response" | grep -q '"id"'; then
        print_success "Legacy emergency admin access granted!"
        
        # Extract admin user info
        admin_id=$(echo "$response" | grep -o '"id":[0-9]*' | cut -d':' -f2)
        admin_name=$(echo "$response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
        
        echo ""
        echo "Admin User Details:"
        echo "  ID: $admin_id"
        echo "  Name: $admin_name"
        echo ""
        echo "You can now access the admin panel and run migrations."
        echo ""
        echo "Response: $response"
        return 0
    else
        print_error "Legacy emergency access also failed!"
        echo "Response: $response"
        return 1
    fi
}

# Function to provide manual instructions
show_manual_instructions() {
    print_warning "Automatic emergency access failed. Here are manual options:"
    echo ""
    echo "Option 1: Direct API Call"
    echo "  curl -X POST \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -H 'X-Forwarded-For: 127.0.0.1' \\"
    echo "    -d '{\"emergency_token\": \"$EMERGENCY_TOKEN\"}' \\"
    echo "    '$BACKEND_URL/api/emergency/admin-access'"
    echo ""
    echo "Option 2: Legacy Emergency Access"
    echo "  curl -X POST \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    '$BACKEND_URL/api/admin/emergency-access'"
    echo ""
    echo "Option 3: Database Direct Access"
    echo "  If you have direct database access, you can:"
    echo "  1. Connect to the SQLite database"
    echo "  2. Update or create an admin user manually"
    echo "  3. Restart the application"
    echo ""
    echo "Option 4: Container Access"
    echo "  If running in Docker:"
    echo "  docker exec -it wishlist-backend bash"
    echo "  # Then run the emergency access from inside the container"
}

# Main execution
main() {
    echo "=========================================="
    echo "    Emergency Admin Access Script"
    echo "=========================================="
    echo ""
    
    # Check emergency token
    check_emergency_token
    
    # Test backend connectivity
    if ! test_backend; then
        print_warning "Backend connectivity issues detected"
        echo "This might be due to:"
        echo "  - Database migration issues"
        echo "  - Application startup problems"
        echo "  - Network connectivity issues"
        echo ""
    fi
    
    # Try secure emergency access first
    if attempt_emergency_access; then
        exit 0
    fi
    
    # Try legacy emergency access as fallback
    if attempt_legacy_emergency_access; then
        exit 0
    fi
    
    # If all automatic methods fail, show manual instructions
    show_manual_instructions
    exit 1
}

# Run main function
main "$@" 