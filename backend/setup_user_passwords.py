#!/usr/bin/env python
# backend/setup_user_passwords.py
#
# This script sets up default passwords for existing users
# It should be run once after deploying the password system update

import os
import sys
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import FamilyMember
from app.services.user_auth_service import UserAuthService

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Get database URL from environment or use default
DATABASE_URL = os.getenv("WISHLIST_DATABASE_URL", "sqlite:///./data/wishlist.db")

def main():
    try:
        logger.info(f"Connecting to database: {DATABASE_URL}")
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()

        # Get all users without a password hash
        users = db.query(FamilyMember).filter(FamilyMember.password_hash == None).all()
        logger.info(f"Found {len(users)} users without passwords")

        # For each user, set a default username and password
        for user in users:
            # Create a username from the name (lowercase, spaces to underscores)
            if not user.username:
                username = user.name.lower().replace(' ', '_')
                # Check if username exists, append number if needed
                suffix = 1
                base_username = username
                while db.query(FamilyMember).filter(FamilyMember.username == username).first():
                    username = f"{base_username}{suffix}"
                    suffix += 1
                
                user.username = username
                logger.info(f"Set username for {user.name}: {username}")
            
            # Set a default password (their name + "123")
            if not user.password_hash:
                default_password = f"{user.name.replace(' ', '')}123"
                user.password_hash = UserAuthService.get_password_hash(default_password)
                logger.info(f"Set default password for {user.name} (username: {user.username})")
                
                # In a real system, you might want to mark these accounts as needing password change
                # user.requires_password_change = True
        
        # Special handling for admin
        admin = db.query(FamilyMember).filter(FamilyMember.is_admin == True).first()
        if admin:
            admin.username = "admin"
            # Use the FAMILY_PASSWORD_HASH for admin if available, otherwise set a default
            family_password_hash = os.getenv("FAMILY_PASSWORD_HASH")
            if family_password_hash:
                admin.password_hash = family_password_hash
                logger.info("Set admin password to the family password")
            else:
                admin.password_hash = UserAuthService.get_password_hash("Admin123!")
                logger.info("Set default admin password")
        
        # Commit changes
        db.commit()
        logger.info("Successfully updated all users with default credentials")
        
    except Exception as e:
        logger.error(f"Error setting up user passwords: {str(e)}")
        return 1
        
    return 0

if __name__ == "__main__":
    sys.exit(main())
