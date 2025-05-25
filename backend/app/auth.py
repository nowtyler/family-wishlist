# backend/app/auth.py
import os
from passlib.context import CryptContext
from dotenv import load_dotenv
import logging

# Configure logging
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
EXPECTED_HASH = os.getenv("FAMILY_PASSWORD_HASH")
if not EXPECTED_HASH:
    logger.error("FAMILY_PASSWORD_HASH is not set in environment variables")
    raise RuntimeError(
        "CRITICAL SECURITY ERROR: FAMILY_PASSWORD_HASH is not set in .env file. "
        "Please run 'python app/auth.py your_password' to generate a secure hash "
        "and set it in your .env file."
    )

logger.info(f"Loaded password hash: {EXPECTED_HASH[:20]}...")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str) -> bool:
    if not EXPECTED_HASH:
        logger.error("No password hash available for verification")
        return False
    try:
        logger.debug(f"Attempting to verify password (length: {len(plain_password)})")
        logger.debug(f"Using hash: {EXPECTED_HASH[:20]}...")
        result = pwd_context.verify(plain_password, EXPECTED_HASH)
        logger.info(f"Password verification completed. Result: {result}")
        return result
    except Exception as e:
        logger.error(f"Password verification error: {str(e)}", exc_info=True)
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
        hashed_password = get_password_hash(password_to_hash)
        print(f"Hashed password for '{password_to_hash}':")
        print(hashed_password)
    else:
        print("Usage: python app/auth.py <your_desired_password>")
        print("Example: python app/auth.py S3cur3F@m!lyP@sswOrd")