# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException, status, Header, Request, Body, Path, Query
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text, or_
from typing import List, Optional, Dict, Any
import logging
import traceback
import os
from datetime import datetime, timedelta
from pydantic import BaseModel
from urllib.parse import urlparse  # Add this missing import
import alembic.script  # Import for script directory access
from . import crud, models, schemas, auth, database
from .database import (
    engine, 
    create_db_and_tables, 
    get_db, 
    SessionLocal, 
    SQLALCHEMY_DATABASE_URL
)
from .deps import get_client_ip, validate_password_strength
from .services.auth_service import AuthenticationService
from .services.migration_service import MigrationService
from .services.backup_service import BackupService
from .services.url_scraper import ProductScraper
from .services.user_auth_service import UserAuthService
from .services.email_service import EmailService
from .services.turnstile import verify_turnstile
from .middleware.rate_limiter import RateLimiter
from .middleware.login_rate_limiter import login_rate_limiter, RateLimitEvent
from .middleware.auth_rate_limiter import register_rate_limiter, password_reset_rate_limiter
from .deps import validate_password_strength
import secrets
import psutil
import json
import time
import pytz
from .utils.timezone_utils import get_est_timestamp, get_est_timestamp_iso, get_est_timestamp_strftime, get_est_date, get_est_timedelta
from .utils.passphrase_utils import generate_passphrase, encrypt_passphrase, decrypt_passphrase, verify_passphrase
from .schemas import MaintenanceBroadcastRequest, UpdateNoticeBroadcastRequest

# Initialize the product scraper service
product_scraper = ProductScraper()

# Create database tables on startup
# In a more complex app, you'd use Alembic migrations for this.
# For simplicity here, we create them if they don't exist.
# This should ideally be run by an entrypoint script or a separate command.
# database.Base.metadata.create_all(bind=engine)
# We will call create_db_and_tables() from startup event

tags_metadata = [
    {
        "name": "Authentication",
        "description": "Family password verification endpoints"
    },
    {
        "name": "Family Members",
        "description": "Operations with family members"
    },
    {
        "name": "Wishlist Items",
        "description": "CRUD operations for wishlist items"
    },
    {
        "name": "Comments",
        "description": "Manage comments on wishlist items"
    },
    {
        "name": "Gift Reminders",
        "description": "Upcoming events and gift reminders"
    },
    {
        "name": "System",
        "description": "System configuration and version management"
    }
]

# Add environment info to the application
import os
ENVIRONMENT = os.getenv("ENVIRONMENT", "production").lower()
IS_DEV = ENVIRONMENT != "production"  # Any non-production env is treated as dev
DATABASE_PATH = os.getenv("WISHLIST_DATABASE_URL", "sqlite:///./data/wishlist.db")

# Enhanced API documentation
app = FastAPI(
    title="Family Wishlist API",
    description="""
    A family wishlist application API that allows family members to:
    * Create and manage wishlists
    * Mark items as "thinking about" or "purchased"
    * Add comments on wishlist items
    * Track upcoming events and gift reminders
    """ + (f"\n\n**DEVELOPMENT ENVIRONMENT** - Using database: {DATABASE_PATH}" if IS_DEV else ""),
    version="1.0.0",
    openapi_tags=tags_metadata,
    contact={
        "name": "Your Name",
        "email": "your.email@example.com",
    },
    license_info={
        "name": "Private",
    },
)

# CORS (Cross-Origin Resource Sharing)
# Allow our frontend (running on a different port during development) to talk to the backend.
origins = [
    "http://localhost",
    "http://localhost:5173",
    "http://localhost:5175",  # Vite dev server alternate port
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:8001",  # Dev backend port
    "http://localhost:8888",  # Add local Docker testing port
    "http://192.168.50.48:5175",  # Local network dev access
    "https://wishlist.ariahive.top",
    "http://wishlist.ariahive.top",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

# TODO: Security improvements for production:
# 1. Add CSRF protection for state-changing operations
# 2. Implement input sanitization middleware
# 3. Add request/response validation
# 4. Consider API key authentication for admin endpoints
# 5. Add security headers (HSTS, CSP, etc.)

# Initialize rate limiter
rate_limiter = RateLimiter(requests_per_minute=300, burst_allowance=150)


# --- App Startup ---
@app.on_event("startup")
async def startup_event():
    try:
        # Create the database and tables
        create_db_and_tables()
        
        # Initialize family members from .env if they don't exist
        db = SessionLocal()
        try:
            crud.initialize_family_members(db)
            # Cleanup deprecated emergency access config if it exists
            try:
                removed = db.query(models.SystemConfig).filter(
                    models.SystemConfig.key == "emergency_access_key"
                ).delete(synchronize_session=False)
                if removed:
                    db.commit()
                    logger.info("Removed deprecated emergency_access_key config row(s)")
            except Exception as cleanup_error:
                db.rollback()
                logger.error(f"Failed to remove deprecated emergency_access_key config: {cleanup_error}")
        except Exception as e:
            logger.error(f"Failed to initialize family members: {e}")
            # Don't block app startup - we'll handle admin access separately
        finally:
            db.close()
        
        # Initialize migration service for system_settings tracking
        try:
            from .services.migration_service import MigrationService
            migration_service = MigrationService(DATABASE_PATH)

            # Initialize system_settings table and schema hash if needed
            # This is critical for first-time setup to prevent migration loops
            try:
                initialized = migration_service.initialize_system_settings_if_needed()
                if initialized:
                    logger.info("Initialized system_settings table during startup")
            except Exception as e:
                logger.error(f"Failed to initialize system_settings table: {e}")

            # NOTE: Auto-migration on startup is DISABLED to prevent empty migration spam
            # Migrations should be created manually via the Admin UI when needed
            # The manual migration in database.py handles the first_login column addition
        except Exception as e:
            logger.warning(f"Migration service not available during startup: {e}")
        
        logger.info("Family Wishlist API startup complete. Database and tables checked/created.")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
        logger.info(f"WARNING: Database initialization error: {e}")
        # Continue startup despite errors
    
    await rate_limiter.start_cleanup()

    # Start the login-specific rate limiter (with n8n webhook integration)
    await login_rate_limiter.start()

# Add rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    try:
        await rate_limiter.check_rate_limit(request)
    except HTTPException as e:
        if e.status_code == 429:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": e.detail,
                    "timestamp": get_est_timestamp_iso(),
                }
            )
        raise
    response = await call_next(request)
    return response

# Enhanced error responses
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "timestamp": get_est_timestamp_iso(),
            "path": request.url.path
        }
    )

# --- Authentication ---
logger = logging.getLogger(__name__)

# --- Family Members ---
# The "current_user_id" will be passed from the frontend after user selection.
# It's not a secure "logged-in" session user ID but rather context for display.
def get_current_user_id_from_header(x_current_user_id: Optional[int] = Header(None)) -> Optional[int]:
    if x_current_user_id is None:
        # For some public endpoints or if user context isn't strictly needed for a route.
        return None
    return x_current_user_id

@app.get("/api/family-members",
    response_model=List[schemas.FamilyMember],
    tags=["Family Members"],
    summary="Get all family members"
)
def read_family_members(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=100, description="Maximum number of records to return"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """
    Retrieve family members who share at least one household with the current user.
    """
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current user context (X-Current-User-Id header) is required.")
    
    # Get current user to check if admin
    current_user = crud.get_family_member(db, current_user_id)
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    is_admin = current_user.name.lower() == 'admin'
    
    if is_admin:
        # Admin can see all family members
        members = crud.get_family_members(db)
    else:
        # Regular users see all members who share ANY household with them
        try:
            # Get all households the current user is in
            current_user_households_query = db.query(models.user_household_association.c.household_id).filter(
                models.user_household_association.c.user_id == current_user_id,
                models.user_household_association.c.status == 'active'
            )
            current_user_households = {row[0] for row in current_user_households_query.all()}

            if not current_user_households:
                # If user has no households, they can only see themselves
                members = [current_user]
            else:
                # Get all users who are in ANY of the user's households
                household_member_ids_query = db.query(models.user_household_association.c.user_id).filter(
                    models.user_household_association.c.household_id.in_(current_user_households),
                    models.user_household_association.c.status == 'active'
                ).distinct()
                household_member_ids = {row[0] for row in household_member_ids_query.all()}

                # Get family members who share at least one household
                members = db.query(models.FamilyMember).filter(
                    models.FamilyMember.id.in_(household_member_ids)
                ).all()

        except Exception as e:
            logger.error(f"Error filtering family members by household for user {current_user_id}: {e}")
            # Fallback: only show current user
            members = [current_user]
    
    member_ids = [m.id for m in members]

    # Batch query: wishlist item counts per member
    item_counts = dict(
        db.query(models.WishlistItem.owner_id, func.count(models.WishlistItem.id))
        .filter(models.WishlistItem.owner_id.in_(member_ids))
        .group_by(models.WishlistItem.owner_id)
        .all()
    )

    # Batch query: household counts per member
    household_counts = dict(
        db.query(
            models.user_household_association.c.user_id,
            func.count(models.user_household_association.c.household_id)
        )
        .filter(models.user_household_association.c.user_id.in_(member_ids))
        .group_by(models.user_household_association.c.user_id)
        .all()
    )

    # Batch query: external wishlist counts per member
    ext_counts = dict(
        db.query(models.ExternalWishlist.owner_id, func.count(models.ExternalWishlist.id))
        .filter(models.ExternalWishlist.owner_id.in_(member_ids))
        .group_by(models.ExternalWishlist.owner_id)
        .all()
    )

    # Batch query: household details per member (active only)
    household_rows = (
        db.query(
            models.user_household_association.c.user_id,
            models.Household.id,
            models.Household.name
        )
        .join(models.Household, models.Household.id == models.user_household_association.c.household_id)
        .filter(
            models.user_household_association.c.user_id.in_(member_ids),
            models.user_household_association.c.status == 'active'
        )
        .all()
    )
    households_by_member = {}
    for user_id, h_id, h_name in household_rows:
        households_by_member.setdefault(user_id, []).append({"id": h_id, "name": h_name})

    members_with_counts = []
    for member in members:
        member_dict = {
            "id": member.id,
            "name": member.name,
            "birthday": member.birthday,
            "is_admin": member.is_admin,
            "preferences": member.preferences,
            "username": member.username,
            "email": member.email,
            "force_password_change": member.force_password_change,
            "first_login": member.first_login,
            "wishlist_item_count": item_counts.get(member.id, 0),
            "external_wishlist_count": ext_counts.get(member.id, 0),
            "household_count": household_counts.get(member.id, 0),
            "households": households_by_member.get(member.id, [])
        }
        member_schema = schemas.FamilyMember.model_validate(member_dict)
        members_with_counts.append(member_schema)
    return members_with_counts


@app.get("/api/family-members/{member_id}", response_model=schemas.FamilyMember)
def read_family_member(member_id: int, db: Session = Depends(get_db)):
    db_member = crud.get_family_member(db, member_id=member_id)
    if db_member is None:
        raise HTTPException(status_code=404, detail="Family member not found")
    count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == db_member.id).count()
    external_wishlist_count = db.query(models.ExternalWishlist).filter(models.ExternalWishlist.owner_id == db_member.id).count()
    household_count = db.query(models.user_household_association).filter(
        models.user_household_association.c.user_id == db_member.id
    ).count()
    member_households = db.query(models.Household).join(
        models.user_household_association,
        models.Household.id == models.user_household_association.c.household_id
    ).filter(
        models.user_household_association.c.user_id == db_member.id,
        models.user_household_association.c.status == 'active'
    ).all()
    households_data = [{"id": h.id, "name": h.name} for h in member_households]

    member_dict = {
        "id": db_member.id,
        "name": db_member.name,
        "birthday": db_member.birthday,
        "is_admin": db_member.is_admin,
        "preferences": db_member.preferences,
        "username": db_member.username,
        "email": db_member.email,
        "force_password_change": db_member.force_password_change,
        "first_login": db_member.first_login,
        "tutorial_status": db_member.tutorial_status,
        "wishlist_item_count": count,
        "external_wishlist_count": external_wishlist_count,
        "household_count": household_count,
        "households": households_data
    }
    return schemas.FamilyMember.model_validate(member_dict)


@app.post("/api/family-members", response_model=schemas.FamilyMember)
def create_family_member(
    member: schemas.FamilyMemberCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Create a new family member (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or user.name.lower() != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    # Create the family member
    try:
        db_member = crud.create_family_member(db, member)
        count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == db_member.id).count()
        member_schema = schemas.FamilyMember.from_orm(db_member)
        member_schema.wishlist_item_count = count
        return member_schema
    except Exception as e:
        logger.error(f"Failed to create family member: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to create family member: {str(e)}")

@app.post("/api/admin/users", response_model=schemas.AdminUserResponse)
def create_user_with_auth(
    user_data: schemas.AdminUserCreateRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Create a new user with authentication details (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or user.name.lower() != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    # Validate password strength
    if not validate_password_strength(user_data.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters and include uppercase, lowercase, and numbers"
        )
    
    # Create the user with authentication details
    try:
        db_member = crud.create_family_member_with_auth(db, user_data)
        count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == db_member.id).count()
        member_schema = schemas.FamilyMember.from_orm(db_member)
        member_schema.wishlist_item_count = count
        
        return {
            "success": True,
            "message": "User created successfully",
            "user": member_schema
        }
    except ValueError as e:
        logger.error(f"Failed to create user: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create user: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to create user: {str(e)}")

@app.put("/api/admin/users/{member_id}", response_model=schemas.AdminUserResponse)
def update_user_with_auth(
    member_id: int,
    user_update: schemas.AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Update a user with authentication details (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or user.name.lower() != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    # Validate password strength if password is being updated
    if user_update.password and not validate_password_strength(user_update.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters and include uppercase, lowercase, and numbers"
        )
    
    # Update the user with authentication details
    try:
        db_member = crud.update_family_member_with_auth(db, member_id, user_update)
        if not db_member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        # Send password changed notification email if password was updated and user has email
        if user_update.password and db_member.email:
            try:
                email_service = EmailService(db)
                email_service.send_password_changed_email(db_member)
                logger.info(f"Password change notification email sent to {db_member.email}")
            except Exception as email_err:
                logger.error(f"Failed to send password change email: {str(email_err)}")
                # Continue even if email fails
        
        count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == db_member.id).count()
        member_schema = schemas.FamilyMember.from_orm(db_member)
        member_schema.wishlist_item_count = count
        
        return {
            "success": True,
            "message": "User updated successfully",
            "user": member_schema
        }
    except ValueError as e:
        logger.error(f"Failed to update user: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update user: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to update user: {str(e)}")

@app.put("/api/users/{member_id}/profile", response_model=schemas.AdminUserResponse)
def update_user_profile(
    member_id: int,
    user_update: schemas.AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Update a user's own profile (user can only update their own profile)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check if user is updating their own profile
    if current_user_id != member_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update your own profile")
    
    # Get the current user
    user = crud.get_family_member(db, current_user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Ensure email is provided
    if user_update.email is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required")
    
    # Validate password strength if password is being updated
    if user_update.password and not validate_password_strength(user_update.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters and include uppercase, lowercase, and numbers"
        )
    
    # Update the user with authentication details
    try:
        db_member = crud.update_family_member_with_auth(db, member_id, user_update)
        if not db_member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        # Send password changed notification email if password was updated
        if user_update.password and db_member.email:
            try:
                email_service = EmailService(db)
                email_service.send_password_changed_email(db_member)
                logger.info(f"Password change notification email sent to {db_member.email}")
            except Exception as email_err:
                logger.error(f"Failed to send password change email: {str(email_err)}")
                # Continue even if email fails
        
        count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == db_member.id).count()
        member_schema = schemas.FamilyMember.from_orm(db_member)
        member_schema.wishlist_item_count = count
        
        return {
            "success": True,
            "message": "Profile updated successfully",
            "user": member_schema
        }
    except ValueError as e:
        logger.error(f"Failed to update profile: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update profile: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to update profile: {str(e)}")

@app.put("/api/family-members/{member_id}", response_model=schemas.FamilyMember)
def update_family_member(
    member_id: int,
    member_update: schemas.FamilyMemberUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Update a family member (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or user.name.lower() != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    # Update the family member
    try:
        db_member = crud.update_family_member(db, member_id, member_update)
        if not db_member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
        
        count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == db_member.id).count()
        member_schema = schemas.FamilyMember.from_orm(db_member)
        member_schema.wishlist_item_count = count
        return member_schema
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update family member: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to update family member: {str(e)}")

@app.delete("/api/family-members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_family_member(
    member_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Delete a family member and all their wishlist items (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or user.name.lower() != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    # Prevent deleting the admin user
    target_member = crud.get_family_member(db, member_id)
    if not target_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
        
    if target_member.name.lower() == 'admin':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete the admin user")
    
    # Delete the family member
    try:
        if crud.delete_family_member(db, member_id):
            return Response(status_code=status.HTTP_204_NO_CONTENT)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
    except Exception as e:
        logger.error(f"Failed to delete family member: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to delete family member: {str(e)}")

# --- Wishlist Items ---
def check_admin_or_owner(db: Session, user_id: int, owner_id: int) -> bool:
    user = crud.get_family_member(db, user_id)
    return user and (user.name.lower() == 'admin' or user_id == owner_id)

@app.post("/api/members/{owner_id}/items", 
    response_model=schemas.WishlistItem,
    responses={
        400: {"description": "Invalid input"},
        403: {"description": "Not authorized to add items"},
        429: {"description": "Too many requests"}
    },
    tags=["Wishlist Items"],
    summary="Create a new wishlist item",
    description="Create a new wishlist item for a specific family member."
)
def create_item_for_member(
    owner_id: int = Path(..., description="The ID of the wishlist owner"),
    item: schemas.WishlistItemCreate = Body(..., description="The item to create"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """
    Create a new wishlist item with the following features:
    - Validates input data
    - Checks authorization
    - Rate limited to prevent abuse
    - Returns the created item
    
    The user must be either:
    - The owner of the wishlist
    - An admin user
    """
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Allow if admin or owner
    if not check_admin_or_owner(db, current_user_id, owner_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only add items to your own wishlist unless you're an admin."
        )
    
    db_member = crud.get_family_member(db, member_id=owner_id)
    if not db_member:
        raise HTTPException(status_code=404, detail="Owner (family member) not found")
    
    created_item = crud.create_wishlist_item(db=db, item=item, owner_id=owner_id)
    return schemas.WishlistItem(
        id=created_item.id,
        title=created_item.title,
        description=created_item.description,
        link=str(created_item.link) if created_item.link else None,
        image_url=str(created_item.image_url) if created_item.image_url else None,
        priority=created_item.priority,
        price=created_item.price,  # Make sure price is included
        owner_id=created_item.owner_id,
        is_purchased=created_item.is_purchased,
        thinking_about_by_list=[],
        comments=[]
    )

@app.get("/api/members/{owner_id}/items", response_model=List[schemas.WishlistItem])
def read_items_for_member(
    owner_id: int,
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(200, ge=1, le=500, description="Maximum number of items to return"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header) # Who is viewing
):
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current user context (X-Current-User-Id header) is required.")

    db_member = crud.get_family_member(db, member_id=owner_id)
    if not db_member:
        raise HTTPException(status_code=404, detail="Family member not found")

    # crud function handles hiding purchased items from owner and comments
    items = crud.get_wishlist_items_by_owner(db, owner_id=owner_id, current_user_id=current_user_id)
    return items[skip:skip + limit]

@app.put("/api/items/{item_id}", response_model=schemas.WishlistItem)
def update_item(
    item_id: int,
    item_update: schemas.WishlistItemUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required.")

    db_item = crud.get_wishlist_item(db, item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Log the raw update data for debugging
    logger.debug(f"Update data received: {item_update.dict()}")
    
    # Process the update data - similar to create logic
    update_data = item_update.dict(exclude_unset=True)
    
    # Handle price conversion the same way as in create_wishlist_item
    if 'price' in update_data and update_data['price'] is not None:
        try:
            # Store price in cents as integer
            update_data['price'] = int(float(update_data['price']) * 100)
            logger.debug(f"Processed price: {update_data['price']} cents")
        except (ValueError, TypeError) as e:
            logger.error(f"Price conversion error: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid price format: {str(e)}")
    
    # Update the item with processed data
    updated_item = crud.update_wishlist_item(db, item_id, schemas.WishlistItemUpdate(**update_data), current_user_id)
    if not updated_item:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own items unless you're an admin."
        )

    reloaded_items = crud.get_wishlist_items_by_owner(db, owner_id=updated_item.owner_id, current_user_id=current_user_id)
    updated_item_schema = next((i for i in reloaded_items if i.id == item_id), None)
    if not updated_item_schema:
        raise HTTPException(status_code=500, detail="Failed to reconstruct item view after update.")
    
    return updated_item_schema

@app.patch("/api/items/{item_id}/toggle-thinking", response_model=schemas.WishlistItem)
def toggle_thinking_about_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required.")
    
    try:
        updated_item_model = crud.toggle_thinking_about(db, item_id, current_user_id)
        if not updated_item_model:
            raise HTTPException(status_code=404, detail="Item not found or operation not allowed (e.g., owner trying to mark own item).")

        # Similar to update, reconstruct the view
        reloaded_items = crud.get_wishlist_items_by_owner(db, owner_id=updated_item_model.owner_id, current_user_id=current_user_id)
        updated_item_schema = next((i for i in reloaded_items if i.id == item_id), None)
        if not updated_item_schema:
            raise HTTPException(status_code=500, detail="Failed to reconstruct item view after toggling 'thinking about'.")
        return updated_item_schema
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling thinking about: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@app.patch("/api/items/{item_id}/toggle-purchased", response_model=schemas.WishlistItem)
def toggle_item_purchased(
    item_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required.")
    
    updated_item_model = crud.toggle_item_purchased(db, item_id, current_user_id)
    if not updated_item_model:
        raise HTTPException(status_code=404, detail="Item not found or operation not allowed.")

    reloaded_items = crud.get_wishlist_items_by_owner(db, owner_id=updated_item_model.owner_id, current_user_id=current_user_id)
    updated_item_schema = next((i for i in reloaded_items if i.id == item_id), None)
    if not updated_item_schema:
         raise HTTPException(status_code=500, detail="Failed to reconstruct item view after toggling purchase status.")
    return updated_item_schema

@app.delete("/api/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required.")

    if crud.delete_wishlist_item(db, item_id, current_user_id):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Item not found or not authorized to delete."
    )

@app.delete("/api/members/{owner_id}/items", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_items(
    owner_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required.")

    if crud.delete_all_wishlist_items(db, owner_id, current_user_id):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized to delete all items."
    )

@app.get("/api/members/{owner_id}/export", response_model=schemas.WishlistExport)
def export_wishlist(
    owner_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Export a member's wishlist to a portable format"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required.")
    
    # Check if user is authorized (owner or admin)
    if not check_admin_or_owner(db, current_user_id, owner_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only export your own wishlist unless you're an admin."
        )
    
    # Get all items for the owner
    items = crud.get_wishlist_items_by_owner(db, owner_id=owner_id, current_user_id=current_user_id)
    
    # Create export data
    export_data = {
        "items": [
            {
                "title": item.title,
                "description": item.description,
                "link": str(item.link) if item.link else None,
                "image_url": str(item.image_url) if item.image_url else None,
                "priority": item.priority,
                "price": item.price
            }
            for item in items
        ],
        "export_date": datetime.utcnow().isoformat(),
        "version": "1.0"
    }
    
    return schemas.WishlistExport(**export_data)

@app.post("/api/members/{owner_id}/import", response_model=schemas.WishlistImportResponse)
def import_wishlist(
    owner_id: int,
    wishlist_data: schemas.WishlistExport,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Import items from a wishlist export file"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required.")
    
    # Check if user is authorized (owner or admin)
    if not check_admin_or_owner(db, current_user_id, owner_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only import to your own wishlist unless you're an admin."
        )
    
    # Validate version compatibility
    if not wishlist_data.version.startswith("1."):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported wishlist format version: {wishlist_data.version}"
        )
    
    # Get existing items for duplicate checking
    existing_items = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == owner_id).all()
    
    imported_items = []
    skipped_items = []
    for item_data in wishlist_data.items:
        try:
            # Check for exact duplicate
            is_duplicate = any(
                existing_item.title == item_data.title and
                existing_item.description == item_data.description and
                (str(existing_item.link) if existing_item.link else None) == (str(item_data.link) if item_data.link else None) and
                (str(existing_item.image_url) if existing_item.image_url else None) == (str(item_data.image_url) if item_data.image_url else None) and
                existing_item.priority == item_data.priority and
                existing_item.price == item_data.price
                for existing_item in existing_items
            )
            
            if is_duplicate:
                skipped_items.append(item_data.title)
                continue
                
            # Create item if not a duplicate
            # Note: price is already in cents from the export file, so we use WishlistItemCreate's fields directly
            item_create = schemas.WishlistItemCreate(
                title=item_data.title,
                description=item_data.description,
                link=item_data.link,
                image_url=item_data.image_url,
                priority=item_data.priority,
                price_in_cents=item_data.price  # Use a new field that bypasses the dollars-to-cents conversion
            )
            db_item = crud.create_wishlist_item(db=db, item=item_create, owner_id=owner_id)
            
            # Get the created item in the standard response format
            items = crud.get_wishlist_items_by_owner(db, owner_id=owner_id, current_user_id=current_user_id)
            created_item = next((i for i in items if i.id == db_item.id), None)
            if created_item:
                imported_items.append(created_item)
                
        except Exception as e:
            logger.error(f"Failed to import item: {str(e)}")
            # Continue with next item if one fails
            continue
    
    if not imported_items and not skipped_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to import any items from the file."
        )
    
    return schemas.WishlistImportResponse(
        imported_items=imported_items,
        skipped_items=skipped_items
    )

# --- Comments ---
@app.post("/api/items/{item_id}/comments", 
    response_model=schemas.Comment,
    status_code=status.HTTP_201_CREATED
)
def add_comment_to_item(
    item_id: int,
    comment_data: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    if current_user_id is None:
        raise HTTPException(status_code=403, detail="User context required")
    
    try:
        # Get the item to check if it exists and if user owns it
        item = crud.get_wishlist_item(db, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Check if the user is admin
        user = crud.get_family_member(db, current_user_id)
        is_admin = user and user.name.lower() == 'admin'
        
        # Allow admins to comment on any items, including their own
        if not is_admin and item.owner_id == current_user_id:
            raise HTTPException(status_code=400, detail="Cannot comment on your own items")

        comment = crud.create_comment(db, item_id, text=comment_data.text, author_id=current_user_id)
        
        # Get author name for response
        author = crud.get_family_member(db, current_user_id)
        
        return schemas.Comment(
            id=comment.id,
            text=comment.text,
            author_id=current_user_id,
            author_name=author.name if author else "Unknown",
            item_id=item_id,
            created_at=comment.created_at  # Use the actual timestamp from the database
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    if current_user_id is None:
        raise HTTPException(status_code=403, detail="User context required")

    user = crud.get_family_member(db, current_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Allow deletion if admin or comment author
    is_admin = user.name.lower() == 'admin'
    if is_admin or comment.author_id == current_user_id:
        db.delete(comment)
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

# --- Gift Reminder ---
@app.get("/api/upcoming-event", response_model=Optional[schemas.UpcomingEventResponse])
def get_upcoming_gift_event(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current user context (X-Current-User-Id header) is required.")
    
    event = crud.get_next_gift_event(db, current_user_id)
    if not event:
        return None # Or some default message like {"event_name": "All caught up!", "display_text": ""}
    
    display_text = ""
    if event.days_until == 0:
        display_text = "is TODAY!"
    elif event.days_until == 1:
        display_text = "is TOMORROW!"
    elif event.days_until < 0: # Should not happen if logic is correct
        display_text = "has passed."
    else:
        display_text = f"is in {event.days_until} days ({event.date.strftime('%b %d')})"

    return schemas.UpcomingEventResponse(event_name=event.name, display_text=display_text)


# --- Version Management ---
class VersionUpdate(BaseModel):
    version: str

@app.get("/api/system/version")
def get_version(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    try:
        return {"version": crud.get_system_version(db)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/system/version")
def update_version(
    version_update: VersionUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Update the system version - accessible by admin only"""
    if current_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User context required"
        )

    try:
        # First get the user
        user = crud.get_family_member(db, current_user_id)
        if not user:
            # Special case - if user not found but ID is 1, try to get admin
            if current_user_id == 1:
                # Try to find admin by name as fallback
                user = db.query(models.FamilyMember).filter(
                    models.FamilyMember.name.ilike('admin')
                ).first()
                
                if not user:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="User not found and admin fallback failed"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            
        # Check if user is admin (by flag OR name)
        is_admin = user.is_admin or user.name.lower() == 'admin'
        logger.debug(f"Version update check - User: {user.name}, ID: {user.id}, is_admin: {is_admin}")
        
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can update version"
            )
            
        # Update the version directly in the database
        settings = db.query(models.SystemSettings).first()
        if not settings:
            settings = models.SystemSettings(version=version_update.version)
            db.add(settings)
        else:
            settings.version = version_update.version
            settings.last_updated = datetime.utcnow().date()
        
        db.commit()
        return {"version": version_update.version}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Version update error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update version: {str(e)}"
        )

# --- Database Migrations ---
migration_service = MigrationService(SQLALCHEMY_DATABASE_URL)

@app.get("/api/admin/migrations", response_model=schemas.MigrationList)
async def get_migrations(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get list of available migrations and current version"""
    try:
        current_version = migration_service.get_current_version()
        available_migrations = migration_service.get_available_migrations()
        
        has_multiple_heads = "," in current_version
        has_pending_migrations = any(not m.applied for m in available_migrations)
        needs_upgrade = has_multiple_heads or has_pending_migrations

        return {
            "current_version": current_version,
            "available_migrations": available_migrations,
            "needs_upgrade": needs_upgrade,
            "db_version": "current"
        }
    except Exception as e:
        logger.error(f"Migration error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "current_version": "unknown",
            "available_migrations": [],
            "needs_upgrade": True,
            "db_version": "current"
        }

@app.post("/api/admin/migrations/upgrade", response_model=schemas.MigrationResponse)
async def upgrade_database(
    target: str = "head",
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Upgrade database to specified version"""
    try:
        # First check if there are multiple heads
        current_version = migration_service.get_current_version()
        if "," in current_version:
            # Attempt to merge heads first
            merge_result = migration_service.merge_heads()
            logger.info(f"Merge result: {merge_result}")
            
            # Check if merge was successful
            new_version = migration_service.get_current_version()
            if "," in new_version:
                return {
                    "success": False,
                    "message": f"Failed to merge heads: {merge_result}",
                    "new_version": new_version
                }
        else:
            # Proceed with normal upgrade
            result = migration_service.upgrade(target)
            new_version = migration_service.get_current_version()
            
            try:
                new_hash = migration_service.get_schema_hash()
                crud.update_schema_hash(db, new_hash)
            except Exception as e:
                logger.error(f"Failed to update schema hash: {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
            
            return {
                "success": "Failed" not in result,
                "message": result,
                "new_version": new_version
            }
    except Exception as e:
        logger.error(f"Migration upgrade error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Migration upgrade error: {str(e)}"
        )

@app.post("/api/admin/migrations/create", response_model=schemas.MigrationResponse)
async def create_migration(
    message: str,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Create a new migration"""
    if current_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User context required"
        )

    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        result = migration_service.create_migration(message)
        return {
            "success": "Failed" not in result,
            "message": result
        }
    except Exception as e:
        logger.error(f"Migration creation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Migration creation error: {str(e)}"
        )

@app.delete("/api/admin/migrations/{version}", response_model=schemas.MigrationResponse)
async def delete_migration(
    version: str,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Delete a migration file"""
    try:
        result = migration_service.delete_migration(version)
        return {
            "success": result[0],
            "message": result[1]
        }
    except Exception as e:
        logger.error(f"Migration deletion error: {str(e)}")
        return {
            "success": False,
            "message": f"Failed to delete migration: {str(e)}"
        }

@app.post("/api/admin/migrations/reset", response_model=schemas.MigrationResponse)
async def reset_migration_state(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Reset migration state for fresh start - Admin only"""
    try:
        # Verify admin
        user = crud.get_family_member(db, current_user_id)
        if not user or not (user.is_admin or user.name.lower() == 'admin'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can reset migration state"
            )
            
        # Create backup first
        backup_path = backup_service.create_backup(manual=True)
        logger.info(f"Created backup before reset: {backup_path}")
        
        # Reset migration state
        result = migration_service.reset_migration_state()
        
        return {
            "success": "successfully" in result.lower(),
            "message": result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Migration reset error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Migration reset error: {str(e)}"
        )

@app.post("/api/admin/migrations/hard-reset", response_model=schemas.MigrationResponse)
async def hard_reset_migration_state(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Hard reset migration state for fixing broken migrations - Admin only"""
    try:
        # Verify admin
        user = crud.get_family_member(db, current_user_id)
        if not user or not (user.is_admin or user.name.lower() == 'admin'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can reset migration state"
            )
            
        # Create backup first
        backup_path = backup_service.create_backup(manual=True)
        logger.info(f"Created backup before hard reset: {backup_path}")
        
        # Hard reset migration state
        result = migration_service.hard_reset_migrations()
        
        return {
            "success": "failed" not in result.lower(),
            "message": result,
            "new_version": migration_service.get_current_version()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Migration hard reset error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Migration hard reset error: {str(e)}"
        )

# --- Database Backup/Restore ---
backup_service = BackupService(SQLALCHEMY_DATABASE_URL.replace('sqlite:///', ''))

@app.post("/api/admin/backups/create", response_model=schemas.BackupResponse)
async def create_backup(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Create a manual backup"""
    try:
        backup_path = backup_service.create_backup(manual=True)
        return {
            "success": True,
            "message": "Backup created successfully",
            "backup_path": os.path.basename(backup_path)
        }
    except Exception as e:
        logger.error(f"Backup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")

@app.get("/api/admin/backups", response_model=schemas.BackupList)
async def list_backups(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """List available backups"""
    try:
        return {
            "backups": backup_service.get_backups(),
            "backup_directory": backup_service.backup_dir
        }
    except Exception as e:
        logger.error(f"Backup list error: {str(e)}")
        return {
            "backups": [],
            "backup_directory": backup_service.backup_dir
        }

@app.post("/api/admin/backups/restore/{filename}", response_model=schemas.RestoreResponse)
async def restore_backup(
    filename: str,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Restore from a backup"""
    try:
        if not backup_service.check_schema_compatibility(os.path.join(backup_service.backup_dir, filename)):
            return schemas.RestoreResponse(
                success=False,
                message="Database schema has changed since this backup was created",
                requires_migration=True
            )

        success, message = backup_service.restore_from_backup(filename)
        return schemas.RestoreResponse(
            success=success,
            message=message,
            requires_migration=False
        )
    except Exception as e:
        logger.error(f"Restore error: {str(e)}")
        return schemas.RestoreResponse(
            success=False,
            message=f"Restore failed: {str(e)}",
            requires_migration=False
        )

@app.delete("/api/admin/backups/{filename}", response_model=schemas.BackupResponse)
async def delete_backup(
    filename: str,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Delete a backup file"""
    try:
        success, message = backup_service.delete_backup(filename)
        return {
            "success": success,
            "message": message
        }
    except Exception as e:
        logger.error(f"Backup deletion error: {str(e)}")
        return {
            "success": False,
            "message": f"Failed to delete backup: {str(e)}"
        }

@app.get("/api/admin/schema/hash")
async def get_schema_hash(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get current schema hash for change detection"""
    try:
        return {"hash": migration_service.get_schema_hash()}
    except Exception as e:
        logger.error(f"Schema hash error: {str(e)}")
        return {"hash": None}

# More explicit health check
@app.get("/api/health")
async def health_check():
    try:
        # Test database connection - fixed SQL query format
        db = SessionLocal()
        db.execute(text("SELECT 1"))  # Use text() to properly format SQL expression
        db.close()
        
        # Return clearer environment information
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected",
            "environment": ENVIRONMENT,
            "is_dev": IS_DEV,
            "database_path": SQLALCHEMY_DATABASE_URL,
            "version": crud.get_system_version(SessionLocal())
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Service unhealthy: {str(e)}"
        )

@app.delete("/api/admin/wishlists", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_wishlists(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required.")

    if crud.delete_all_wishlists(db, current_user_id):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only admin can delete all wishlists"
    )

# Catch-all for documentation (FastAPI provides /docs and /redoc automatically)
# If you were serving a frontend from FastAPI, you'd have a catch-all route here.

@app.get("/api/system/setup-status", response_model=dict)
async def check_setup_status(db: Session = Depends(get_db)):
    """Check if the system has been set up"""
    try:
        # Check if any admin user exists
        admin_exists = db.query(models.FamilyMember).filter(models.FamilyMember.is_admin == True).first() is not None

        return {
            "is_setup_complete": admin_exists,
            "needs_admin": not admin_exists
        }
    except Exception as e:
        logger.error(f"Error checking setup status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/api/system/first-time-setup", response_model=schemas.FirstTimeSetupResponse)
async def first_time_setup(
    request: schemas.FirstTimeSetupRequest,
    db: Session = Depends(get_db)
):
    """Handle first-time system setup"""
    try:
        # Check if system is already set up
        setup_status = await check_setup_status(db)
        if setup_status["is_setup_complete"]:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="System is already set up"
            )
        
        # Create admin user
        password_hash = auth.get_password_hash(request.admin_password)
        admin = models.FamilyMember(
            name=request.admin_name,
            username=request.admin_username,
            password_hash=password_hash,
            email=request.admin_email,
            is_admin=True
        )

        # Generate recovery passphrase for admin
        plaintext_passphrase = generate_passphrase()
        admin.recovery_passphrase_encrypted = encrypt_passphrase(plaintext_passphrase)

        db.add(admin)

        db.commit()
        db.refresh(admin)

        return schemas.FirstTimeSetupResponse(
            success=True,
            message="System setup completed successfully",
            admin_user=schemas.FamilyMember(
                id=admin.id,
                name=admin.name,
                username=admin.username,
                email=admin.email,
                is_admin=admin.is_admin,
                wishlist_item_count=0
            ),
            recovery_passphrase=plaintext_passphrase
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"First-time setup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during system setup"
        )


# --- Admin Recovery Passphrase Endpoints ---

@app.get("/api/admin/recovery-passphrase",
    response_model=schemas.RecoveryPassphraseResponse,
    tags=["Admin"],
    summary="View recovery passphrase"
)
async def get_recovery_passphrase(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """View the current admin recovery passphrase (admin only)."""
    if not current_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    admin = db.query(models.FamilyMember).filter(
        models.FamilyMember.id == current_user_id,
        models.FamilyMember.is_admin == True
    ).first()

    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    if not admin.recovery_passphrase_encrypted:
        raise HTTPException(status_code=404, detail="No recovery passphrase has been set")

    try:
        plaintext = decrypt_passphrase(admin.recovery_passphrase_encrypted)
        return schemas.RecoveryPassphraseResponse(success=True, passphrase=plaintext)
    except Exception as e:
        logger.error(f"Failed to decrypt recovery passphrase: {e}")
        raise HTTPException(status_code=500, detail="Failed to decrypt recovery passphrase")


@app.post("/api/admin/recovery-passphrase/regenerate",
    response_model=schemas.RecoveryPassphraseResponse,
    tags=["Admin"],
    summary="Regenerate recovery passphrase"
)
async def regenerate_recovery_passphrase(
    request: schemas.RegeneratePassphraseRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Regenerate the admin recovery passphrase (requires current password)."""
    if not current_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    admin = db.query(models.FamilyMember).filter(
        models.FamilyMember.id == current_user_id,
        models.FamilyMember.is_admin == True
    ).first()

    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Verify current password
    if not admin.password_hash or not auth.verify_password(request.current_password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    # Generate new passphrase
    plaintext = generate_passphrase()
    admin.recovery_passphrase_encrypted = encrypt_passphrase(plaintext)
    db.commit()

    auth.log_auth_event("PASSPHRASE_REGENERATED", admin.username, True, details="Admin regenerated recovery passphrase")
    return schemas.RecoveryPassphraseResponse(success=True, passphrase=plaintext)


# Add this new endpoint after other item endpoints
@app.post("/api/items/fetch-url-details")
async def fetch_url_details(
    url_data: dict,
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Fetch product details from a URL"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required.")
    
    url = url_data.get("url")
    if not url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="URL is required")
    
    try:
        # Make sure the URL is valid
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        # Check if this is Etsy or another problematic site that needs browser scraping
        parsed_url = urlparse(url)
        domain = parsed_url.netloc.lower()
        
        if 'etsy.com' in domain:
            # Use async browser scraping for Etsy
            product_details = await product_scraper.fetch_product_details_async(url)
        else:
            # Use normal scraping for other sites
            product_details = product_scraper.fetch_product_details(url)
        
        if "error" in product_details:
            # Return a 200 response with the error info instead of raising an exception
            return {
                "error": product_details["error"],
                "url": url,
                "message": "Unable to automatically import product details. Please enter them manually."
            }
        
        # Ensure the URL is included
        product_details["url"] = url
        return product_details
    
    except Exception as e:
        logger.error(f"Error fetching URL details: {str(e)}")
        return {
            "error": f"Failed to fetch product details: {str(e)}",
            "url": url,
            "message": "Unable to automatically import product details. Please enter them manually."
        }

# --- External Wishlists ---
@app.get("/api/members/{owner_id}/external-wishlists", response_model=List[schemas.ExternalWishlist])
def get_external_wishlists_for_member(
    owner_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get all external wishlists for a specific member (household-based access control)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    db_member = crud.get_family_member(db, member_id=owner_id)
    if not db_member:
        raise HTTPException(status_code=404, detail="Family member not found")
    
    # Check household-based access control
    current_user = crud.get_family_member(db, current_user_id)
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    is_admin = current_user.name.lower() == 'admin'
    
    # Skip household check for admin users or if viewing own wishlists
    if not is_admin and current_user_id != owner_id:
        # Check if users share any households
        try:
            # Get current user's household IDs
            current_user_households_query = db.query(models.user_household_association.c.household_id).filter(
                models.user_household_association.c.user_id == current_user_id,
                models.user_household_association.c.status == 'active'
            )
            current_user_households = {row[0] for row in current_user_households_query.all()}
            
            # Get owner's household IDs  
            owner_households_query = db.query(models.user_household_association.c.household_id).filter(
                models.user_household_association.c.user_id == owner_id,
                models.user_household_association.c.status == 'active'
            )
            owner_households = {row[0] for row in owner_households_query.all()}
            
            # Check if they share any households
            shared_households = current_user_households.intersection(owner_households)
            
            # If no shared households, deny access
            if not shared_households:
                logger.info(f"User {current_user_id} denied access to user {owner_id}'s external wishlists (no shared households)")
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: no shared households")
                
        except HTTPException:
            raise  # Re-raise HTTP exceptions
        except Exception as e:
            logger.error(f"Error checking household access for user {current_user_id} viewing user {owner_id}: {e}")
            # If household check fails, deny access (fallback security)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    
    return crud.get_external_wishlists(db, owner_id=owner_id)

@app.post("/api/members/{owner_id}/external-wishlists", response_model=schemas.ExternalWishlist)
def create_external_wishlist_for_member(
    owner_id: int,
    wishlist: schemas.ExternalWishlistCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Create a new external wishlist link for a member"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Check authorization (owner or admin)
    user = crud.get_family_member(db, current_user_id)
    is_admin = user and user.name.lower() == 'admin'
    
    if not is_admin and current_user_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    
    db_member = crud.get_family_member(db, member_id=owner_id)
    if not db_member:
        raise HTTPException(status_code=404, detail="Owner (family member) not found")
    
    try:
        return crud.create_external_wishlist(db=db, wishlist=wishlist, owner_id=owner_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create external wishlist: {str(e)}")

@app.put("/api/external-wishlists/{wishlist_id}", response_model=schemas.ExternalWishlist)
def update_external_wishlist(
    wishlist_id: int, 
    wishlist: schemas.ExternalWishlistUpdate, 
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Update an existing external wishlist link"""
    if current_user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = SessionLocal()
    try:
        updated_wishlist = crud.update_external_wishlist(
            db=db,
            wishlist_id=wishlist_id,
            wishlist_update=wishlist,
            current_user_id=current_user_id
        )
        
        if updated_wishlist is None:
            raise HTTPException(
                status_code=404, 
                detail="External wishlist not found or you don't have permission to update it"
            )
            
        return updated_wishlist
    finally:
        db.close()

@app.delete("/api/external-wishlists/{wishlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_external_wishlist_endpoint(
    wishlist_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    if crud.delete_external_wishlist(db, wishlist_id, current_user_id):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="External wishlist not found or you're not authorized to delete it"
    )


# --- Shared Wishlist External Wishlists ---

@app.get("/api/shared-wishlists/{wishlist_id}/external-wishlists", response_model=List[schemas.ExternalWishlist])
def get_shared_wishlist_external_wishlists(
    wishlist_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get all external wishlists for a shared wishlist"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    # Verify shared wishlist exists
    shared_wl = db.query(models.SharedWishlist).filter(models.SharedWishlist.id == wishlist_id).first()
    if not shared_wl:
        raise HTTPException(status_code=404, detail="Shared wishlist not found")

    return crud.get_shared_wishlist_external_wishlists(db, shared_wishlist_id=wishlist_id)


@app.post("/api/shared-wishlists/{wishlist_id}/external-wishlists", response_model=schemas.ExternalWishlist)
def create_shared_wishlist_external_wishlist(
    wishlist_id: int,
    wishlist: schemas.ExternalWishlistCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Create a new external wishlist link for a shared wishlist (owners only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    # Verify shared wishlist exists
    shared_wl = db.query(models.SharedWishlist).filter(models.SharedWishlist.id == wishlist_id).first()
    if not shared_wl:
        raise HTTPException(status_code=404, detail="Shared wishlist not found")

    # Check authorization: must be owner of the shared wishlist or admin
    user = crud.get_family_member(db, current_user_id)
    is_admin = user and user.name.lower() == 'admin'
    owners = crud.get_shared_wishlist_owners(db, wishlist_id)
    is_owner = any(o.id == current_user_id for o in owners)

    if not is_admin and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can add external wishlists")

    try:
        return crud.create_shared_wishlist_external_wishlist(db=db, wishlist=wishlist, shared_wishlist_id=wishlist_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create external wishlist: {str(e)}")


# --- Shared Wishlists (Kid Wishlists) ---

@app.get("/api/shared-wishlists", response_model=List[schemas.SharedWishlist])
def get_shared_wishlists(
    include_all: bool = Query(False),
    skip: int = Query(0, ge=0, description="Number of wishlists to skip"),
    limit: int = Query(100, ge=1, le=200, description="Maximum number of wishlists to return"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get all shared wishlists (filtered by user's households unless admin requests all)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    if include_all:
        user = crud.get_family_member(db, current_user_id)
        if not user or not user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
        wishlists = crud.get_all_shared_wishlists(db, user_id=None)
    else:
        wishlists = crud.get_all_shared_wishlists(db, user_id=current_user_id)
    if not wishlists:
        return []

    wishlist_ids = [w.id for w in wishlists]

    # Batch load item counts
    item_counts_q = db.query(
        models.SharedWishlistItem.wishlist_id,
        func.count(models.SharedWishlistItem.id)
    ).filter(
        models.SharedWishlistItem.wishlist_id.in_(wishlist_ids)
    ).group_by(models.SharedWishlistItem.wishlist_id).all()
    item_counts = dict(item_counts_q)

    # Batch load external wishlist counts
    ext_counts_q = db.query(
        models.ExternalWishlist.shared_wishlist_id,
        func.count(models.ExternalWishlist.id)
    ).filter(
        models.ExternalWishlist.shared_wishlist_id.in_(wishlist_ids)
    ).group_by(models.ExternalWishlist.shared_wishlist_id).all()
    ext_counts = dict(ext_counts_q)

    # Batch load owners
    owners_q = db.query(
        models.shared_wishlist_owners.c.wishlist_id,
        models.FamilyMember
    ).join(
        models.FamilyMember,
        models.FamilyMember.id == models.shared_wishlist_owners.c.user_id
    ).filter(
        models.shared_wishlist_owners.c.wishlist_id.in_(wishlist_ids)
    ).all()
    owners_map = {}
    for wid, owner in owners_q:
        owners_map.setdefault(wid, []).append(owner)

    # Batch load households
    household_ids = [w.household_id for w in wishlists if w.household_id]
    households_map = {}
    if household_ids:
        households = db.query(models.Household).filter(models.Household.id.in_(household_ids)).all()
        households_map = {h.id: h.name for h in households}

    result = []
    for wishlist in wishlists:
        owners = owners_map.get(wishlist.id, [])
        result.append(schemas.SharedWishlist(
            id=wishlist.id,
            name=wishlist.name,
            description=wishlist.description,
            household_id=wishlist.household_id,
            household_name=households_map.get(wishlist.household_id),
            occasion_date=wishlist.occasion_date,
            occasion_type=wishlist.occasion_type,
            wishlist_type=wishlist.wishlist_type or "normal",
            created_at=wishlist.created_at,
            created_by=wishlist.created_by,
            owner_count=len(owners),
            item_count=item_counts.get(wishlist.id, 0),
            external_wishlist_count=ext_counts.get(wishlist.id, 0),
            owners=[schemas.SharedWishlistOwner(
                id=o.id,
                name=o.name,
                username=o.username
            ) for o in owners]
        ))
    return result[skip:skip + limit]


@app.post("/api/shared-wishlists", response_model=schemas.SharedWishlist, status_code=status.HTTP_201_CREATED)
def create_shared_wishlist(
    wishlist: schemas.SharedWishlistCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Create a new shared wishlist (e.g., for a kid)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    db_wishlist = crud.create_shared_wishlist(db, wishlist, current_user_id)
    owners = crud.get_shared_wishlist_owners(db, db_wishlist.id)

    # Get household name if household_id is set
    household_name = None
    if db_wishlist.household_id:
        household = db.query(models.Household).filter(models.Household.id == db_wishlist.household_id).first()
        if household:
            household_name = household.name

    return schemas.SharedWishlist(
        id=db_wishlist.id,
        name=db_wishlist.name,
        description=db_wishlist.description,
        household_id=db_wishlist.household_id,
        household_name=household_name,
        occasion_date=db_wishlist.occasion_date,
        occasion_type=db_wishlist.occasion_type,
        wishlist_type=db_wishlist.wishlist_type or "normal",
        created_at=db_wishlist.created_at,
        created_by=db_wishlist.created_by,
        owner_count=len(owners),
        item_count=0,
        owners=[schemas.SharedWishlistOwner(
            id=o.id,
            name=o.name,
            username=o.username
        ) for o in owners]
    )


@app.get("/api/shared-wishlists/{wishlist_id}", response_model=schemas.SharedWishlistWithItems)
def get_shared_wishlist(
    wishlist_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get a shared wishlist with its items"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    db_wishlist = crud.get_shared_wishlist(db, wishlist_id)
    if not db_wishlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared wishlist not found")

    # Check access - must be owner, in same household, or admin
    is_owner = crud.is_shared_wishlist_owner(db, wishlist_id, current_user_id)
    user = crud.get_family_member(db, current_user_id)
    is_admin = user and user.is_admin

    if not is_owner and not is_admin:
        # Match the shared wishlist list and item visibility rules:
        # allow access when user shares at least one active household with any owner.
        owners = crud.get_shared_wishlist_owners(db, wishlist_id)
        owner_ids = [o.id for o in owners]

        current_user_households = {
            row[0] for row in db.query(models.user_household_association.c.household_id).filter(
                models.user_household_association.c.user_id == current_user_id,
                models.user_household_association.c.status == 'active'
            ).all()
        }
        owner_households = {
            row[0] for row in db.query(models.user_household_association.c.household_id).filter(
                models.user_household_association.c.user_id.in_(owner_ids),
                models.user_household_association.c.status == 'active'
            ).all()
        }

        if not current_user_households.intersection(owner_households):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    owners = crud.get_shared_wishlist_owners(db, wishlist_id)
    items = crud.get_shared_wishlist_items(db, wishlist_id, current_user_id)

    # Get household name if household_id is set
    household_name = None
    if db_wishlist.household_id:
        household = db.query(models.Household).filter(models.Household.id == db_wishlist.household_id).first()
        if household:
            household_name = household.name

    return schemas.SharedWishlistWithItems(
        id=db_wishlist.id,
        name=db_wishlist.name,
        description=db_wishlist.description,
        household_id=db_wishlist.household_id,
        household_name=household_name,
        occasion_date=db_wishlist.occasion_date,
        occasion_type=db_wishlist.occasion_type,
        wishlist_type=db_wishlist.wishlist_type or "normal",
        created_at=db_wishlist.created_at,
        created_by=db_wishlist.created_by,
        owner_count=len(owners),
        item_count=len(items),
        owners=[schemas.SharedWishlistOwner(
            id=o.id,
            name=o.name,
            username=o.username
        ) for o in owners],
        items=items
    )


@app.put("/api/shared-wishlists/{wishlist_id}", response_model=schemas.SharedWishlist)
def update_shared_wishlist(
    wishlist_id: int,
    wishlist_update: schemas.SharedWishlistUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Update a shared wishlist (owners only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    db_wishlist = crud.update_shared_wishlist(db, wishlist_id, wishlist_update, current_user_id)
    if not db_wishlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared wishlist not found or you're not authorized to update it"
        )

    owners = crud.get_shared_wishlist_owners(db, wishlist_id)
    item_count = db.query(models.SharedWishlistItem).filter(
        models.SharedWishlistItem.wishlist_id == wishlist_id
    ).count()

    # Get household name if household_id is set
    household_name = None
    if db_wishlist.household_id:
        household = db.query(models.Household).filter(models.Household.id == db_wishlist.household_id).first()
        if household:
            household_name = household.name

    return schemas.SharedWishlist(
        id=db_wishlist.id,
        name=db_wishlist.name,
        description=db_wishlist.description,
        household_id=db_wishlist.household_id,
        household_name=household_name,
        occasion_date=db_wishlist.occasion_date,
        occasion_type=db_wishlist.occasion_type,
        wishlist_type=db_wishlist.wishlist_type or "normal",
        created_at=db_wishlist.created_at,
        created_by=db_wishlist.created_by,
        owner_count=len(owners),
        item_count=item_count,
        owners=[schemas.SharedWishlistOwner(
            id=o.id,
            name=o.name,
            username=o.username
        ) for o in owners]
    )


@app.delete("/api/shared-wishlists/{wishlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shared_wishlist(
    wishlist_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Delete a shared wishlist (creator or admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    if not crud.delete_shared_wishlist(db, wishlist_id, current_user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared wishlist not found or you're not authorized to delete it"
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/shared-wishlists/{wishlist_id}/owners", response_model=schemas.SharedWishlistOwner)
def add_shared_wishlist_owner(
    wishlist_id: int,
    request: schemas.AddOwnerRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Add a co-owner to a shared wishlist by username"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    new_owner = crud.add_shared_wishlist_owner(db, wishlist_id, request.username, current_user_id)
    if not new_owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or you're not authorized to add owners"
        )

    return schemas.SharedWishlistOwner(
        id=new_owner.id,
        name=new_owner.name,
        username=new_owner.username
    )


@app.delete("/api/shared-wishlists/{wishlist_id}/owners/{owner_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_shared_wishlist_owner(
    wishlist_id: int,
    owner_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Remove an owner from a shared wishlist"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    if not crud.remove_shared_wishlist_owner(db, wishlist_id, owner_id, current_user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove owner. Either not authorized, owner not found, or this is the last owner."
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Shared Wishlist Items ---

@app.get("/api/shared-wishlists/{wishlist_id}/items", response_model=List[schemas.SharedWishlistItem])
def get_shared_wishlist_items(
    wishlist_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get items from a shared wishlist"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    items = crud.get_shared_wishlist_items(db, wishlist_id, current_user_id)
    return items


@app.post("/api/shared-wishlists/{wishlist_id}/items", response_model=schemas.SharedWishlistItem, status_code=status.HTTP_201_CREATED)
def create_shared_wishlist_item(
    wishlist_id: int,
    item: schemas.SharedWishlistItemCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Add an item to a shared wishlist (owners only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    db_item = crud.create_shared_wishlist_item(db, wishlist_id, item, current_user_id)
    if not db_item:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You're not authorized to add items to this wishlist"
        )

    thinking_by_list = db_item.thinking_about_by.split(',') if db_item.thinking_about_by else []

    return schemas.SharedWishlistItem(
        id=db_item.id,
        wishlist_id=db_item.wishlist_id,
        title=db_item.title,
        description=db_item.description,
        link=str(db_item.link) if db_item.link else None,
        image_url=str(db_item.image_url) if db_item.image_url else None,
        priority=db_item.priority,
        price=db_item.price,
        is_purchased=db_item.is_purchased,
        purchased_by=db_item.purchased_by,
        thinking_about_by_list=thinking_by_list,
        created_at=db_item.created_at,
        created_by=db_item.created_by
    )


@app.delete("/api/shared-wishlists/{wishlist_id}/items", status_code=status.HTTP_204_NO_CONTENT)
def delete_shared_wishlist_items(
    wishlist_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Delete all items from a shared wishlist (owners only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    if not crud.delete_all_shared_wishlist_items(db, wishlist_id, current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You're not authorized to clear items from this wishlist"
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.put("/api/shared-wishlist-items/{item_id}", response_model=schemas.SharedWishlistItem)
def update_shared_wishlist_item(
    item_id: int,
    item_update: schemas.SharedWishlistItemUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Update a shared wishlist item (owners only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    db_item = crud.update_shared_wishlist_item(db, item_id, item_update, current_user_id)
    if not db_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found or you're not authorized to update it"
        )

    thinking_by_list = db_item.thinking_about_by.split(',') if db_item.thinking_about_by else []

    return schemas.SharedWishlistItem(
        id=db_item.id,
        wishlist_id=db_item.wishlist_id,
        title=db_item.title,
        description=db_item.description,
        link=str(db_item.link) if db_item.link else None,
        image_url=str(db_item.image_url) if db_item.image_url else None,
        priority=db_item.priority,
        price=db_item.price,
        is_purchased=db_item.is_purchased,
        purchased_by=db_item.purchased_by,
        thinking_about_by_list=thinking_by_list,
        created_at=db_item.created_at,
        created_by=db_item.created_by
    )


@app.delete("/api/shared-wishlist-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shared_wishlist_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Delete a shared wishlist item (owners only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    if not crud.delete_shared_wishlist_item(db, item_id, current_user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found or you're not authorized to delete it"
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.patch("/api/shared-wishlist-items/{item_id}/toggle-thinking", response_model=schemas.SharedWishlistItem)
def toggle_shared_item_thinking(
    item_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Toggle 'thinking about' status for a shared wishlist item (non-owners only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    db_item = crud.toggle_shared_item_thinking_about(db, item_id, current_user_id)
    if not db_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot toggle thinking about status. Item not found or you are an owner."
        )

    thinking_by_list = db_item.thinking_about_by.split(',') if db_item.thinking_about_by else []

    return schemas.SharedWishlistItem(
        id=db_item.id,
        wishlist_id=db_item.wishlist_id,
        title=db_item.title,
        description=db_item.description,
        link=str(db_item.link) if db_item.link else None,
        image_url=str(db_item.image_url) if db_item.image_url else None,
        priority=db_item.priority,
        price=db_item.price,
        is_purchased=db_item.is_purchased,
        purchased_by=db_item.purchased_by,
        thinking_about_by_list=thinking_by_list,
        created_at=db_item.created_at,
        created_by=db_item.created_by
    )


@app.patch("/api/shared-wishlist-items/{item_id}/toggle-purchased", response_model=schemas.SharedWishlistItem)
def toggle_shared_item_purchased(
    item_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Toggle purchased status for a shared wishlist item (non-owners only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    db_item = crud.toggle_shared_item_purchased(db, item_id, current_user_id)
    if not db_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot toggle purchased status. Item not found, you are an owner, or item was purchased by someone else."
        )

    thinking_by_list = db_item.thinking_about_by.split(',') if db_item.thinking_about_by else []

    return schemas.SharedWishlistItem(
        id=db_item.id,
        wishlist_id=db_item.wishlist_id,
        title=db_item.title,
        description=db_item.description,
        link=str(db_item.link) if db_item.link else None,
        image_url=str(db_item.image_url) if db_item.image_url else None,
        priority=db_item.priority,
        price=db_item.price,
        is_purchased=db_item.is_purchased,
        purchased_by=db_item.purchased_by,
        thinking_about_by_list=thinking_by_list,
        created_at=db_item.created_at,
        created_by=db_item.created_by
    )


# --- Shared Wishlist Export/Import ---

@app.get("/api/shared-wishlists/{wishlist_id}/export", response_model=schemas.WishlistExport)
def export_shared_wishlist(
    wishlist_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Export a shared wishlist to a portable format (owners only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required.")

    # Check if user is an owner
    if not crud.is_shared_wishlist_owner(db, wishlist_id, current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an owner to export this shared wishlist."
        )

    # Get all items for the shared wishlist
    items = crud.get_shared_wishlist_items(db, wishlist_id, current_user_id)

    # Create export data
    export_data = {
        "items": [
            {
                "title": item.title,
                "description": item.description,
                "link": str(item.link) if item.link else None,
                "image_url": str(item.image_url) if item.image_url else None,
                "priority": item.priority,
                "price": item.price
            }
            for item in items
        ],
        "export_date": datetime.utcnow().isoformat(),
        "version": "1.0"
    }

    return schemas.WishlistExport(**export_data)


@app.post("/api/shared-wishlists/{wishlist_id}/import", response_model=schemas.WishlistImportResponse)
def import_shared_wishlist(
    wishlist_id: int,
    wishlist_data: schemas.WishlistExport,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Import items into a shared wishlist (owners only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required.")

    # Check if user is an owner
    if not crud.is_shared_wishlist_owner(db, wishlist_id, current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an owner to import to this shared wishlist."
        )

    # Validate version compatibility
    if not wishlist_data.version.startswith("1."):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported wishlist format version: {wishlist_data.version}"
        )

    # Get existing items for duplicate checking
    existing_items = db.query(models.SharedWishlistItem).filter(
        models.SharedWishlistItem.wishlist_id == wishlist_id
    ).all()

    imported_items = []
    skipped_items = []
    for item_data in wishlist_data.items:
        try:
            # Check for exact duplicate
            is_duplicate = any(
                existing_item.title == item_data.title and
                existing_item.description == item_data.description and
                (str(existing_item.link) if existing_item.link else None) == (str(item_data.link) if item_data.link else None) and
                (str(existing_item.image_url) if existing_item.image_url else None) == (str(item_data.image_url) if item_data.image_url else None) and
                existing_item.priority == item_data.priority and
                existing_item.price == item_data.price
                for existing_item in existing_items
            )

            if is_duplicate:
                skipped_items.append(item_data.title)
                continue

            # Create item if not a duplicate
            # Convert price from cents (in export) to dollars for the schema
            price_in_dollars = item_data.price / 100 if item_data.price else None
            item_create = schemas.SharedWishlistItemCreate(
                title=item_data.title,
                description=item_data.description,
                link=item_data.link,
                image_url=item_data.image_url,
                priority=item_data.priority,
                price=price_in_dollars
            )
            db_item = crud.create_shared_wishlist_item(db, wishlist_id, item_create, current_user_id)

            if db_item:
                # For shared wishlist imports, return minimal item data compatible with WishlistImportResponse
                imported_items.append({
                    'id': db_item.id,
                    'title': db_item.title,
                    'description': db_item.description,
                    'link': str(db_item.link) if db_item.link else None,
                    'image_url': str(db_item.image_url) if db_item.image_url else None,
                    'priority': db_item.priority,
                    'price': db_item.price,
                    'owner_id': current_user_id,  # Use current user as the "owner" for response schema
                    'is_purchased': False  # New imported items are not purchased
                })

        except Exception as e:
            logger.error(f"Failed to import shared wishlist item: {str(e)}")
            # Continue with next item if one fails
            continue

    if not imported_items and not skipped_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to import any items from the file."
        )

    return schemas.WishlistImportResponse(
        imported_items=imported_items,
        skipped_items=skipped_items
    )


@app.post("/api/shared-wishlist-items/{item_id}/comments", response_model=schemas.SharedWishlistItemComment)
def add_shared_wishlist_item_comment(
    item_id: int,
    comment: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Add a comment to a shared wishlist item. Non-creators and admin can comment."""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    # Get the shared item
    shared_item = db.query(models.SharedWishlistItem).filter(models.SharedWishlistItem.id == item_id).first()
    if not shared_item:
        raise HTTPException(status_code=404, detail="Shared wishlist item not found")

    # Get the current user
    current_user = crud.get_family_member(db, current_user_id)
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    is_admin = current_user.name.lower() == 'admin'

    # Match standard wishlist behavior:
    # item creators cannot comment on their own items unless they are admin.
    if shared_item.created_by == current_user_id and not is_admin:
        raise HTTPException(status_code=400, detail="Item creators cannot comment on their own shared wishlist items")

    # Create the comment
    db_comment = crud.create_shared_wishlist_item_comment(db, item_id, comment.text, current_user_id)
    if not db_comment:
        raise HTTPException(status_code=400, detail="Failed to create comment")

    return schemas.SharedWishlistItemComment(
        id=db_comment.id,
        author_id=db_comment.author_id,
        author_name=current_user.name,
        shared_item_id=db_comment.shared_item_id,
        text=db_comment.text,
        created_at=db_comment.created_at
    )


@app.put("/api/members/{member_id}/preferences", response_model=schemas.FamilyMember)
def update_member_preferences(
    member_id: int,
    preferences_update: schemas.FamilyMemberPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Update a family member's preferences"""
    if current_user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Admin can edit anyone's preferences
    user = crud.get_family_member(db, current_user_id)
    is_admin = user and user.name.lower() == 'admin'
    
    # Check authorization - only allow self-update or admin
    if current_user_id != member_id and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="You can only update your own preferences"
        )
    
    # Update preferences
    member = crud.update_member_preferences(
        db=db,
        member_id=member_id,
        preferences=preferences_update.preferences
    )
    
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Get current wishlist count for response
    count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == member.id).count()
    member_schema = schemas.FamilyMember.from_orm(member)
    member_schema.wishlist_item_count = count
    
    return member_schema

@app.post("/api/members/{member_id}/complete-tutorial")
def complete_tutorial(
    member_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Mark tutorial as completed for the current user by setting first_login to false"""
    if current_user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Only allow users to mark their own tutorial as completed
    if current_user_id != member_id:
        raise HTTPException(
            status_code=403,
            detail="You can only mark your own tutorial as completed"
        )

    # Get the member
    member = crud.get_family_member(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Update tutorial_status to "completed" and first_login to False for backward compatibility
    member.tutorial_status = "completed"
    member.first_login = False
    db.add(member)
    db.commit()
    db.refresh(member)

    # Get current wishlist count for response
    count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == member.id).count()
    member_data = {
        "id": member.id,
        "name": member.name,
        "birthday": member.birthday,
        "is_admin": member.is_admin,
        "preferences": member.preferences,
        "username": member.username,
        "email": member.email,
        "force_password_change": member.force_password_change,
        "first_login": member.first_login,
        "tutorial_status": member.tutorial_status,
        "wishlist_item_count": count,
        "households": []
    }
    return schemas.FamilyMember(**member_data)

@app.post("/api/members/{member_id}/skip-tutorial")
def skip_tutorial(
    member_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Mark tutorial as skipped for the current user by setting tutorial_status to skipped"""
    if current_user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Only allow users to mark their own tutorial as skipped
    if current_user_id != member_id:
        raise HTTPException(
            status_code=403,
            detail="You can only mark your own tutorial as skipped"
        )

    # Get the member
    member = crud.get_family_member(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Update tutorial_status to "skipped"
    member.tutorial_status = "skipped"
    db.add(member)
    db.commit()
    db.refresh(member)

    # Get current wishlist count for response
    count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == member.id).count()
    member_data = {
        "id": member.id,
        "name": member.name,
        "birthday": member.birthday,
        "is_admin": member.is_admin,
        "preferences": member.preferences,
        "username": member.username,
        "email": member.email,
        "force_password_change": member.force_password_change,
        "first_login": member.first_login,
        "tutorial_status": member.tutorial_status,
        "wishlist_item_count": count,
        "households": []
    }
    return schemas.FamilyMember(**member_data)

@app.post("/api/members/{member_id}/reset-tutorial")
def reset_tutorial(
    member_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Reset tutorial to 'new' state to allow user to run it again"""
    if current_user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Only allow users to reset their own tutorial
    if current_user_id != member_id:
        raise HTTPException(
            status_code=403,
            detail="You can only reset your own tutorial"
        )

    # Get the member
    member = crud.get_family_member(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Update tutorial_status to "new"
    member.tutorial_status = "new"
    db.add(member)
    db.commit()
    db.refresh(member)

    # Get current wishlist count for response
    count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == member.id).count()
    member_data = {
        "id": member.id,
        "name": member.name,
        "birthday": member.birthday,
        "is_admin": member.is_admin,
        "preferences": member.preferences,
        "username": member.username,
        "email": member.email,
        "force_password_change": member.force_password_change,
        "first_login": member.first_login,
        "tutorial_status": member.tutorial_status,
        "wishlist_item_count": count,
        "households": []
    }
    return schemas.FamilyMember(**member_data)

# --- User Authentication ---
@app.post("/api/auth/login", response_model=schemas.LoginResponse)
async def login(
    request: schemas.LoginRequest,
    db: Session = Depends(get_db),
    client_ip: str = Depends(get_client_ip)
):
    """
    Authenticate a user with username and password.

    Rate limiting:
    - IP-based: 5 attempts per 15 minutes, 15-minute lockout
    - Username-based: 3 attempts per 15 minutes, progressive lockout (5min, 10min, 20min... up to 1hr)
    """
    try:
        turnstile_valid = await verify_turnstile(request.turnstile_token, client_ip)
        if not turnstile_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Turnstile verification failed.",
                    "turnstile_required": True,
                }
            )

        # Check login-specific rate limits (stricter than general API rate limiting)
        rate_limit_result = login_rate_limiter.check_rate_limit(client_ip, request.username)
        if not rate_limit_result.allowed:
            # Log the blocked attempt
            login_rate_limiter._log_event(
                RateLimitEvent.ATTEMPT_BLOCKED,
                client_ip,
                request.username,
                {
                    "reason": rate_limit_result.reason.value if rate_limit_result.reason else None,
                    "retry_after": rate_limit_result.retry_after,
                }
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": rate_limit_result.message or "Too many login attempts. Please try again later.",
                    "turnstile_required": True,
                    "retry_after": rate_limit_result.retry_after,
                },
                headers={"Retry-After": str(rate_limit_result.retry_after or 900)}
            )

        # Log the login attempt
        auth.log_auth_event("LOGIN_ATTEMPT", request.username, True, client_ip)

        success, message, user = UserAuthService.authenticate_user(db, request.username, request.password)

        if not success:
            # Record failed attempt for rate limiting
            login_rate_limiter.record_failed_attempt(client_ip, request.username)

            # Log failed login
            auth.log_auth_event("LOGIN", request.username, False, client_ip, message)

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=message
            )

        # Record successful login - resets rate limit counters
        login_rate_limiter.record_successful_login(client_ip, request.username)

        # Log successful login
        auth.log_auth_event("LOGIN", user.username, True, client_ip,
                            f"User ID: {user.id}, Admin: {user.is_admin}")

        household_count = db.query(models.user_household_association).filter(
            models.user_household_association.c.user_id == user.id,
            models.user_household_association.c.status == 'active'
        ).count()

        member_households = db.query(models.Household).join(
            models.user_household_association,
            models.Household.id == models.user_household_association.c.household_id
        ).filter(
            models.user_household_association.c.user_id == user.id,
            models.user_household_association.c.status == 'active'
        ).all()
        households_data = [{"id": h.id, "name": h.name} for h in member_households]

        return schemas.LoginResponse(
            success=True,
            message=message,
            user=schemas.FamilyMember(
                id=user.id,
                name=user.name,
                username=user.username,
                email=user.email,
                is_admin=user.is_admin,
                first_login=user.first_login,
                tutorial_status=user.tutorial_status or "new",
                wishlist_item_count=0,
                household_count=household_count,
                households=households_data
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        auth.log_auth_event("LOGIN_ERROR", request.username, False, client_ip, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/api/auth/register", 
    response_model=schemas.AuthResponse,
    tags=["Authentication"],
    summary="Register a new user",
    responses={
        200: {"description": "Registration successful"},
        400: {"description": "Registration failed"}
    }
)
async def register(
    user_data: schemas.UserRegisterRequest,
    db: Session = Depends(get_db),
    client_ip: str = Depends(get_client_ip)
):
    """
    Register a new user with username, password, etc.
    """
    try:
        turnstile_valid = await verify_turnstile(user_data.turnstile_token, client_ip)
        if not turnstile_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Turnstile verification failed.",
                    "turnstile_required": True,
                }
            )

        rate_limit_result = register_rate_limiter.check_rate_limit(client_ip, user_data.username)
        if not rate_limit_result.allowed:
            auth.log_auth_event("REGISTER_RATE_LIMIT", user_data.username, False, client_ip,
                                rate_limit_result.message or "Registration rate limit exceeded")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": rate_limit_result.message or "Too many registration attempts. Please try again later.",
                    "turnstile_required": True,
                    "retry_after": rate_limit_result.retry_after,
                },
                headers={"Retry-After": str(rate_limit_result.retry_after or 900)}
            )

        # Log registration attempt
        auth.log_auth_event("REGISTER_ATTEMPT", user_data.username, True, client_ip)
        register_rate_limiter.record_attempt(client_ip, user_data.username)
        
        # Validate password strength
        if not validate_password_strength(user_data.password):
            auth.log_auth_event("REGISTER", user_data.username, False, client_ip, 
                              "Password strength validation failed")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters and include uppercase, lowercase, and numbers"
            )
        
        success, message, user = UserAuthService.register_new_user(db, user_data)
        
        if success and user:
            # Log successful registration
            auth.log_auth_event("REGISTER", user.username, True, client_ip, 
                               f"User ID: {user.id}, Name: {user.name}")
            
            # Send welcome email
            try:
                email_service = EmailService(db)
                email_service.send_welcome_email(user)
            except Exception as e:
                logger.error(f"Failed to send welcome email: {e}")
                auth.log_auth_event("EMAIL_SEND", user.username, False, client_ip, 
                                  f"Failed to send welcome email: {str(e)}")
                # Don't fail registration if email fails
            
            return {
                "success": True,
                "message": "Registration successful",
                "user_id": user.id,
                "is_admin": user.is_admin
            }
        else:
            # Log failed registration
            auth.log_auth_event("REGISTER", user_data.username, False, client_ip, message)
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        auth.log_auth_event("REGISTER_ERROR", user_data.username, False, client_ip, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during registration"
        )
        
@app.post("/api/auth/reset-password/request", 
    response_model=schemas.AuthResponse,
    tags=["Authentication"],
    summary="Request a password reset",
    responses={
        200: {"description": "Reset request processed"},
        400: {"description": "Reset request failed"}
    }
)
async def request_password_reset(
    request: schemas.PasswordResetRequest,
    db: Session = Depends(get_db),
    client_ip: str = Depends(get_client_ip)
):
    """
    Request a password reset by username or email.
    """
    try:
        turnstile_valid = await verify_turnstile(request.turnstile_token, client_ip)
        if not turnstile_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Turnstile verification failed.",
                    "turnstile_required": True,
                }
            )

        rate_limit_result = password_reset_rate_limiter.check_rate_limit(client_ip, request.username_or_email)
        if not rate_limit_result.allowed:
            auth.log_auth_event("PASSWORD_RESET_RATE_LIMIT", request.username_or_email, False, client_ip,
                                rate_limit_result.message or "Password reset rate limit exceeded")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": rate_limit_result.message or "Too many password reset requests. Please try again later.",
                    "turnstile_required": True,
                    "retry_after": rate_limit_result.retry_after,
                },
                headers={"Retry-After": str(rate_limit_result.retry_after or 900)}
            )

        # Log password reset request
        auth.log_auth_event("PASSWORD_RESET_REQUEST", request.username_or_email, True, client_ip)
        password_reset_rate_limiter.record_attempt(client_ip, request.username_or_email)

        # Check if this is an admin user — admin uses passphrase verification instead of email
        admin_user = db.query(models.FamilyMember).filter(
            func.lower(models.FamilyMember.username) == request.username_or_email.lower(),
            models.FamilyMember.is_admin == True
        ).first()

        if admin_user and admin_user.recovery_passphrase_encrypted:
            auth.log_auth_event("PASSWORD_RESET_ADMIN_PASSPHRASE", request.username_or_email, True, client_ip,
                                "Admin reset requires passphrase verification")
            return {
                "success": True,
                "requires_passphrase": True,
                "message": "Admin password reset requires recovery passphrase verification."
            }

        success, message = UserAuthService.create_reset_token(db, request.username_or_email)

        # Log result
        status_msg = "Token generated and email sent" if success else "Failed to generate token"
        auth.log_auth_event("PASSWORD_RESET_TOKEN", request.username_or_email, success, client_ip, status_msg)

        return {
            "success": success,
            "message": message
        }
    except Exception as e:
        logger.error(f"Password reset request error: {str(e)}")
        auth.log_auth_event("PASSWORD_RESET_ERROR", request.username_or_email, False, client_ip, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during password reset request"
        )

@app.post("/api/auth/reset-password/confirm", 
    response_model=schemas.AuthResponse,
    tags=["Authentication"],
    summary="Confirm password reset with token",
    responses={
        200: {"description": "Password reset successful"},
        400: {"description": "Password reset failed"}
    }
)
async def confirm_password_reset(
    request: schemas.PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
    client_ip: str = Depends(get_client_ip)
):
    """
    Complete the password reset with token and new password.
    """
    try:
        # We don't have the username yet, but we'll get it during validation
        auth.log_auth_event("PASSWORD_RESET_CONFIRM", "unknown", True, client_ip, 
                           "Password reset confirmation with token")
        
        # Validate password strength
        if not validate_password_strength(request.new_password):
            auth.log_auth_event("PASSWORD_RESET_CONFIRM", "unknown", False, client_ip, 
                              "Password strength validation failed")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters and include uppercase, lowercase, and numbers"
            )
        
        # First validate the token to get the username
        valid, _, user = UserAuthService.validate_reset_token(db, request.token)
        username = user.username if valid and user else "unknown"
        
        # Now reset the password
        success, message = UserAuthService.reset_password(db, request.token, request.new_password)
        
        # Log the outcome
        auth.log_auth_event("PASSWORD_RESET_COMPLETE", username, success, client_ip, message)
        
        if success:
            return {
                "success": True,
                "message": message
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset confirmation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during password reset confirmation"
        )


@app.post("/api/auth/admin-reset-password",
    tags=["Authentication"],
    summary="Reset admin password using recovery passphrase"
)
async def admin_reset_password_with_passphrase(
    request: schemas.AdminPassphraseResetRequest,
    db: Session = Depends(get_db),
    client_ip: str = Depends(get_client_ip)
):
    """Reset the admin password by verifying the recovery passphrase."""
    try:
        turnstile_valid = await verify_turnstile(request.turnstile_token, client_ip)
        if not turnstile_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Turnstile verification failed.", "turnstile_required": True}
            )

        rate_limit_result = password_reset_rate_limiter.check_rate_limit(client_ip, "admin-passphrase")
        if not rate_limit_result.allowed:
            auth.log_auth_event("ADMIN_PASSPHRASE_RATE_LIMIT", "admin", False, client_ip,
                                rate_limit_result.message or "Rate limit exceeded")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": rate_limit_result.message or "Too many attempts. Please try again later.",
                    "turnstile_required": True,
                    "retry_after": rate_limit_result.retry_after,
                },
                headers={"Retry-After": str(rate_limit_result.retry_after or 900)}
            )

        password_reset_rate_limiter.record_attempt(client_ip, "admin-passphrase")

        # Find admin user
        admin = db.query(models.FamilyMember).filter(
            models.FamilyMember.is_admin == True
        ).first()

        if not admin or not admin.recovery_passphrase_encrypted:
            auth.log_auth_event("ADMIN_PASSPHRASE_RESET", "admin", False, client_ip, "No admin or passphrase found")
            raise HTTPException(status_code=400, detail="Recovery passphrase is not configured")

        # Verify passphrase
        if not verify_passphrase(request.passphrase, admin.recovery_passphrase_encrypted):
            auth.log_auth_event("ADMIN_PASSPHRASE_RESET", "admin", False, client_ip, "Incorrect passphrase")
            raise HTTPException(status_code=401, detail="Incorrect recovery passphrase")

        # Validate password strength
        if not validate_password_strength(request.new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters and include uppercase, lowercase, and numbers"
            )

        # Reset password
        admin.password_hash = auth.get_password_hash(request.new_password)
        db.commit()

        auth.log_auth_event("ADMIN_PASSPHRASE_RESET", admin.username, True, client_ip, "Admin password reset via passphrase")

        return {"success": True, "message": "Admin password has been reset successfully."}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin passphrase reset error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during admin password reset"
        )


@app.post("/api/admin/schema/reset-hash", response_model=schemas.MigrationResponse)
async def reset_schema_hash(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Reset the schema hash to match current model state"""
    # Verify user is admin
    try:
        user = crud.get_family_member(db, current_user_id)
        if not user or not user.is_admin:
            raise HTTPException(status_code=403, detail="Only admin can reset schema hash")
        
        # First try the comprehensive method that handles the system_settings table
        initialized = migration_service.initialize_system_settings_if_needed()
        if initialized:
            logger.info("Successfully initialized system_settings table with current hash")
            return {
                "success": True,
                "message": "Schema hash initialized successfully",
                "new_version": migration_service.get_current_version()
            }
            
        # If that didn't do anything (table already exists with non-null hash), try the regular reset
        success = migration_service.reset_schema_hash()
        if success:
            # Also update the hash in system_settings through crud
            current_hash = migration_service.get_schema_hash()
            crud.update_schema_hash(db, current_hash)
            
            logger.info(f"Schema hash reset to: {current_hash}")
            return {
                "success": True,
                "message": f"Schema hash reset successfully",
                "new_version": migration_service.get_current_version()
            }
        else:
            logger.error("Failed to reset schema hash")
            return {
                "success": False,
                "message": "Failed to reset schema hash",
                "new_version": migration_service.get_current_version()
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting schema hash: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "success": False,
            "message": f"Error: {str(e)}",
            "new_version": None
        }

@app.get("/api/admin/households", response_model=List[schemas.Household])
def get_all_households(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get all households (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # Get households with member count
        households = []
        for h in db.query(models.Household).all():
            member_count = db.query(models.user_household_association).filter(
                models.user_household_association.c.household_id == h.id
            ).count()
            household_dict = {
                "id": h.id,
                "name": h.name,
                "description": h.description,
                "created_at": h.created_at,
                "created_by": h.created_by,
                "member_count": member_count
            }
            households.append(schemas.Household(**household_dict))
        return households
    except Exception as e:
        logger.error(f"Failed to get households: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get households: {str(e)}"
        )

@app.get("/api/admin/households/with-members", response_model=List[schemas.HouseholdWithMembers])
def get_all_households_with_members(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get all households with their members (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # Get all households and batch load members in one query
        all_households = db.query(models.Household).all()

        # Batch load all household-member associations
        members_q = db.query(
            models.user_household_association.c.household_id,
            models.FamilyMember
        ).join(
            models.FamilyMember,
            models.FamilyMember.id == models.user_household_association.c.user_id
        ).all()
        members_by_household = {}
        for hid, member in members_q:
            members_by_household.setdefault(hid, []).append(member)

        households = []
        for h in all_households:
            members = members_by_household.get(h.id, [])
            member_schemas = [{
                "id": m.id, "name": m.name, "username": m.username,
                "email": m.email, "is_admin": m.is_admin
            } for m in members]

            households.append(schemas.HouseholdWithMembers(
                id=h.id, name=h.name, description=h.description,
                created_at=h.created_at, created_by=h.created_by,
                member_count=len(members), members=member_schemas
            ))
        return households
    except Exception as e:
        logger.error(f"Failed to get households with members: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get households with members: {str(e)}"
        )

@app.post("/api/admin/households", response_model=schemas.Household)
def create_household(
    household: schemas.HouseholdCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Create a new household (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # Create new household
        new_household = models.Household(
            name=household.name,
            description=household.description,
            created_by=current_user_id
        )
        db.add(new_household)
        db.commit()
        db.refresh(new_household)
        
        # Get member count (will be 0 for new household)
        member_count = db.query(models.user_household_association).filter(
            models.user_household_association.c.household_id == new_household.id
        ).count()
        
        return schemas.Household(
            id=new_household.id,
            name=new_household.name,
            description=new_household.description,
            created_at=new_household.created_at,
            created_by=new_household.created_by,
            member_count=member_count
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create household: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create household: {str(e)}"
        )

@app.get("/api/admin/stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get admin dashboard statistics"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # Get various statistics
        total_users = db.query(models.FamilyMember).count()
        total_households = db.query(models.Household).count()
        total_wishlists = db.query(models.WishlistItem).count()
        total_emails_sent = db.query(models.EmailLog).filter(models.EmailLog.status == 'sent').count()
        total_cart_items = db.query(models.ShoppingCartItem).count()
        total_shared_wishlists = db.query(models.SharedWishlist).count()

        return {
            "total_users": total_users,
            "total_households": total_households,
            "total_wishlists": total_wishlists,
            "total_emails_sent": total_emails_sent,
            "total_cart_items": total_cart_items,
            "total_shared_wishlists": total_shared_wishlists
        }
    except Exception as e:
        logger.error(f"Failed to get admin stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get admin stats: {str(e)}"
        )

@app.get("/api/admin/email/settings", response_model=schemas.EmailSettings)
def get_email_settings(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get email settings (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        settings = db.query(models.EmailSettings).filter(models.EmailSettings.is_active == True).first()
        
        if not settings:
            # Create default settings if none exist
            settings = models.EmailSettings(
                smtp_server="smtp.gmail.com",
                smtp_port=465,
                smtp_username="your-email@gmail.com",
                smtp_password="",
                from_email="your-email@gmail.com",
                from_name="Family Wishlist",
                use_tls=False,  # Port 465 uses SSL, not TLS
                use_ssl=True,   # Enable SSL for port 465
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)
        
        return schemas.EmailSettings.from_orm(settings)
    except Exception as e:
        logger.error(f"Failed to get email settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get email settings: {str(e)}"
        )

@app.put("/api/admin/email/settings", response_model=schemas.EmailSettings)
def update_email_settings(
    settings_update: schemas.EmailSettingsUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Update email settings (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        settings = db.query(models.EmailSettings).filter(models.EmailSettings.is_active == True).first()
        if not settings:
            # Create new settings if none exist
            settings = models.EmailSettings(**settings_update.dict(exclude_unset=True))
            settings.is_active = True
            db.add(settings)
        else:
            # Update existing settings
            for key, value in settings_update.dict(exclude_unset=True).items():
                setattr(settings, key, value)
        
        db.commit()
        db.refresh(settings)
        return schemas.EmailSettings.from_orm(settings)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update email settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update email settings: {str(e)}"
        )

@app.get("/api/admin/email/templates", response_model=List[schemas.EmailTemplate])
def get_email_templates(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get all email templates (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # First check if we have any templates
        templates = db.query(models.EmailTemplate).all()
        if not templates:
            # Create default templates if none exist
            from .services.email_service import create_default_templates
            create_default_templates(db)
            templates = db.query(models.EmailTemplate).all()
        
        return [schemas.EmailTemplate.from_orm(t) for t in templates]
    except Exception as e:
        logger.error(f"Failed to get email templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get email templates: {str(e)}"
        )

@app.put("/api/admin/email/templates/{template_id}", response_model=schemas.EmailTemplate)
def update_email_template(
    template_id: int,
    template_update: schemas.EmailTemplateUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Update an email template (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        template = db.query(models.EmailTemplate).filter(models.EmailTemplate.id == template_id).first()
        if not template:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        
        # Update template fields
        for key, value in template_update.dict(exclude_unset=True).items():
            setattr(template, key, value)
        
        db.commit()
        db.refresh(template)
        return schemas.EmailTemplate.from_orm(template)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update email template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update email template: {str(e)}"
        )

@app.post("/api/admin/email/templates", response_model=schemas.EmailTemplate)
def create_email_template(
    template_create: schemas.EmailTemplateCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Create a new email template (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    is_admin = user and user.name.lower() == 'admin'
    
    if not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # Check if template with same name already exists
        existing_template = db.query(models.EmailTemplate).filter(models.EmailTemplate.name == template_create.name).first()
        if existing_template:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template with this name already exists")
        
        # Create new template
        template = models.EmailTemplate(
            name=template_create.name,
            subject=template_create.subject,
            body=template_create.body,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(template)
        db.commit()
        db.refresh(template)
        return schemas.EmailTemplate.from_orm(template)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create email template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create email template: {str(e)}"
        )

@app.post("/api/admin/email/test", response_model=schemas.EmailLog)
def test_email_settings(
    test_request: schemas.EmailTestRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Test email settings by sending a test email."""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # Get email service
        email_service = EmailService(db)
        
        # Check if settings exist and are configured
        if not email_service.settings:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email settings not configured. Please configure email settings first."
            )
        
        # Send test email
        log = email_service.test_email_settings(test_request.recipient_email)
        if not log or log.status == "failed":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=log.error_message if log else "Failed to send test email"
            )
        
        return log
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to send test email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send test email: {str(e)}"
        )

@app.get("/api/admin/system/status")
def get_system_status(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get system status (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        import os
        import psutil
        from datetime import datetime, timedelta
        
        # Get system information
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Get database size
        db_size_kb = 0
        try:
            # Get the database file path from the engine
            db_url = str(db.bind.url)
            if db_url.startswith('sqlite:///'):
                db_path = db_url.replace('sqlite:///', '')
                if os.path.exists(db_path):
                    db_size_kb = os.path.getsize(db_path) / 1024
        except Exception as e:
            logger.error(f"Failed to get database size: {e}")
        
        # Get uptime
        uptime_seconds = time.time() - psutil.boot_time()
        uptime_hours = int(uptime_seconds // 3600)
        uptime_minutes = int((uptime_seconds % 3600) // 60)
        
        # Get active users (users who have logged in recently)
        thirty_days_ago = get_est_timedelta(days=-30)
        active_users = db.query(models.FamilyMember).count()  # For now, just count all users
        
        # Get last backup time
        backup_dir = "data/backups"
        last_backup = "Never"
        if os.path.exists(backup_dir):
            try:
                backup_files = [f for f in os.listdir(backup_dir) if f.endswith('.db')]
                if backup_files:
                    latest_backup = max(backup_files, key=lambda f: os.path.getctime(os.path.join(backup_dir, f)))
                    backup_time = os.path.getctime(os.path.join(backup_dir, latest_backup))
                    eastern = pytz.timezone('US/Eastern')
                    backup_datetime_est = datetime.fromtimestamp(backup_time, tz=eastern)
                    last_backup = backup_datetime_est.strftime('%Y-%m-%d %H:%M:%S')
            except Exception as e:
                logger.error(f"Failed to get last backup time: {e}")
        
        return {
            "status": "healthy",
            "version": crud.get_system_version(db),
            "uptime": f"{uptime_hours}h {uptime_minutes}m",
            "memory_usage": f"{memory.percent}%",
            "disk_usage": f"{disk.percent}%",
            "active_users": active_users,
            "last_backup": last_backup,
            "environment": os.getenv("ENVIRONMENT", "development"),
            "database_status": "connected",
            "database_size_kb": round(db_size_kb, 2)
        }
    except Exception as e:
        logger.error(f"Failed to get system status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get system status: {str(e)}"
        )

@app.get("/api/admin/system/settings")
def get_system_settings(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get system settings (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # Get all system config entries
        configs = db.query(models.SystemConfig).all()
        settings = {}
        
        # Convert to dictionary
        for config in configs:
            # Try to parse as JSON if possible
            try:
                settings[config.key] = json.loads(config.value)
            except:
                settings[config.key] = config.value
        
        # Set defaults if not found
        settings.setdefault('maintenance_mode', False)
        settings.setdefault('max_upload_size', '5MB')
        settings.setdefault('session_timeout', '24h')
        settings.setdefault('backup_retention_days', 30)
        
        return settings
    except Exception as e:
        logger.error(f"Failed to get system settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get system settings: {str(e)}"
        )

@app.put("/api/admin/system/settings")
def update_system_settings(
    settings: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Update system settings (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # Update each setting
        for key, value in settings.items():
            # Convert value to JSON string if it's not a string
            if not isinstance(value, str):
                value = json.dumps(value)
            
            # Get or create config entry
            config = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
            if config:
                config.value = value
                config.updated_at = get_est_timestamp()
            else:
                config = models.SystemConfig(
                    key=key,
                    value=value,
                    created_at=get_est_timestamp(),
                    updated_at=get_est_timestamp()
                )
                db.add(config)
        
        db.commit()
        return {"message": "Settings updated successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update system settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update system settings: {str(e)}"
        )

@app.put("/api/admin/households/{household_id}", response_model=schemas.Household)
def update_household(
    household_id: int,
    household_data: schemas.HouseholdUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Update a household (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # Check if household exists
        household = db.query(models.Household).filter(models.Household.id == household_id).first()
        if not household:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Household not found")
        
        # Update household fields
        if household_data.name is not None:
            household.name = household_data.name
        if household_data.description is not None:
            household.description = household_data.description
        
        db.commit()
        db.refresh(household)
        
        # Get member count
        member_count = db.query(models.user_household_association).filter(
            models.user_household_association.c.household_id == household.id
        ).count()
        
        return schemas.Household(
            id=household.id,
            name=household.name,
            description=household.description,
            created_at=household.created_at,
            created_by=household.created_by,
            member_count=member_count
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update household: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update household: {str(e)}"
        )

@app.delete("/api/admin/households/{household_id}", response_model=schemas.Household)
def delete_household(
    household_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Delete a household (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # Check if household exists
        household = db.query(models.Household).filter(models.Household.id == household_id).first()
        if not household:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Household not found")
        
        # Remove all user associations first
        db.execute(
            models.user_household_association.delete().where(
                models.user_household_association.c.household_id == household_id
            )
        )
        
        # Delete the household
        db.delete(household)
        db.commit()
        
        return schemas.Household(
            id=household.id,
            name=household.name,
            description=household.description,
            created_at=household.created_at,
            created_by=household.created_by,
            member_count=0
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete household: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete household: {str(e)}"
        )

@app.post("/api/admin/system/cache/clear")
def clear_system_cache(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Clear system cache."""
    try:
        # Verify admin
        member = crud.get_family_member(db, current_user_id)
        if not member or not member.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")

        # Clear any caches we have
        # 1. Clear SQLAlchemy session
        db.expire_all()
        # 2. Clear any in-memory caches
        if hasattr(app, 'cache'):
            app.cache.clear()
        # 3. Clear Redis cache if configured
        if hasattr(app, 'redis'):
            app.redis.flushdb()

        return {"success": True, "message": "System cache cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/households/{household_id}/members", response_model=schemas.Household)
def add_user_to_household(
    household_id: int,
    user_data: dict,  # Expect {"user_id": int}
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Add a user to a household (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    user_id = user_data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id is required")
    
    try:
        # Check if household exists
        household = db.query(models.Household).filter(models.Household.id == household_id).first()
        if not household:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Household not found")
        
        # Check if user exists
        target_user = crud.get_family_member(db, user_id)
        if not target_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        # Check if user is already in household
        existing = db.query(models.user_household_association).filter(
            models.user_household_association.c.user_id == user_id,
            models.user_household_association.c.household_id == household_id
        ).first()
        
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already in this household")
        
        # Add user to household
        db.execute(models.user_household_association.insert().values(
            user_id=user_id,
            household_id=household_id,
            joined_at=get_est_timestamp(),
            requested_at=get_est_timestamp(),
            status='active'
        ))
        db.commit()
        
        # Return updated household
        member_count = db.query(models.user_household_association).filter(
            models.user_household_association.c.household_id == household_id
        ).count()
        
        # Get updated members
        members = db.query(models.FamilyMember).join(
            models.user_household_association,
            models.FamilyMember.id == models.user_household_association.c.user_id
        ).filter(
            models.user_household_association.c.household_id == household_id
        ).all()
        
        # Convert members to schema
        member_schemas = []
        for member in members:
            member_schemas.append({
                "id": member.id,
                "name": member.name,
                "username": member.username,
                "email": member.email,
                "is_admin": member.is_admin
            })
        
        return schemas.HouseholdWithMembers(
            id=household.id,
            name=household.name,
            description=household.description,
            created_at=household.created_at,
            created_by=household.created_by,
            member_count=member_count,
            members=member_schemas
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to add user to household: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add user to household: {str(e)}"
        )

@app.delete("/api/admin/households/{household_id}/members/{user_id}", response_model=schemas.Household)
def remove_user_from_household(
    household_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Remove a user from a household (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # Check if household exists
        household = db.query(models.Household).filter(models.Household.id == household_id).first()
        if not household:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Household not found")
        
        # Remove user from household
        result = db.execute(
            models.user_household_association.delete().where(
                models.user_household_association.c.user_id == user_id,
                models.user_household_association.c.household_id == household_id
            )
        )
        
        if result.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in household")
        
        db.commit()
        
        # Return updated household
        member_count = db.query(models.user_household_association).filter(
            models.user_household_association.c.household_id == household_id
        ).count()
        
        # Get updated members
        members = db.query(models.FamilyMember).join(
            models.user_household_association,
            models.FamilyMember.id == models.user_household_association.c.user_id
        ).filter(
            models.user_household_association.c.household_id == household_id
        ).all()
        
        # Convert members to schema
        member_schemas = []
        for member in members:
            member_schemas.append({
                "id": member.id,
                "name": member.name,
                "username": member.username,
                "email": member.email,
                "is_admin": member.is_admin
            })
        
        return schemas.HouseholdWithMembers(
            id=household.id,
            name=household.name,
            description=household.description,
            created_at=household.created_at,
            created_by=household.created_by,
            member_count=member_count,
            members=member_schemas
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to remove user from household: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove user from household: {str(e)}"
        )

@app.get("/api/admin/items")
def get_all_items(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get all wishlist items for admin management (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        items = db.query(models.WishlistItem).options(
            joinedload(models.WishlistItem.owner)
        ).all()
        shared_items = db.query(models.SharedWishlistItem).options(
            joinedload(models.SharedWishlistItem.wishlist).joinedload(models.SharedWishlist.owners)
        ).all()

        # Batch load all user→household mappings in one query
        all_user_households = db.query(
            models.user_household_association.c.user_id,
            models.Household.name
        ).join(
            models.Household,
            models.Household.id == models.user_household_association.c.household_id
        ).all()
        households_by_user = {}
        for uid, hname in all_user_households:
            households_by_user.setdefault(uid, []).append(hname)

        result = []
        for item in items:
            household_names = households_by_user.get(item.owner_id, ["No household"])
            thinking_by_list = item.thinking_about_by.split(',') if item.thinking_about_by else []
            thinking_by_list = [name.strip() for name in thinking_by_list if name.strip()]

            result.append({
                "id": item.id,
                "title": item.title,
                "description": item.description,
                "link": item.link,
                "image_url": item.image_url,
                "owner_id": item.owner_id,
                "owner_name": item.owner.name,
                "group_label": item.owner.name,
                "group_type": "user",
                "households": household_names,
                "is_purchased": item.is_purchased,
                "purchased_by": item.purchased_by,
                "thinking_about_by_list": thinking_by_list,
                "priority": item.priority,
                "price": item.price,
                "created_at": item.id,
                "item_type": "personal"
            })

        for shared_item in shared_items:
            wishlist = shared_item.wishlist
            owner_ids = [owner.id for owner in (wishlist.owners or [])]
            owner_names = [owner.name for owner in (wishlist.owners or [])]
            # Collect household names from pre-loaded map
            household_names_set = set()
            for oid in owner_ids:
                for hname in households_by_user.get(oid, []):
                    household_names_set.add(hname)
            household_names = list(household_names_set) if household_names_set else ["No household"]

            thinking_by_list = shared_item.thinking_about_by.split(',') if shared_item.thinking_about_by else []
            thinking_by_list = [name.strip() for name in thinking_by_list if name.strip()]

            result.append({
                "id": shared_item.id,
                "title": shared_item.title,
                "description": shared_item.description,
                "link": shared_item.link,
                "image_url": shared_item.image_url,
                "owner_id": None,
                "owner_name": None,
                "group_label": wishlist.name,
                "group_type": "shared",
                "shared_wishlist_id": wishlist.id,
                "shared_wishlist_name": wishlist.name,
                "shared_owner_names": owner_names,
                "households": household_names,
                "is_purchased": shared_item.is_purchased,
                "purchased_by": shared_item.purchased_by,
                "thinking_about_by_list": thinking_by_list,
                "priority": shared_item.priority,
                "price": shared_item.price,
                "created_at": shared_item.id,
                "item_type": "shared"
            })

        return result
    except Exception as e:
        logger.error(f"Failed to get all items: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get all items: {str(e)}"
        )

@app.get("/api/admin/carts")
def get_all_cart_items(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get all shopping cart items across users (admin only)."""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")

    try:
        cart_items = db.query(models.ShoppingCartItem).options(
            joinedload(models.ShoppingCartItem.buyer),
            joinedload(models.ShoppingCartItem.recipient),
            joinedload(models.ShoppingCartItem.shared_wishlist_item)
        ).order_by(models.ShoppingCartItem.created_at.desc()).all()

        result = []
        for item in cart_items:
            buyer_name = item.buyer.name if item.buyer else "Unknown"
            recipient_name = item.recipient.name if item.recipient else item.recipient_name
            result.append({
                "id": item.id,
                "buyer_id": item.buyer_id,
                "buyer_name": buyer_name,
                "recipient_id": item.recipient_id,
                "recipient_name": recipient_name,
                "wishlist_item_id": item.wishlist_item_id,
                "shared_wishlist_item_id": item.shared_wishlist_item_id,
                "shared_wishlist_id": item.shared_wishlist_id,
                "title": item.title,
                "notes": item.notes,
                "link": item.link,
                "image_url": item.image_url,
                "price": item.price,
                "status": item.status,
                "created_at": item.created_at,
                "purchased_at": item.purchased_at
            })

        return result
    except Exception as e:
        logger.error(f"Failed to get all cart items: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get all cart items: {str(e)}"
        )

@app.delete("/api/admin/carts/{cart_item_id}")
def delete_admin_cart_item(
    cart_item_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Delete a shopping cart item as admin."""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")

    try:
        db_item = db.query(models.ShoppingCartItem).filter(models.ShoppingCartItem.id == cart_item_id).first()
        if not db_item:
            raise HTTPException(status_code=404, detail="Shopping cart item not found")

        buyer = db.query(models.FamilyMember).filter(models.FamilyMember.id == db_item.buyer_id).first()
        buyer_name = buyer.name if buyer else None
        item_title = db_item.title or "an item"

        if db_item.wishlist_item_id and buyer_name:
            wishlist_item = db.query(models.WishlistItem).filter(models.WishlistItem.id == db_item.wishlist_item_id).first()
            if wishlist_item and wishlist_item.purchased_by == buyer_name:
                wishlist_item.is_purchased = False
                wishlist_item.purchased_by = None

        if db_item.shared_wishlist_item_id and buyer_name:
            shared_item = db.query(models.SharedWishlistItem).filter(
                models.SharedWishlistItem.id == db_item.shared_wishlist_item_id
            ).first()
            if shared_item and shared_item.purchased_by == buyer_name:
                shared_item.is_purchased = False
                shared_item.purchased_by = None

        if db_item.buyer_id:
            notification = models.Notification(
                recipient_id=db_item.buyer_id,
                message=f'An admin removed "{item_title}" from your cart.',
                is_read=False,
            )
            db.add(notification)

        crud.detach_notifications_for_cart_items(db, [db_item.id])
        db.delete(db_item)
        db.commit()
        return {"success": True, "message": "Cart item removed."}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete cart item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete cart item: {str(e)}"
        )

@app.delete("/api/admin/carts/buyer/{buyer_id}")
def clear_admin_cart(
    buyer_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Clear all shopping cart items for a buyer (admin only)."""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")

    try:
        buyer = db.query(models.FamilyMember).filter(models.FamilyMember.id == buyer_id).first()
        buyer_name = buyer.name if buyer else None

        cart_items = db.query(models.ShoppingCartItem).filter(
            models.ShoppingCartItem.buyer_id == buyer_id
        ).all()

        if cart_items and buyer_id:
            notification = models.Notification(
                recipient_id=buyer_id,
                message='An admin cleared your cart.',
                is_read=False,
            )
            db.add(notification)

        for db_item in cart_items:
            if db_item.wishlist_item_id and buyer_name:
                wishlist_item = db.query(models.WishlistItem).filter(
                    models.WishlistItem.id == db_item.wishlist_item_id
                ).first()
                if wishlist_item and wishlist_item.purchased_by == buyer_name:
                    wishlist_item.is_purchased = False
                    wishlist_item.purchased_by = None

            if db_item.shared_wishlist_item_id and buyer_name:
                shared_item = db.query(models.SharedWishlistItem).filter(
                    models.SharedWishlistItem.id == db_item.shared_wishlist_item_id
                ).first()
                if shared_item and shared_item.purchased_by == buyer_name:
                    shared_item.is_purchased = False
                    shared_item.purchased_by = None

            crud.detach_notifications_for_cart_items(db, [db_item.id])
            db.delete(db_item)

        db.commit()
        removed_count = len(cart_items)
        return {
            "success": True,
            "removed": removed_count,
            "message": f"Cleared {removed_count} cart item{'' if removed_count == 1 else 's'}."
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to clear cart items: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear cart items: {str(e)}"
        )

@app.delete("/api/admin/carts")
def clear_all_admin_carts(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Clear all shopping cart items for all buyers (admin only)."""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")

    try:
        cart_items = db.query(models.ShoppingCartItem).all()
        if not cart_items:
            return {"success": True, "removed": 0, "message": "No cart items to clear."}

        buyer_ids = {item.buyer_id for item in cart_items if item.buyer_id}
        buyers = db.query(models.FamilyMember).filter(models.FamilyMember.id.in_(buyer_ids)).all()
        buyer_names = {buyer.id: buyer.name for buyer in buyers}

        for buyer_id in buyer_ids:
            notification = models.Notification(
                recipient_id=buyer_id,
                message='An admin cleared your cart.',
                is_read=False,
            )
            db.add(notification)

        for db_item in cart_items:
            buyer_name = buyer_names.get(db_item.buyer_id)

            if db_item.wishlist_item_id and buyer_name:
                wishlist_item = db.query(models.WishlistItem).filter(
                    models.WishlistItem.id == db_item.wishlist_item_id
                ).first()
                if wishlist_item and wishlist_item.purchased_by == buyer_name:
                    wishlist_item.is_purchased = False
                    wishlist_item.purchased_by = None

            if db_item.shared_wishlist_item_id and buyer_name:
                shared_item = db.query(models.SharedWishlistItem).filter(
                    models.SharedWishlistItem.id == db_item.shared_wishlist_item_id
                ).first()
                if shared_item and shared_item.purchased_by == buyer_name:
                    shared_item.is_purchased = False
                    shared_item.purchased_by = None

            crud.detach_notifications_for_cart_items(db, [db_item.id])
            db.delete(db_item)

        db.commit()
        removed_count = len(cart_items)
        return {
            "success": True,
            "removed": removed_count,
            "message": f"Cleared {removed_count} cart item{'' if removed_count == 1 else 's'}."
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to clear cart items: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear cart items: {str(e)}"
        )

@app.delete("/api/admin/items/{item_id}")
def delete_item_admin(
    item_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Delete any item as admin"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # Find the item
        item = db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

        # Notify cart buyers and disconnect cart items before deletion
        crud.notify_cart_buyers_on_wishlist_delete(db, item)

        # Delete associated comments first
        db.query(models.Comment).filter(models.Comment.item_id == item_id).delete()

        # Delete the item
        db.delete(item)
        db.commit()

        return {"message": "Item deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete item: {str(e)}"
        )

@app.post("/api/admin/system/maintenance")
def set_maintenance_mode(
    enabled: bool,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Enable or disable maintenance mode."""
    try:
        # Verify admin
        member = crud.get_family_member(db, current_user_id)
        if not member or not member.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")

        # Update maintenance mode in system settings
        settings = crud.get_system_settings(db)
        settings["maintenance_mode"] = enabled
        crud.update_system_settings(db, settings)

        return {"success": True, "message": f"Maintenance mode {'enabled' if enabled else 'disabled'}", "enabled": enabled}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/system/database-version")
def get_database_version(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get the current database version and migration status"""
    try:
        # Check if user is admin
        user = db.query(models.FamilyMember).filter(models.FamilyMember.id == current_user_id).first()
        if not user or not user.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Get current version from alembic
        try:
            from alembic import command
            from alembic.config import Config
            from alembic.script import ScriptDirectory
            
            # Create alembic config
            alembic_cfg = Config("alembic.ini")
            script = ScriptDirectory.from_config(alembic_cfg)
            
            # Get current version
            with engine.connect() as connection:
                context = command.Context(alembic_cfg, script, connection)
                current_version = context.get_current_revision()
            
            return {
                "current_version": current_version,
                "database_path": DATABASE_PATH
            }
        except Exception as e:
            logger.error(f"Failed to get database version: {e}")
            return {
                "current_version": "unknown",
                "database_path": DATABASE_PATH,
                "error": str(e)
            }
    except Exception as e:
        logger.error(f"Database version check failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get database version")

@app.get("/api/admin/system/logs")
def get_application_logs(
    limit: int = Query(100, ge=1, le=1000, description="Number of log entries to return"),
    offset: int = Query(0, ge=0, description="Number of log entries to skip"),
    module: Optional[str] = Query(None, description="Filter by module name"),
    level: Optional[str] = Query(None, description="Filter by log level (INFO, WARNING, ERROR, etc.)"),
    search: Optional[str] = Query(None, description="Search in log messages"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get authentication logs with filtering and pagination"""
    try:
        # Check if user is admin
        user = db.query(models.FamilyMember).filter(models.FamilyMember.id == current_user_id).first()
        if not user or not user.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Define possible log file paths (Docker-compatible)
        log_paths = [
            '/app/data/auth.log',  # Primary Docker path
            './data/auth.log',     # Relative path fallback
            'auth.log',           # Current directory fallback
            '/tmp/auth.log'       # System temp fallback
        ]
        
        log_path = None
        log_content = ""
        
        # Try to find and read the log file
        for path in log_paths:
            try:
                if os.path.exists(path) and os.path.getsize(path) > 0:
                    with open(path, 'r', encoding='utf-8') as f:
                        log_content = f.read()
                    log_path = path
                    logger.info(f"Reading logs from: {log_path}")
                    break
            except Exception as e:
                logger.warning(f"Could not read log file {path}: {e}")
                continue
        
        if not log_path or not log_content.strip():
            # Return empty result with helpful message
            return {
                "logs": [],
                "total": 0,
                "limit": limit,
                "offset": offset,
                "message": "No log file found or log file is empty. Authentication events may be logged to console only.",
                "log_paths_tried": log_paths,
                "docker_info": {
                    "environment": os.getenv("ENVIRONMENT", "unknown"),
                    "puid": os.getenv("PUID", "unknown"),
                    "pgid": os.getenv("PGID", "unknown")
                }
            }
        
        # Read and parse log file
        logs = []
        try:
            lines = log_content.splitlines()
            
            # Parse each line and apply filters
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Parse log line (format: timestamp - module - level - message)
                try:
                    # Split by " - " to separate timestamp, module, level, and message
                    parts = line.split(" - ", 3)
                    if len(parts) >= 4:
                        timestamp_str, module_name, level, message = parts
                        
                        # Parse timestamp (support both ISO and 'YYYY-MM-DD HH:MM:SS,mmm')
                        try:
                            # Try ISO first
                            from datetime import datetime
                            if 'T' in timestamp_str:
                                timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                            else:
                                # Parse 'YYYY-MM-DD HH:MM:SS,mmm'
                                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S,%f")
                        except Exception:
                            timestamp = timestamp_str
                        
                                                # Apply filters
                        if module and module_name != module:
                            continue
                        if level and level.upper() != level.upper():
                            continue
                        if search and search.lower() not in message.lower():
                            continue
                            
                        # Add the log entry
                        logs.append({
                            "timestamp": timestamp.isoformat() if hasattr(timestamp, 'isoformat') else timestamp,
                            "module": module_name,
                            "level": level,
                            "message": message
                        })
                except Exception as e:
                    logger.debug(f"Skipping malformed log line: {line[:100]}... Error: {e}")
                    continue
            
            # Sort by timestamp (newest first)
            logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            
            # Apply pagination
            total = len(logs)
            paginated_logs = logs[offset:offset + limit]
            
            return {
                "logs": paginated_logs,
                "total": total,
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total,
                "log_path": log_path,
                "file_size": os.path.getsize(log_path) if log_path else 0
            }
            
        except Exception as e:
            logger.error(f"Failed to parse log file: {e}")
            raise HTTPException(status_code=500, detail="Failed to parse log file")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth logs fetch failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch authentication logs")

def parse_auth_message(message):
    """Parse AUTH event information from log message"""
    try:
        # Look for AUTH pattern: "AUTH SUCCESS/FAILED - EVENT_TYPE - User: username - IP: ip - Details: details"
        if not message.startswith('AUTH '):
            return None
        
        parts = message.split(' - ')
        if len(parts) < 2:
            return None
        
        # Extract status and event type
        auth_part = parts[0]  # "AUTH SUCCESS - LOGIN"
        auth_parts = auth_part.split(' ', 2)
        if len(auth_parts) < 3:
            return None
        
        status = auth_parts[1]  # "SUCCESS" or "FAILED"
        event_type = auth_parts[2]  # "LOGIN", "LOGOUT", etc.
        
        result = {
            "event_type": event_type,
            "success": status == "SUCCESS",
            "username": None,
            "ip_address": None,
            "details": None
        }
        
        # Parse additional parts
        for part in parts[1:]:
            if part.startswith('User: '):
                result["username"] = part[6:]
            elif part.startswith('IP: '):
                result["ip_address"] = part[4:]
            elif part.startswith('Details: '):
                result["details"] = part[9:]
        
        return result
        
    except Exception:
        return None

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    try:
        await rate_limiter.check_rate_limit(request)
    except HTTPException as e:
        if e.status_code == 429:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": e.detail,
                    "timestamp": get_est_timestamp_iso(),
                }
            )
        raise
    response = await call_next(request)
    return response

# --- User Household Management (Non-Admin) ---

@app.get("/api/households", response_model=List[schemas.Household])
def get_households_for_user(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get all households that a user can see/join"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    try:
        # Get all households with member count
        households = []
        for h in db.query(models.Household).all():
            member_count = db.query(models.user_household_association).filter(
                models.user_household_association.c.household_id == h.id
            ).count()
            household_dict = {
                "id": h.id,
                "name": h.name,
                "description": h.description,
                "created_at": h.created_at,
                "created_by": h.created_by,
                "member_count": member_count
            }
            households.append(schemas.Household(**household_dict))
        return households
    except Exception as e:
        logger.error(f"Failed to get households: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get households: {str(e)}"
        )

@app.get("/api/user/households", response_model=schemas.UserHouseholdsResponse)
def get_user_households(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Get current user's households"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    try:
        # Get user's households
        user_households = db.query(models.Household).join(
            models.user_household_association,
            models.Household.id == models.user_household_association.c.household_id
        ).filter(
            models.user_household_association.c.user_id == current_user_id,
            models.user_household_association.c.status == 'active'
        ).all()
        
        households = []
        for h in user_households:
            member_count = db.query(models.user_household_association).filter(
                models.user_household_association.c.household_id == h.id
            ).count()
            household_dict = {
                "id": h.id,
                "name": h.name,
                "description": h.description,
                "created_at": h.created_at,
                "created_by": h.created_by,
                "member_count": member_count
            }
            households.append(schemas.Household(**household_dict))
        
        return schemas.UserHouseholdsResponse(
            success=True,
            message=f"Found {len(households)} households",
            households=households
        )
    except Exception as e:
        logger.error(f"Failed to get user households: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user households: {str(e)}"
        )

@app.post("/api/households", response_model=schemas.UserHouseholdResponse)
def create_household_by_user(
    household: schemas.HouseholdCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Create a new household (any user can create)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    try:
        # Create new household
        new_household = models.Household(
            name=household.name,
            description=household.description,
            created_by=current_user_id
        )
        db.add(new_household)
        db.commit()
        db.refresh(new_household)
        
        # Automatically add the creator to the household
        db.execute(models.user_household_association.insert().values(
            user_id=current_user_id,
            household_id=new_household.id,
            joined_at=get_est_timestamp(),
            requested_at=get_est_timestamp(),
            status='active'
        ))
        db.commit()
        
        # Get member count (should be 1)
        member_count = db.query(models.user_household_association).filter(
            models.user_household_association.c.household_id == new_household.id
        ).count()
        
        household_response = schemas.Household(
            id=new_household.id,
            name=new_household.name,
            description=new_household.description,
            created_at=new_household.created_at,
            created_by=new_household.created_by,
            member_count=member_count
        )
        
        return schemas.UserHouseholdResponse(
            success=True,
            message="Household created successfully",
            household=household_response
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create household: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create household: {str(e)}"
        )

@app.post("/api/households/{household_id}/join", response_model=schemas.UserHouseholdResponse)
def join_household(
    household_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Join a household"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    try:
        # Check if household exists
        household = db.query(models.Household).filter(models.Household.id == household_id).first()
        if not household:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Household not found")
        
        # Check if user is already in household
        existing = db.query(models.user_household_association).filter(
            models.user_household_association.c.user_id == current_user_id,
            models.user_household_association.c.household_id == household_id
        ).first()
        
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You are already in this household")
        
        # Add user to household
        db.execute(models.user_household_association.insert().values(
            user_id=current_user_id,
            household_id=household_id,
            joined_at=get_est_timestamp(),
            requested_at=get_est_timestamp(),
            status='active'
        ))

        # Reassign any owned shared wishlists tied to households the user is no longer in.
        active_household_ids = [
            row[0] for row in db.query(models.user_household_association.c.household_id).filter(
                models.user_household_association.c.user_id == current_user_id,
                models.user_household_association.c.status == 'active'
            ).all()
        ]
        if active_household_ids:
            db.query(models.SharedWishlist).filter(
                models.SharedWishlist.created_by == current_user_id,
                or_(
                    models.SharedWishlist.household_id.is_(None),
                    models.SharedWishlist.household_id.notin_(active_household_ids)
                )
            ).update(
                {models.SharedWishlist.household_id: household_id},
                synchronize_session=False
            )

        db.commit()
        
        # Get updated member count
        member_count = db.query(models.user_household_association).filter(
            models.user_household_association.c.household_id == household_id
        ).count()
        
        household_response = schemas.Household(
            id=household.id,
            name=household.name,
            description=household.description,
            created_at=household.created_at,
            created_by=household.created_by,
            member_count=member_count
        )
        
        return schemas.UserHouseholdResponse(
            success=True,
            message=f"Successfully joined household '{household.name}'",
            household=household_response
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to join household: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to join household: {str(e)}"
        )

@app.delete("/api/households/{household_id}/leave", response_model=schemas.UserHouseholdResponse)
def leave_household(
    household_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Leave a household"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    try:
        # Check if household exists
        household = db.query(models.Household).filter(models.Household.id == household_id).first()
        if not household:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Household not found")
        
        # Remove user from household
        result = db.execute(
            models.user_household_association.delete().where(
                models.user_household_association.c.user_id == current_user_id,
                models.user_household_association.c.household_id == household_id
            )
        )
        
        if result.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="You are not a member of this household")

        remaining_household_ids = [
            row[0] for row in db.query(models.user_household_association.c.household_id).filter(
                models.user_household_association.c.user_id == current_user_id,
                models.user_household_association.c.status == 'active'
            ).all()
        ]
        target_household_id = None
        if remaining_household_ids:
            user = crud.get_family_member(db, current_user_id)
            preferences = user.preferences or {} if user else {}
            preferred_household_id = preferences.get('active_household_id')
            if preferred_household_id in remaining_household_ids:
                target_household_id = preferred_household_id
            elif len(remaining_household_ids) == 1:
                target_household_id = remaining_household_ids[0]

        wishlist_update_query = db.query(models.SharedWishlist).filter(
            models.SharedWishlist.created_by == current_user_id,
            models.SharedWishlist.household_id == household_id
        )

        if target_household_id:
            wishlist_update_query.update(
                {models.SharedWishlist.household_id: target_household_id},
                synchronize_session=False
            )
        else:
            wishlist_update_query.update(
                {models.SharedWishlist.household_id: None},
                synchronize_session=False
            )

        db.commit()
        
        # Get updated member count
        member_count = db.query(models.user_household_association).filter(
            models.user_household_association.c.household_id == household_id
        ).count()
        
        household_response = schemas.Household(
            id=household.id,
            name=household.name,
            description=household.description,
            created_at=household.created_at,
            created_by=household.created_by,
            member_count=member_count
        )
        
        return schemas.UserHouseholdResponse(
            success=True,
            message=f"Successfully left household '{household.name}'",
            household=household_response
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to leave household: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to leave household: {str(e)}"
        )

@app.put("/api/households/active", response_model=schemas.FamilyMember)
def set_active_household(
    household_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Set the active/primary household for the current user"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    try:
        # Get current user
        user = crud.get_family_member(db, current_user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        # Verify user is a member of this household
        membership = db.query(models.user_household_association).filter(
            models.user_household_association.c.user_id == current_user_id,
            models.user_household_association.c.household_id == household_id,
            models.user_household_association.c.status == 'active'
        ).first()

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are not a member of this household"
            )

        # Update user preferences with active household
        preferences = user.preferences or {}
        preferences['active_household_id'] = household_id

        updated_user = crud.update_member_preferences(db, current_user_id, preferences)

        # Build response with counts and households
        count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == user.id).count()
        household_count = db.query(models.user_household_association).filter(
            models.user_household_association.c.user_id == user.id
        ).count()
        external_wishlist_count = db.query(models.ExternalWishlist).filter(
            models.ExternalWishlist.owner_id == user.id
        ).count()

        member_households = db.query(models.Household).join(
            models.user_household_association,
            models.Household.id == models.user_household_association.c.household_id
        ).filter(
            models.user_household_association.c.user_id == user.id,
            models.user_household_association.c.status == 'active'
        ).all()

        households_data = [{"id": h.id, "name": h.name} for h in member_households]

        member_dict = {
            "id": updated_user.id,
            "name": updated_user.name,
            "birthday": updated_user.birthday,
            "is_admin": updated_user.is_admin,
            "preferences": updated_user.preferences,
            "username": updated_user.username,
            "email": updated_user.email,
            "force_password_change": updated_user.force_password_change,
            "first_login": updated_user.first_login,
            "wishlist_item_count": count,
            "external_wishlist_count": external_wishlist_count,
            "household_count": household_count,
            "households": households_data
        }

        return schemas.FamilyMember.model_validate(member_dict)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to set active household: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set active household: {str(e)}"
        )

@app.delete("/api/admin/email/templates/{template_id}", response_model=schemas.EmailResponse)
def delete_email_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Delete an email template (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        template = db.query(models.EmailTemplate).filter(models.EmailTemplate.id == template_id).first()
        if not template:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        
        # Delete the template
        db.delete(template)
        db.commit()
        
        return {"success": True, "message": "Template deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete email template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete email template: {str(e)}"
        )

@app.post("/api/auth/logout", 
    response_model=schemas.AuthResponse,
    tags=["Authentication"],
    summary="Log user logout for audit purposes",
    responses={
        200: {"description": "Logout recorded"}
    }
)
async def log_logout(
    request: Request,
    db: Session = Depends(get_db),
    client_ip: str = Depends(get_client_ip)
):
    """
    Record a user logout event for auditing purposes.
    The actual logout happens client-side; this endpoint is just for logging.
    """
    try:
        # Try to get username from request
        username = "unknown"
        user_info = {}
        
        try:
            user_info = await request.json()
            if 'username' in user_info:
                username = user_info['username']
        except:
            # If we can't parse JSON, just continue with unknown username
            pass
            
        # Log the logout
        auth.log_auth_event("LOGOUT", username, True, client_ip)
        
        return {"success": True, "message": "Logout recorded"}
    except Exception as e:
        logger.error(f"Error recording logout: {str(e)}")
        return {"success": False, "message": "Error recording logout"}

@app.post("/api/admin/email/broadcast-maintenance", response_model=schemas.EmailResponse)
def broadcast_maintenance_email(
    request: MaintenanceBroadcastRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Send a maintenance notice email to all users (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    email_service = EmailService(db)
    sent_count = email_service.send_maintenance_notice_to_all_users(
        maintenance_time=request.maintenance_time,
        expected_downtime=getattr(request, 'expected_downtime', None)
    )
    return schemas.EmailResponse(
        success=True,
        message=f"Maintenance notice sent to {sent_count} users."
    )

@app.post("/api/admin/email/broadcast-update", response_model=schemas.EmailResponse)
def broadcast_update_email(
    request: UpdateNoticeBroadcastRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Send an update/release notice email to all users (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    email_service = EmailService(db)
    if request.send_test_to_admin:
        if not user.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your admin account does not have an email address configured."
            )
        log = email_service.send_update_notice_to_user(
            user=user,
            version=request.version,
            changes=request.changes,
            headline=request.headline,
            intro=request.intro,
            highlights=request.highlights,
            closing=request.closing
        )
        if not log or getattr(log, "status", None) != "sent":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send test update email."
            )
        return schemas.EmailResponse(
            success=True,
            message=f"Test update email sent to {user.email}."
        )

    sent_count = email_service.send_update_notice_to_all_users(
        version=request.version,
        changes=request.changes,
        headline=request.headline,
        intro=request.intro,
        highlights=request.highlights,
        closing=request.closing
    )
    return schemas.EmailResponse(
        success=True,
        message=f"Update notice sent to {sent_count} users."
    )

@app.post("/api/admin/reminders/wishlist-update", response_model=schemas.WishlistReminderBroadcastResponse)
def broadcast_wishlist_update_reminder(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    """Create an in-app wishlist update reminder for all wishlist owners (admin only)."""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")

    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    reminder_prefix = "[WISHLIST_UPDATE_REMINDER]"
    reminder_message = f"{reminder_prefix} Please review and update your wishlist."

    # Non-admin users own personal wishlists by default.
    recipient_ids = {
        row[0] for row in db.query(models.FamilyMember.id).filter(models.FamilyMember.is_admin == False).all()
    }

    # Also include explicit shared wishlist co-owners (in case any are admins).
    shared_owner_ids = {
        row[0] for row in db.query(models.shared_wishlist_owners.c.user_id).distinct().all()
    }
    recipient_ids.update(shared_owner_ids)

    if not recipient_ids:
        return schemas.WishlistReminderBroadcastResponse(
            success=True,
            message="No wishlist owners found to notify.",
            sent_count=0,
            skipped_count=0
        )

    existing_unread_recipient_ids = {
        row[0]
        for row in db.query(models.Notification.recipient_id)
        .filter(
            models.Notification.recipient_id.in_(recipient_ids),
            models.Notification.is_read == False,
            models.Notification.message.like(f"{reminder_prefix}%")
        )
        .all()
    }

    sent_count = 0
    skipped_count = 0

    for recipient_id in recipient_ids:
        if recipient_id in existing_unread_recipient_ids:
            skipped_count += 1
            continue

        db.add(
            models.Notification(
                recipient_id=recipient_id,
                message=reminder_message,
                cart_item_id=None,
                is_read=False,
            )
        )
        sent_count += 1

    db.commit()

    return schemas.WishlistReminderBroadcastResponse(
        success=True,
        message=f"Wishlist update reminder sent to {sent_count} owner(s).",
        sent_count=sent_count,
        skipped_count=skipped_count
    )

# --- Shopping Cart ---

@app.get("/api/shopping-cart", response_model=List[schemas.ShoppingCartItem])
def get_shopping_cart_items(
    buyer_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Get all shopping cart items for a buyer."""
    items = db.query(models.ShoppingCartItem).filter(
        models.ShoppingCartItem.buyer_id == buyer_id
    ).order_by(models.ShoppingCartItem.created_at.desc()).all()
    return items

@app.post("/api/shopping-cart", response_model=schemas.ShoppingCartItem)
def create_shopping_cart_item(
    item: schemas.ShoppingCartItemCreate,
    db: Session = Depends(get_db),
):
    """Create a new shopping cart item."""
    if not item.recipient_id and not item.recipient_name:
        raise HTTPException(status_code=400, detail="Either recipient_id or recipient_name is required.")
    db_item = models.ShoppingCartItem(
        buyer_id=item.buyer_id,
        recipient_id=item.recipient_id,
        recipient_name=item.recipient_name,
        wishlist_item_id=item.wishlist_item_id,
        title=item.title,
        notes=item.notes,
        link=str(item.link) if item.link else None,
        image_url=str(item.image_url) if item.image_url else None,
        price=item.price,
        status=item.status.value if item.status else "pending",
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.post("/api/shopping-cart/from-wishlist-item/{item_id}", response_model=schemas.ShoppingCartItem)
def create_shopping_cart_item_from_wishlist(
    item_id: int = Path(...),
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header),
):
    """Create a shopping cart item from an existing wishlist item."""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current user context (X-Current-User-Id header) is required.")
    wishlist_item = db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()
    if not wishlist_item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
    current_user = db.query(models.FamilyMember).filter(models.FamilyMember.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    recipient_id = body.get("recipient_id")
    if not recipient_id:
        raise HTTPException(status_code=400, detail="recipient_id is required")

    existing_cart_item = db.query(models.ShoppingCartItem).filter(
        models.ShoppingCartItem.buyer_id == current_user_id,
        models.ShoppingCartItem.wishlist_item_id == wishlist_item.id,
    ).first()
    if existing_cart_item:
        raise HTTPException(status_code=409, detail="Item already in cart")

    if wishlist_item.is_purchased and wishlist_item.purchased_by != current_user.name:
        raise HTTPException(status_code=409, detail="Item already reserved by another user")

    db_item = models.ShoppingCartItem(
        buyer_id=current_user_id,
        recipient_id=recipient_id,
        wishlist_item_id=wishlist_item.id,
        title=wishlist_item.title,
        notes=None,
        link=wishlist_item.link,
        image_url=wishlist_item.image_url,
        price=wishlist_item.price,
        status="pending",
    )
    db.add(db_item)
    wishlist_item.is_purchased = True
    wishlist_item.purchased_by = current_user.name
    db.commit()
    db.refresh(db_item)
    return db_item


@app.post("/api/shopping-cart/from-shared-wishlist-item/{item_id}", response_model=schemas.ShoppingCartItem)
def create_shopping_cart_item_from_shared_wishlist(
    item_id: int = Path(...),
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header),
):
    """Create a shopping cart item from a shared wishlist item."""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current user context (X-Current-User-Id header) is required.")

    shared_item = db.query(models.SharedWishlistItem).filter(models.SharedWishlistItem.id == item_id).first()
    if not shared_item:
        raise HTTPException(status_code=404, detail="Shared wishlist item not found")

    current_user = db.query(models.FamilyMember).filter(models.FamilyMember.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    # Get the shared wishlist
    shared_wishlist = db.query(models.SharedWishlist).filter(models.SharedWishlist.id == shared_item.wishlist_id).first()
    if not shared_wishlist:
        raise HTTPException(status_code=404, detail="Shared wishlist not found")

    # Owners cannot add their own items to cart (unless no_secrets mode)
    if crud.is_shared_wishlist_owner(db, shared_item.wishlist_id, current_user_id):
        if (shared_wishlist.wishlist_type or "normal") != "no_secrets":
            raise HTTPException(status_code=403, detail="Owners cannot reserve items from their own shared wishlist")

    # Check if already in cart
    existing_cart_item = db.query(models.ShoppingCartItem).filter(
        models.ShoppingCartItem.buyer_id == current_user_id,
        models.ShoppingCartItem.shared_wishlist_item_id == shared_item.id,
    ).first()
    if existing_cart_item:
        raise HTTPException(status_code=409, detail="Item already in cart")

    # Check if already reserved by someone else
    if shared_item.is_purchased and shared_item.purchased_by != current_user.name:
        raise HTTPException(status_code=409, detail="Item already reserved by another user")

    # Create the cart item using the shared wishlist name as recipient_name
    db_item = models.ShoppingCartItem(
        buyer_id=current_user_id,
        recipient_id=None,  # No family member recipient for shared wishlists
        recipient_name=shared_wishlist.name,  # Use wishlist name as recipient
        shared_wishlist_item_id=shared_item.id,
        wishlist_item_id=None,
        title=shared_item.title,
        notes=None,
        link=shared_item.link,
        image_url=shared_item.image_url,
        price=shared_item.price,
        status="pending",
    )
    db.add(db_item)

    # Mark the shared item as purchased
    shared_item.is_purchased = True
    shared_item.purchased_by = current_user.name
    db.commit()
    db.refresh(db_item)
    return db_item


@app.put("/api/shopping-cart/{cart_item_id}", response_model=schemas.ShoppingCartItem)
def update_shopping_cart_item(
    cart_item_id: int = Path(...),
    updates: schemas.ShoppingCartItemUpdate = Body(...),
    db: Session = Depends(get_db),
):
    """Update a shopping cart item."""
    db_item = db.query(models.ShoppingCartItem).filter(models.ShoppingCartItem.id == cart_item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Shopping cart item not found")

    update_data = updates.model_dump(exclude_unset=True)
    if "link" in update_data and update_data["link"] is not None:
        update_data["link"] = str(update_data["link"])
    if "image_url" in update_data and update_data["image_url"] is not None:
        update_data["image_url"] = str(update_data["image_url"])
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = update_data["status"].value if hasattr(update_data["status"], "value") else update_data["status"]
        if update_data["status"] == "purchased" and not db_item.purchased_at:
            update_data["purchased_at"] = datetime.utcnow()

    for key, value in update_data.items():
        setattr(db_item, key, value)

    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/api/shopping-cart/{cart_item_id}")
def delete_shopping_cart_item(
    cart_item_id: int = Path(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header),
):
    """Delete a shopping cart item."""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current user context (X-Current-User-Id header) is required.")
    db_item = db.query(models.ShoppingCartItem).filter(models.ShoppingCartItem.id == cart_item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Shopping cart item not found")
    current_user = db.query(models.FamilyMember).filter(models.FamilyMember.id == current_user_id).first()

    # Clear purchased status on regular wishlist items
    if db_item.wishlist_item_id and current_user:
        wishlist_item = db.query(models.WishlistItem).filter(models.WishlistItem.id == db_item.wishlist_item_id).first()
        if wishlist_item and wishlist_item.purchased_by == current_user.name:
            wishlist_item.is_purchased = False
            wishlist_item.purchased_by = None

    # Clear purchased status on shared wishlist items
    if db_item.shared_wishlist_item_id and current_user:
        shared_item = db.query(models.SharedWishlistItem).filter(
            models.SharedWishlistItem.id == db_item.shared_wishlist_item_id
        ).first()
        if shared_item and shared_item.purchased_by == current_user.name:
            shared_item.is_purchased = False
            shared_item.purchased_by = None

    crud.detach_notifications_for_cart_items(db, [db_item.id])
    db.delete(db_item)
    db.commit()
    return {"success": True, "message": "Item removed from cart."}

@app.post("/api/shopping-cart/{cart_item_id}/copy", response_model=schemas.ShoppingCartItem)
def copy_shopping_cart_item(
    cart_item_id: int = Path(...),
    overrides: dict = Body(default={}),
    db: Session = Depends(get_db),
):
    """Copy a shopping cart item, optionally overriding fields."""
    source = db.query(models.ShoppingCartItem).filter(models.ShoppingCartItem.id == cart_item_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Shopping cart item not found")

    db_item = models.ShoppingCartItem(
        buyer_id=overrides.get("buyer_id", source.buyer_id),
        recipient_id=overrides.get("recipient_id", source.recipient_id),
        wishlist_item_id=source.wishlist_item_id,
        title=overrides.get("title", source.title),
        notes=overrides.get("notes", source.notes),
        link=overrides.get("link", source.link),
        image_url=source.image_url,
        price=overrides.get("price", source.price),
        status="pending",
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# --- Notifications ---

@app.get("/api/notifications", response_model=List[schemas.NotificationResponse])
def get_notifications(
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Get unread notifications for a user."""
    return db.query(models.Notification).filter(
        models.Notification.recipient_id == user_id,
        models.Notification.is_read == False,
    ).order_by(models.Notification.created_at.desc()).all()

@app.patch("/api/notifications/{notification_id}")
def mark_notification_read(
    notification_id: int = Path(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header),
):
    """Mark a notification as read (dismissed)."""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current user context (X-Current-User-Id header) is required.")
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.recipient_id == current_user_id,
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    return {"success": True}


@app.post("/api/members/{member_id}/send-wishlist-reminder")
def send_wishlist_reminder_to_member(
    member_id: int = Path(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header),
):
    """Send a generic wishlist update reminder to a specific member."""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current user context required.")

    recipient = crud.get_family_member(db, member_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="Member not found")

    reminder_prefix = "[WISHLIST_UPDATE_REMINDER]"
    existing = db.query(models.Notification).filter(
        models.Notification.recipient_id == member_id,
        models.Notification.is_read == False,
        models.Notification.message.like(f"{reminder_prefix}%"),
    ).first()
    if existing:
        return {"success": True, "already_sent": True}

    reminder_message = f"{reminder_prefix} Please review and update your wishlist."
    db.add(models.Notification(
        recipient_id=member_id,
        message=reminder_message,
        cart_item_id=None,
        is_read=False,
    ))
    db.commit()
    return {"success": True, "already_sent": False}


@app.post("/api/shared-wishlists/{wishlist_id}/send-owner-reminder")
def send_shared_wishlist_owner_reminder(
    wishlist_id: int = Path(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header),
):
    """Send a wishlist update reminder to all owners of a shared wishlist."""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current user context required.")

    shared_wishlist = db.query(models.SharedWishlist).filter(models.SharedWishlist.id == wishlist_id).first()
    if not shared_wishlist:
        raise HTTPException(status_code=404, detail="Shared wishlist not found")

    owners = crud.get_shared_wishlist_owners(db, wishlist_id)
    if not owners:
        raise HTTPException(status_code=404, detail="No owners found for this shared wishlist")

    reminder_prefix = "[WISHLIST_UPDATE_REMINDER]"
    reminder_message = f"{reminder_prefix} Please review and update the shared wishlist \"{shared_wishlist.name}\"."
    sent_count = 0
    already_sent_count = 0

    for owner in owners:
        if owner.id == current_user_id:
            continue
        existing = db.query(models.Notification).filter(
            models.Notification.recipient_id == owner.id,
            models.Notification.is_read == False,
            models.Notification.message.like(f"{reminder_prefix}%{shared_wishlist.name}%"),
        ).first()
        if existing:
            already_sent_count += 1
            continue
        db.add(models.Notification(
            recipient_id=owner.id,
            message=reminder_message,
            cart_item_id=None,
            is_read=False,
        ))
        sent_count += 1

    db.commit()
    return {"success": True, "sent_count": sent_count, "already_sent_count": already_sent_count}
