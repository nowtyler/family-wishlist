# backend/app/services/emergency_token_service.py
import os
import json
import secrets
from datetime import datetime
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import logging

logger = logging.getLogger(__name__)

class EmergencyTokenService:
    """Service for managing emergency access tokens in encrypted file storage"""
    
    def __init__(self, config_dir: str = "./data"):
        self.config_dir = config_dir
        self.config_file = os.path.join(config_dir, "emergency_config.enc")
        self.key_file = os.path.join(config_dir, "emergency_key.key")
        
        # Ensure directory exists
        os.makedirs(config_dir, exist_ok=True)
        
        # Initialize encryption key
        self._ensure_encryption_key()
    
    def _ensure_encryption_key(self):
        """Ensure encryption key exists, create if not"""
        if not os.path.exists(self.key_file):
            # Generate a new encryption key
            key = Fernet.generate_key()
            with open(self.key_file, 'wb') as f:
                f.write(key)
            logger.info("Created new emergency token encryption key")
    
    def _get_encryption_key(self) -> bytes:
        """Get the encryption key from file"""
        try:
            with open(self.key_file, 'rb') as f:
                return f.read()
        except FileNotFoundError:
            logger.error("Encryption key file not found")
            raise Exception("Emergency token encryption key not found")
    
    def _encrypt_data(self, data: str) -> bytes:
        """Encrypt string data"""
        key = self._get_encryption_key()
        fernet = Fernet(key)
        return fernet.encrypt(data.encode())
    
    def _decrypt_data(self, encrypted_data: bytes) -> str:
        """Decrypt data back to string"""
        key = self._get_encryption_key()
        fernet = Fernet(key)
        return fernet.decrypt(encrypted_data).decode()
    
    def generate_token(self) -> str:
        """Generate a new emergency access token"""
        return secrets.token_urlsafe(32)
    
    def save_token(self, token: str) -> bool:
        """Save emergency token to encrypted file"""
        try:
            config_data = {
                "emergency_token": token,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            encrypted_data = self._encrypt_data(json.dumps(config_data))
            
            with open(self.config_file, 'wb') as f:
                f.write(encrypted_data)
            
            logger.info("Emergency token saved to encrypted file")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save emergency token: {e}")
            return False
    
    def get_token(self) -> str | None:
        """Get emergency token from encrypted file"""
        try:
            if not os.path.exists(self.config_file):
                logger.warning("Emergency token file does not exist")
                return None
            
            with open(self.config_file, 'rb') as f:
                encrypted_data = f.read()
            
            decrypted_data = self._decrypt_data(encrypted_data)
            config_data = json.loads(decrypted_data)
            
            return config_data.get("emergency_token")
            
        except Exception as e:
            logger.error(f"Failed to read emergency token: {e}")
            return None
    
    def update_token(self, new_token: str) -> bool:
        """Update existing emergency token"""
        try:
            # Get existing config or create new
            config_data = {}
            if os.path.exists(self.config_file):
                try:
                    with open(self.config_file, 'rb') as f:
                        encrypted_data = f.read()
                    decrypted_data = self._decrypt_data(encrypted_data)
                    config_data = json.loads(decrypted_data)
                except:
                    # If we can't read existing, start fresh
                    pass
            
            # Update with new token
            config_data.update({
                "emergency_token": new_token,
                "updated_at": datetime.utcnow().isoformat()
            })
            
            # If no created_at, add it
            if "created_at" not in config_data:
                config_data["created_at"] = datetime.utcnow().isoformat()
            
            encrypted_data = self._encrypt_data(json.dumps(config_data))
            
            with open(self.config_file, 'wb') as f:
                f.write(encrypted_data)
            
            logger.info("Emergency token updated in encrypted file")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update emergency token: {e}")
            return False
    
    def token_exists(self) -> bool:
        """Check if emergency token file exists and is readable"""
        try:
            token = self.get_token()
            return token is not None and len(token) > 0
        except:
            return False
    
    def get_token_info(self) -> dict | None:
        """Get full token information including metadata"""
        try:
            if not os.path.exists(self.config_file):
                return None
            
            with open(self.config_file, 'rb') as f:
                encrypted_data = f.read()
            
            decrypted_data = self._decrypt_data(encrypted_data)
            config_data = json.loads(decrypted_data)
            
            # Don't return the actual token, just metadata
            return {
                "exists": True,
                "created_at": config_data.get("created_at"),
                "updated_at": config_data.get("updated_at"),
                "has_token": bool(config_data.get("emergency_token"))
            }
            
        except Exception as e:
            logger.error(f"Failed to get token info: {e}")
            return None
