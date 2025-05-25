# backend/app/auth.py
import os
from passlib.context import CryptContext
from dotenv import load_dotenv
import logging
import traceback

# Configure logging with more detail
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/data/auth.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

load_dotenv()

# It's CRITICAL that FAMILY_PASSWORD_HASH is set in your .env file.
# If it's not set, this will raise a runtime error, preventing the application from starting.
# For production, ensure this is set via environment variables.
EXPECTED_HASH = os.getenv("FAMILY_PASSWORD_HASH", "")
if EXPECTED_HASH:
    # Just strip quotes and whitespace, no escaping needed
    EXPECTED_HASH = EXPECTED_HASH.strip().strip('"\'')
    logger.debug(f"Loaded hash from env (first 20 chars): {EXPECTED_HASH[:20]}")
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
    logger.debug(f"Processing hash (first 20 chars): {hash_str[:20]}")
    
    # Basic format check
    if not hash_str.startswith('$2'):
        logger.error("Hash doesn't start with $2")
        return False
    
    parts = hash_str.split('$')
    logger.debug(f"Hash parts count: {len(parts)}")
    
    if len(parts) != 4:
        logger.error(f"Invalid hash format - expected 4 parts, got {len(parts)}")
        return False

    return True

if not validate_hash_format(EXPECTED_HASH):
    logger.error(f"Invalid hash format detected: {EXPECTED_HASH[:20]}...")
    raise RuntimeError("Invalid hash format in FAMILY_PASSWORD_HASH")

logger.info(f"Loaded password hash: {EXPECTED_HASH[:20]}...")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str) -> bool:
    logger.info("=== Starting password verification ===")
    
    if not EXPECTED_HASH:
        logger.error("No password hash available for verification")
        return False
        
    try:
        if not validate_hash_format(EXPECTED_HASH):
            logger.error("Invalid hash format detected during verification")
            return False

        logger.debug(f"Input password length: {len(plain_password)}")
        logger.debug(f"Stored hash: {EXPECTED_HASH}")
        logger.debug(f"Hash format check - starts with $2b$: {EXPECTED_HASH.startswith('$2b$')}")
        
        # Try to decode the hash to check format
        try:
            pwd_context.identify(EXPECTED_HASH)
            logger.debug("Hash format identification successful")
        except Exception as hash_error:
            logger.error(f"Hash format error: {str(hash_error)}")
            raise

        result = pwd_context.verify(plain_password, EXPECTED_HASH)
        logger.info(f"Verification result: {result}")
        
        if not result:
            # Log more details about the failed attempt (safely)
            logger.warning("Password verification failed")
            logger.debug(f"Password length mismatch? Expected hash length: {len(EXPECTED_HASH)}")
        
        return result
        
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
        logger.info(f"Generated hash: {hashed_password}")
        print(f"Hashed password for '{password_to_hash}':")
        print(hashed_password)
    else:
        print("Usage: python app/auth.py <your_desired_password>")
        print("Example: python app/auth.py S3cur3F@m!lyP@sswOrd")