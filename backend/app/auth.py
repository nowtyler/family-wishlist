# backend/app/auth.py
import os
from passlib.context import CryptContext
from dotenv import load_dotenv
import logging
from logging.handlers import RotatingFileHandler
import traceback
from datetime import datetime, timedelta
import re

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

# It's CRITICAL that FAMILY_PASSWORD_HASH is set in your .env file.
# If it's not set, this will raise a runtime error, preventing the application from starting.
# For production, ensure this is set via environment variables.
EXPECTED_HASH = os.getenv("FAMILY_PASSWORD_HASH", "")
if EXPECTED_HASH:
    # Just strip quotes and whitespace, no escaping needed
    EXPECTED_HASH = EXPECTED_HASH.strip().strip('"\'')
    logger.debug(f"Loaded hash from env: {sanitize_hash(EXPECTED_HASH)}")
else:
    logger.error("FAMILY_PASSWORD_HASH is empty or not set")
    raise RuntimeError("FAMILY_PASSWORD_HASH is not set in .env file")

def validate_hash_format(hash_str: str) -> bool:
    """Validate that the hash string is in the correct bcrypt format."""
    if not hash_str:
        logger.error("Hash string is empty")
        return False
    
    # Strip quotes if present
    hash_str = hash_str.strip('"\'')
    
    # Basic format check
    if not hash_str.startswith('$2'):
        logger.error("Hash doesn't start with $2")
        return False
    
    parts = hash_str.split('$')
    
    if len(parts) != 4:
        logger.error(f"Invalid hash format - expected 4 parts, got {len(parts)}")
        return False

    return True

if not validate_hash_format(EXPECTED_HASH):
    logger.error(f"Invalid hash format detected: {sanitize_hash(EXPECTED_HASH)}")
    raise RuntimeError("Invalid hash format in FAMILY_PASSWORD_HASH")

logger.info(f"Loaded password hash: {sanitize_hash(EXPECTED_HASH)}")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthState:
    def __init__(self):
        self.failed_attempts = 0
        self.lockout_until = None

    def record_failure(self):
        self.failed_attempts += 1
        if self.failed_attempts >= 5:
            self.lockout_until = datetime.now() + timedelta(minutes=5)
            logger.warning(f"Account locked until {self.lockout_until}")

    def record_success(self):
        self.failed_attempts = 0
        self.lockout_until = None

    def is_locked_out(self):
        if not self.lockout_until:
            return False
        if datetime.now() > self.lockout_until:
            self.failed_attempts = 0
            self.lockout_until = None
            return False
        return True

    def get_lockout_message(self):
        if not self.lockout_until:
            return None
        remaining = (self.lockout_until - datetime.now()).total_seconds()
        if remaining <= 0:
            return None
        return f"Too many failed attempts. Please try again in {int(remaining/60)} minutes."

# Create a global auth state instance
auth_state = AuthState()

def verify_password(plain_password: str) -> bool:
    logger.info("=== Starting password verification ===")
    
    # Check for lockout
    if auth_state.is_locked_out():
        lockout_message = auth_state.get_lockout_message()
        logger.warning(f"Login attempted while locked out: {lockout_message}")
        raise ValueError(lockout_message)

    if not EXPECTED_HASH:
        logger.error("No password hash available for verification")
        return False
        
    try:
        if not validate_hash_format(EXPECTED_HASH):
            logger.error("Invalid hash format detected during verification")
            return False

        logger.debug(f"Input password length: {len(plain_password)}")
        
        # Try to decode the hash to check format
        try:
            pwd_context.identify(EXPECTED_HASH)
            logger.debug("Hash format identification successful")
        except Exception as hash_error:
            logger.error(f"Hash format error: {str(hash_error)}")
            raise

        result = pwd_context.verify(plain_password, EXPECTED_HASH)
        logger.info(f"Verification result: {result}")
        
        if result:
            auth_state.record_success()
        else:
            auth_state.record_failure()
            if auth_state.is_locked_out():
                raise ValueError(auth_state.get_lockout_message())
            logger.warning("Password verification failed")
        
        return result
        
    except ValueError:
        raise
    except Exception as e:
        logger.error("=== Password verification error ===")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error message: {str(e)}")
        logger.error("Stack trace:")
        logger.error(traceback.format_exc())
        raise

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

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