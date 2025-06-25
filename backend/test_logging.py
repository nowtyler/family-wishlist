#!/usr/bin/env python3
"""
Test script to verify logging functionality in Docker environment
"""
import os
import sys
import logging
from datetime import datetime

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

def test_logging():
    """Test logging functionality"""
    print("=== Testing Logging Functionality ===")
    
    # Test environment variables
    print(f"Environment: {os.getenv('ENVIRONMENT', 'unknown')}")
    print(f"PUID: {os.getenv('PUID', 'unknown')}")
    print(f"PGID: {os.getenv('PGID', 'unknown')}")
    
    # Test log file paths
    log_paths = [
        '/app/data/auth.log',
        './data/auth.log',
        'auth.log',
        '/tmp/auth.log'
    ]
    
    print("\n=== Checking Log File Paths ===")
    for path in log_paths:
        exists = os.path.exists(path)
        size = os.path.getsize(path) if exists else 0
        writable = os.access(os.path.dirname(path), os.W_OK) if os.path.dirname(path) else False
        print(f"{path}: exists={exists}, size={size}, writable={writable}")
    
    # Test importing auth module
    try:
        from app import auth
        print("\n=== Auth Module Import Successful ===")
        
        # Test logging an event
        print("Testing auth event logging...")
        auth.log_auth_event("TEST", "test_user", True, "127.0.0.1", "Test event from script")
        print("Auth event logged successfully")
        
        # Check if log was written
        for path in log_paths:
            if os.path.exists(path) and os.path.getsize(path) > 0:
                print(f"\n=== Log File Content ({path}) ===")
                try:
                    with open(path, 'r') as f:
                        content = f.read()
                        print(content[-500:] if len(content) > 500 else content)  # Show last 500 chars
                except Exception as e:
                    print(f"Error reading {path}: {e}")
                break
        
    except Exception as e:
        print(f"Error importing auth module: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n=== Test Complete ===")

if __name__ == "__main__":
    test_logging()