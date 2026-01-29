# backend/app/services/user_auth_service.py
from typing import Optional, Tuple
import logging
import secrets
import string
import hashlib
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from passlib.context import CryptContext
import pytz
from .. import models, schemas, auth
from ..utils.timezone_utils import get_est_timestamp, get_est_timedelta
from .email_service import EmailService

logger = logging.getLogger(__name__)

# Configure password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserAuthService:
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against a hash.

        Note: Passwords are truncated to 72 bytes to match the hashing behavior.
        """
        # Truncate password to 72 bytes (bcrypt's limit) to match hashing
        password_bytes = plain_password.encode('utf-8')[:72]
        return pwd_context.verify(password_bytes.decode('utf-8', errors='ignore'), hashed_password)
    
    @staticmethod
    def get_password_hash(password: str) -> str:
        """Generate a hash of the password.

        Note: bcrypt has a maximum password length of 72 bytes.
        Passwords longer than 72 bytes are truncated to prevent errors.
        """
        # Truncate password to 72 bytes (bcrypt's limit)
        password_bytes = password.encode('utf-8')[:72]
        return pwd_context.hash(password_bytes.decode('utf-8', errors='ignore'))
    
    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> Tuple[bool, str, Optional[models.FamilyMember]]:
        """
        Authenticate a user with username and password.
        Returns a tuple of (success, message, user_object)
        """
        try:
            # Find user by username (case insensitive)
            user = db.query(models.FamilyMember).filter(func.lower(models.FamilyMember.username) == func.lower(username)).first()
            
            if not user:
                logger.info(f"Authentication failure: Username not found - {username}")
                return False, "Invalid username or password", None
                
            if not user.password_hash:
                logger.warning(f"Authentication failure: No password hash for user {username}")
                return False, "User account is not set up for password authentication", None
                
            if not UserAuthService.verify_password(password, user.password_hash):
                logger.warning(f"Authentication failure: Invalid password for user {username}")
                return False, "Invalid username or password", None
            
            logger.info(f"Authentication successful: User {username}")
            return True, "Authentication successful", user
                
        except Exception as e:
            logger.exception(f"User authentication failed for {username}")
            return False, f"Authentication error: {str(e)}", None
    
    @staticmethod
    def generate_reset_token() -> str:
        """Generate a secure token for password reset."""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(64))

    @staticmethod
    def hash_token(token: str) -> str:
        """Hash a token using SHA-256 for secure storage."""
        return hashlib.sha256(token.encode('utf-8')).hexdigest()

    @staticmethod
    def create_reset_token(db: Session, username_or_email: str) -> Tuple[bool, str]:
        """
        Create a password reset token for a user.
        Returns tuple of (success, message)
        """
        try:
            # Normalize input for case insensitive comparison
            normalized_input = username_or_email.lower().strip()
            
            logger.info(f"Attempting to create reset token for: {normalized_input}")
            
            # Find user by username or email (case insensitive)
            user = (
                db.query(models.FamilyMember)
                .filter(
                    (func.lower(models.FamilyMember.username) == normalized_input) |
                    (func.lower(models.FamilyMember.email) == normalized_input)
                )
                .first()
            )
            
            if not user:
                # Don't reveal if username/email exists
                logger.info(f"No user found with username or email: {normalized_input}")
                return True, "If an account with that username or email exists, a reset link has been sent"
            
            logger.info(f"Found user: {user.username}, email: {user.email}")
            
            if not user.email:
                logger.warning(f"User {user.username} has no email for password reset")
                return False, "This account doesn't have an email for password reset"
            
            # Generate token and store its hash (not the plaintext)
            token = UserAuthService.generate_reset_token()
            user.reset_token = UserAuthService.hash_token(token)

            # Store expiry time - convert to naive datetime for storage in DB
            expiry_time = get_est_timedelta(hours=24)
            if expiry_time.tzinfo is not None:
                user.reset_token_expires = expiry_time.replace(tzinfo=None)
            else:
                user.reset_token_expires = expiry_time

            db.commit()
            logger.info(f"Created reset token for user {user.username}")

            # Generate reset URL (plaintext token is sent to user, hash is stored)
            base_url = "https://dev-wishlist.ariahive.top" #Change to your actual base URL in production, this is okay for development
            reset_url = f"{base_url}/reset-password/{token}"
            
            # Send reset email
            try:
                email_service = EmailService(db)
                email_log = email_service.send_password_reset_email(user, reset_url)
                logger.info(f"Password reset email sent, status: {email_log.status}")
                
                if email_log.status != 'sent':
                    logger.error(f"Email sending failed: {email_log.error_message}")
            except Exception as email_err:
                logger.exception(f"Error sending reset email: {str(email_err)}")
                # Continue the process even if email fails - the token is still valid
            
            return True, "If an account with that username or email exists, a reset link has been sent"
                
        except Exception as e:
            db.rollback()
            logger.exception("Password reset token creation failed")
            return False, f"Error creating reset token: {str(e)}"
    
    @staticmethod
    def validate_reset_token(db: Session, token: str) -> Tuple[bool, str, Optional[models.FamilyMember]]:
        """
        Validate a reset token.
        Returns tuple of (success, message, user_object)
        """
        try:
            # Hash the incoming token to compare with stored hash
            token_hash = UserAuthService.hash_token(token)
            user = db.query(models.FamilyMember).filter(models.FamilyMember.reset_token == token_hash).first()
            
            if not user:
                return False, "Invalid or expired reset token", None
            
            # Check if token is expired - handle timezone aware comparison
            if not user.reset_token_expires:
                return False, "Reset token has expired", None
                
            # Convert naive datetime to aware datetime for comparison
            current_time = get_est_timestamp()
            if user.reset_token_expires.tzinfo is None:
                # Make the naive datetime timezone-aware by assuming it's in EST
                eastern = pytz.timezone('US/Eastern')
                expiry_time = eastern.localize(user.reset_token_expires)
            else:
                expiry_time = user.reset_token_expires
                
            if expiry_time < current_time:
                return False, "Reset token has expired", None
            
            return True, "Token is valid", user
                
        except Exception as e:
            logger.exception("Token validation failed")
            return False, f"Error validating token: {str(e)}", None
    
    @staticmethod
    def reset_password(db: Session, token: str, new_password: str) -> Tuple[bool, str]:
        """
        Reset a user's password using a token.
        Returns tuple of (success, message)
        """
        try:
            # Validate the token
            valid, message, user = UserAuthService.validate_reset_token(db, token)
            
            if not valid:
                return False, message
            
            # Update password and clear token
            user.password_hash = UserAuthService.get_password_hash(new_password)
            user.reset_token = None
            user.reset_token_expires = None
            
            db.commit()
            
            return True, "Password has been reset successfully"
                
        except Exception as e:
            db.rollback()
            logger.exception("Password reset failed")
            return False, f"Error resetting password: {str(e)}"
    
    @staticmethod
    def register_new_user(db: Session, user_data: schemas.UserRegisterRequest) -> Tuple[bool, str, Optional[models.FamilyMember]]:
        """
        Register a new user.
        Returns tuple of (success, message, user_object)
        """
        try:
            # Normalize username to lowercase
            normalized_username = user_data.username.lower().strip()
            
            # Check if username already exists (case insensitive)
            existing_user = db.query(models.FamilyMember).filter(func.lower(models.FamilyMember.username) == normalized_username).first()
            if existing_user:
                logger.info("Registration rejected: username already exists")
                # Normalize error message to avoid account enumeration
                return False, "Registration failed", None
            
            # Check if email already exists (if provided) - case insensitive
            if user_data.email:
                normalized_email = user_data.email.lower().strip()
                existing_email = db.query(models.FamilyMember).filter(func.lower(models.FamilyMember.email) == normalized_email).first()
                if existing_email:
                    logger.info("Registration rejected: email already exists")
                    # Normalize error message to avoid account enumeration
                    return False, "Registration failed", None
            
            # Create new user with normalized username
            new_user = models.FamilyMember(
                name=user_data.name,
                username=normalized_username,  # Store username in lowercase
                password_hash=UserAuthService.get_password_hash(user_data.password),
                email=user_data.email.lower().strip() if user_data.email else None,  # Store email in lowercase
                birthday=user_data.birthday.isoformat() if user_data.birthday else None,
                is_admin=False  # Regular users can't register as admin
            )
            
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            
            return True, "User registered successfully", new_user
                
        except Exception as e:
            db.rollback()
            logger.exception("User registration failed")
            return False, f"Error registering user: {str(e)}", None
