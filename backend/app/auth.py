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

# Configure logging with more security
log_path = '/app/data/auth.log'
log_dir = os.path.dirname(log_path)

# Create log directory if it doesn't exist
if not os.path.exists(log_dir):
    try:
        os.makedirs(log_dir, exist_ok=True)
    except Exception:
        # Fallback to current directory if /app/data isn't writable
        log_path = 'auth.log'

# Use rotating file handler with max 5 backups of 1MB each
logging.basicConfig(
    level=logging.INFO,  # Changed from DEBUG to INFO for production use
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler(
            filename=log_path,
            maxBytes=1024*1024,  # 1MB per file
            backupCount=5,       # Keep 5 backup files max
            encoding='utf-8'
        ),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

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

load_dotenv()

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

    def record_failure(self):
        self.failed_attempts += 1
        if self.failed_attempts >= 5:
            self.lockout_until = get_est_timedelta(minutes=5)
            logger.warning(f"Account locked until {self.lockout_until}")

    def record_success(self):
        self.failed_attempts = 0
        self.lockout_until = None

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