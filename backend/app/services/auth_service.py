from typing import Tuple
import logging
from .. import auth

logger = logging.getLogger(__name__)

class AuthenticationService:
    @staticmethod
    def verify_family_password(password: str) -> Tuple[bool, str]:
        """
        Verifies the family password and returns a tuple of (success, message)
        """
        try:
            if not password:
                return False, "Password cannot be empty"
            
            is_valid = auth.verify_password(password)
            
            if is_valid:
                return True, "Password verified successfully"
            else:
                return False, "Incorrect family password"
                
        except Exception as e:
            logger.exception("Password verification failed")
            return False, f"Authentication error: {str(e)}"
