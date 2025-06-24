# backend/app/auth.py
import os
from passlib.context import CryptContext
from dotenv import load_dotenv
import logging
from logging.handlers import RotatingFileHandler
import traceback
from datetime import datetime, timedelta
import re
from typing import Optional, Dict
from .utils.timezone_utils import get_est_timestamp, get_est_timedelta

# Load environment variables early
load_dotenv()

# Configure logging with more security and Docker compatibility
def setup_logging():
    """Setup logging with Docker-compatible configuration"""
    global log_path, logger
    
    # Try multiple log paths in order of preference
    log_paths = [
        '/app/data/auth.log',  # Primary Docker path
        './data/auth.log',     # Relative path fallback
        'auth.log',           # Current directory fallback
        '/tmp/auth.log'       # System temp fallback
    ]
    
    log_path = None
    log_dir = None
    
    # Find the first writable log path
    for path in log_paths:
        try:
            log_dir = os.path.dirname(path)
            if not os.path.exists(log_dir):
                os.makedirs(log_dir, exist_ok=True)
            
            # Test if we can write to the file
            with open(path, 'a') as f:
                f.write('')  # Test write
            
            log_path = path
            print(f"Using log path: {log_path}")
            break
        except (OSError, PermissionError) as e:
            print(f"Could not use log path {path}: {e}")
            continue
    
    if not log_path:
        print("WARNING: Could not create log file, falling back to console only")
        log_path = None
    
    # Configure logging handlers
    handlers = []
    
    # Add file handler if we have a valid log path
    if log_path:
        try:
            file_handler = RotatingFileHandler(
                filename=log_path,
                maxBytes=1024*1024,  # 1MB per file
                backupCount=30,      # Keep 30 backup files (roughly 30 days)
                encoding='utf-8'
            )
            handlers.append(file_handler)
            print(f"File logging enabled: {log_path}")
        except Exception as e:
            print(f"Failed to setup file logging: {e}")
    
    # Always add console handler for Docker logs
    console_handler = logging.StreamHandler()
    handlers.append(console_handler)
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=handlers
    )
    
    logger = logging.getLogger(__name__)
    
    # Log the setup
    logger.info(f"Logging setup completed. File logging: {'enabled' if log_path else 'disabled'}")
    if log_path:
        logger.info(f"Log file: {log_path}")

# Initialize logging
setup_logging()

# Function to sanitize hash values in logs
def sanitize_hash(hash_value):
    """Returns a sanitized version of a hash showing only type and first few chars"""
    if not hash_value:
        return "None"
    
    # Extract hash type info
    hash_type = "unknown"
    match = re.match(r'\$([^$]+)\$', hash_value)
    if match:
        hash_type = match.group(1)
    
    # Return just enough info to identify the hash type and uniqueness
    # without exposing the actual hash value
    return f"{hash_type}:...{hash_value[-4:]}"

def log_auth_event(event_type, username=None, success=True, ip_address=None, details=None):
    """
    Log authentication events in a standardized format.
    
    Args:
        event_type (str): Type of event (login, logout, register, etc.)
        username (str, optional): Username associated with the event
        success (bool): Whether the event was successful
        ip_address (str, optional): IP address of the client
        details (str, optional): Additional details about the event
    """
    try:
        status = "SUCCESS" if success else "FAILED"
        log_message = f"AUTH {status} - {event_type}"
        
        if username:
            log_message += f" - User: {username}"
        
        if ip_address:
            log_message += f" - IP: {ip_address}"
        
        if details:
            log_message += f" - Details: {details}"
        
        if success:
            logger.info(log_message)
        else:
            logger.warning(log_message)
    except Exception as e:
        # Fallback to print if logging fails
        print(f"Logging failed: {e}")
        print(f"Auth event: {event_type} - {('SUCCESS' if success else 'FAILED')} - User: {username} - IP: {ip_address}")

# Configure password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Generate a hash of the password."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)

class AuthState:
    def __init__(self):
        self.failed_attempts = 0
        self.lockout_until = None
        self.ip_address = None
        self.username = None

    def record_failure(self, username=None, ip_address=None):
        self.failed_attempts += 1
        self.ip_address = ip_address
        self.username = username
        
        # Log the failure
        details = f"Failed attempt {self.failed_attempts}"
        if self.failed_attempts >= 5:
            self.lockout_until = get_est_timedelta(minutes=5)
            details += f", account locked until {self.lockout_until}"
            log_auth_event("LOCKOUT", username, False, ip_address, details)
        else:
            log_auth_event("AUTH_FAILURE", username, False, ip_address, details)

    def record_success(self, username=None, ip_address=None):
        if self.failed_attempts > 0:
            # If there were previous failures, log that we're resetting
            log_auth_event("AUTH_RESET", username, True, ip_address, 
                          f"Reset after {self.failed_attempts} failed attempts")
        
        self.failed_attempts = 0
        self.lockout_until = None
        self.username = username
        self.ip_address = ip_address

    def is_locked_out(self) -> bool:
        """Check if the IP is currently locked out"""
        if not self.lockout_until:
            return False
        if get_est_timestamp() > self.lockout_until:
            # Reset if lockout period has passed
            self.failed_attempts = 0
            return False
        return self.failed_attempts >= 5

    def get_lockout_message(self):
        if not self.lockout_until:
            return None
        remaining = (self.lockout_until - datetime.now()).total_seconds()
        if remaining <= 0:
            return None
        return f"Too many failed attempts. Please try again in {int(remaining/60)} minutes."

    def get_remaining_lockout_time(self) -> int:
        """Get remaining lockout time in seconds"""
        if not self.is_locked_out() or not self.lockout_until:
            return 0
        remaining = (self.lockout_until - get_est_timestamp()).total_seconds()
        return max(0, int(remaining))

# Create a global auth state instance
auth_state = AuthState()

# --- Helper script to generate a hash (run this once locally) ---
# You can save this as a separate file e.g. `generate_hash.py` in the backend folder
# and run `python generate_hash.py` from within the `backend` directory.
# Then copy the output to your .env file.
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        password_to_hash = sys.argv[1]
        logger.info("=== Generating new password hash ===")
        logger.debug(f"Input password length: {len(password_to_hash)}")
        hashed_password = get_password_hash(password_to_hash)
        # Don't log the full hash
        logger.info(f"Generated hash: {sanitize_hash(hashed_password)}")
        logger.info(f"Hashed password for '{password_to_hash}':")
        logger.info(f"Full hash: {hashed_password}")
    else:
        logger.info("Usage: python app/auth.py <your_desired_password>")
        logger.info("Example: python app/auth.py S3cur3F@m!lyP@sswOrd")