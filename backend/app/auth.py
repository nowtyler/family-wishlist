# backend/app/auth.py
import os
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

# It's CRITICAL that FAMILY_PASSWORD_HASH is set in your .env file.
# If it's not set, this will default to a very weak password, which is insecure.
# For production, ensure this is set via environment variables.
EXPECTED_HASH = os.getenv("FAMILY_PASSWORD_HASH")
if not EXPECTED_HASH:
    print("WARNING: FAMILY_PASSWORD_HASH is not set in .env. Using a default insecure hash.")
    # This is an example hash for "password". REPLACE IT.
    EXPECTED_HASH = "$2b$12$F6SSFVZ8P1HtyGHCX7WlguVJPKYSsuWDaiENQ/awoyCdYG8bSk7f6"


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str) -> bool:
    if not EXPECTED_HASH: # Should not happen if you set it
        return False
    return pwd_context.verify(plain_password, EXPECTED_HASH)

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