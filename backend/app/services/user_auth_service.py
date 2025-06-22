# backend/app/services/user_auth_service.py
from typing import Optional, Tuple
import logging
import secrets
import string
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from passlib.context import CryptContext
from .. import models, schemas, auth
from ..utils.timezone_utils import get_est_timestamp, get_est_timedelta

logger = logging.getLogger(__name__)

# Configure password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserAuthService:
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against a hash."""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def get_password_hash(password: str) -> str:
        """Generate a hash of the password."""
        return pwd_context.hash(password)
    
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
                return False, "Invalid username or password", None
                
            if not user.password_hash:
                return False, "User account is not set up for password authentication", None
                
            if not UserAuthService.verify_password(password, user.password_hash):
                return False, "Invalid username or password", None
            
            return True, "Authentication successful", user
                
        except Exception as e:
            logger.exception("User authentication failed")
            return False, f"Authentication error: {str(e)}", None
    
    @staticmethod
    def generate_reset_token() -> str:
        """Generate a secure token for password reset."""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(64))
    
    @staticmethod
    def create_reset_token(db: Session, username_or_email: str) -> Tuple[bool, str]:
        """
        Create a password reset token for a user.
        Returns tuple of (success, message)
        """
        try:
            # Normalize input for case insensitive comparison
            normalized_input = username_or_email.lower().strip()
            
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
                return True, "If an account with that username or email exists, a reset link has been sent"
            
            if not user.email:
                return False, "This account doesn't have an email for password reset"
            
            # Generate token
            token = UserAuthService.generate_reset_token()
            user.reset_token = token
            user.reset_token_expires = get_est_timedelta(hours=1)
            
            db.commit()
            
            # In a real app, we'd send an email here
            # For now, just log the token for demonstration
            logger.info(f"Reset token generated for user {user.username} (not shown for security)")
            
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
            # Find user by token
            user = db.query(models.FamilyMember).filter(models.FamilyMember.reset_token == token).first()
            
            if not user:
                return False, "Invalid or expired reset token", None
            
            # Check if token is expired
            if not user.reset_token_expires or user.reset_token_expires < get_est_timestamp():
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
                return False, "Username already exists", None
            
            # Check if email already exists (if provided) - case insensitive
            if user_data.email:
                normalized_email = user_data.email.lower().strip()
                existing_email = db.query(models.FamilyMember).filter(func.lower(models.FamilyMember.email) == normalized_email).first()
                if existing_email:
                    return False, "Email already in use", None
            
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
