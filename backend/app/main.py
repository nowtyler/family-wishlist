# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException, status, Header, Request, Body, Path, Query
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
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
from .services.auth_service import AuthenticationService
from .services.migration_service import MigrationService
from .services.backup_service import BackupService
from .services.url_scraper import ProductScraper
from .services.user_auth_service import UserAuthService
from .services.email_service import EmailService
from .services.emergency_token_service import EmergencyTokenService
from .middleware.rate_limiter import RateLimiter
from .deps import validate_password_strength
import secrets
import psutil
import json
import time
import pytz
from .utils.timezone_utils import get_est_timestamp, get_est_timestamp_iso, get_est_timestamp_strftime, get_est_date, get_est_timedelta

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
ENVIRONMENT = os.getenv("ENVIRONMENT", "prod").lower()
IS_DEV = ENVIRONMENT == "dev"
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
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:8888",  # Add local Docker testing port
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
rate_limiter = RateLimiter(requests_per_minute=60)

# Initialize emergency token service
emergency_token_service = EmergencyTokenService()

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
        except Exception as e:
            logger.error(f"Failed to initialize family members: {e}")
            # Don't block app startup - we'll handle admin access separately
        finally:
            db.close()
        
        # Check for schema changes and auto-generate migrations if needed
        try:
            from .services.migration_service import MigrationService
            migration_service = MigrationService(DATABASE_PATH)
            
            # Check if there are pending changes that need migration
            if migration_service.detect_model_changes():
                logger.info("Schema changes detected during startup, attempting to auto-generate migration...")
                try:
                    auto_migration = migration_service.auto_generate_migration()
                    if auto_migration:
                        logger.info(f"Auto-generated migration during startup: {auto_migration}")
                    else:
                        logger.warning("Failed to auto-generate migration during startup")
                except Exception as e:
                    logger.error(f"Error auto-generating migration during startup: {e}")
        except Exception as e:
            logger.warning(f"Migration service not available during startup: {e}")
        
        logger.info("Family Wishlist API startup complete. Database and tables checked/created.")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
        logger.info(f"WARNING: Database initialization error: {e}")
        # Continue startup despite errors - we'll provide emergency access
    
    await rate_limiter.start_cleanup()

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
        # Regular users can only see members who share households with them
        try:
            # Get current user's household IDs
            current_user_households_query = db.query(models.user_household_association.c.household_id).filter(
                models.user_household_association.c.user_id == current_user_id,
                models.user_household_association.c.status == 'active'
            )
            current_user_households = {row[0] for row in current_user_households_query.all()}
            
            if not current_user_households:
                # If user has no households, they can only see themselves
                members = [current_user]
            else:
                # Get all users who share at least one household with current user
                household_member_ids_query = db.query(models.user_household_association.c.user_id).filter(
                    models.user_household_association.c.household_id.in_(current_user_households),
                    models.user_household_association.c.status == 'active'
                ).distinct()
                household_member_ids = {row[0] for row in household_member_ids_query.all()}
                
                # Get family members who are in the same households
                members = db.query(models.FamilyMember).filter(
                    models.FamilyMember.id.in_(household_member_ids)
                ).all()
                
        except Exception as e:
            logger.error(f"Error filtering family members by household for user {current_user_id}: {e}")
            # Fallback: only show current user
            members = [current_user]
    
    members_with_counts = []
    for member in members:
        count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == member.id).count()
        # Get household count for this member
        household_count = db.query(models.user_household_association).filter(
            models.user_household_association.c.user_id == member.id
        ).count()
        # Ensure birthday is correctly formatted if present
        member_schema = schemas.FamilyMember.from_orm(member)
        member_schema.wishlist_item_count = count
        member_schema.household_count = household_count
        members_with_counts.append(member_schema)
    return members_with_counts


@app.get("/api/family-members/{member_id}", response_model=schemas.FamilyMember)
def read_family_member(member_id: int, db: Session = Depends(get_db)):
    db_member = crud.get_family_member(db, member_id=member_id)
    if db_member is None:
        raise HTTPException(status_code=404, detail="Family member not found")
    count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == db_member.id).count()
    member_schema = schemas.FamilyMember.from_orm(db_member)
    member_schema.wishlist_item_count = count
    return member_schema


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
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header) # Who is viewing
):
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current user context (X-Current-User-Id header) is required.")
    
    db_member = crud.get_family_member(db, member_id=owner_id)
    if not db_member:
        raise HTTPException(status_code=404, detail="Family member not found")
    
    # crud function handles hiding purchased items from owner and comments
    return crud.get_wishlist_items_by_owner(db, owner_id=owner_id, current_user_id=current_user_id)

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
    logger.info(f"Update data received: {item_update.dict()}")
    
    # Process the update data - similar to create logic
    update_data = item_update.dict(exclude_unset=True)
    
    # Handle price conversion the same way as in create_wishlist_item
    if 'price' in update_data and update_data['price'] is not None:
        try:
            # Store price in cents as integer
            update_data['price'] = int(float(update_data['price']) * 100)
            logger.info(f"Processed price: {update_data['price']} cents")
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
    
    # Create export data - convert price from cents to dollars for export
    export_data = {
        "items": [
            {
                "title": item.title,
                "description": item.description,
                "link": str(item.link) if item.link else None,
                "image_url": str(item.image_url) if item.image_url else None,
                "priority": item.priority,
                "price": float(item.price) / 100 if item.price is not None else None
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
            # Convert price to cents for comparison and storage
            import_price_cents = int(float(item_data.price) * 100) if item_data.price is not None else None
            
            # Check for exact duplicate - compare with price in cents
            is_duplicate = any(
                existing_item.title == item_data.title and
                existing_item.description == item_data.description and
                str(existing_item.link) == (str(item_data.link) if item_data.link else None) and
                str(existing_item.image_url) == (str(item_data.image_url) if item_data.image_url else None) and
                existing_item.priority == item_data.priority and
                existing_item.price == import_price_cents
                for existing_item in existing_items
            )
            
            if is_duplicate:
                skipped_items.append(item_data.title)
                continue
                
            # Create item if not a duplicate - price is already in cents
            item_create = schemas.WishlistItemCreate(
                title=item_data.title,
                description=item_data.description,
                link=item_data.link,
                image_url=item_data.image_url,
                priority=item_data.priority,
                price=import_price_cents
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
        
        try:
            stored_hash = crud.get_schema_hash(db)
            current_hash = migration_service.get_schema_hash()
            
            # First check for multiple heads - this always requires migration
            has_multiple_heads = "," in current_version
            
            # Check for non-"pending" migrations that are not yet applied
            has_pending_migrations = any(m.version != "pending" and not m.applied for m in available_migrations)
            
            # Only check for model changes if we don't have other clear indicators
            needs_schema_check = not (has_multiple_heads or has_pending_migrations)
            model_changes_detected = False
            
            if needs_schema_check and stored_hash != current_hash:
                # Log that we're checking for model changes
                logger.info(f"Schema hashes don't match, verifying actual schema changes...")
                
                # Attempt to update hash if models match but hashes don't
                # This helps address "false positive" needs_upgrade flags
                try:
                    # If we're at the current version (and not "base") and hashes don't match,
                    # then we can update the hash without requiring migration
                    # Check if alembic config is available
                    if migration_service.alembic_cfg is not None:
                        script_dir = alembic.script.ScriptDirectory.from_config(migration_service.alembic_cfg)
                        head = script_dir.get_current_head()
                        
                        if current_version == head and head != "base":
                            # We're at current head version, just hash mismatch - update the hash silently
                            logger.info(f"Schema hash mismatch but database is at current head version. Updating hash...")
                            crud.update_schema_hash(db, current_hash)
                            stored_hash = current_hash  # Set them equal to avoid marking as needs_upgrade
                    else:
                        # Actually check for model changes
                        model_changes_detected = migration_service.detect_model_changes()
                except Exception as hash_fix_error:
                    logger.error(f"Error during hash sync: {hash_fix_error}")
                    # Don't assume we need upgrade just because of this error
            
            # A migration is needed if:
            # 1. We have multiple heads (always requires merge) OR
            # 2. We have pending migrations that are not applied OR
            # 3. We have actual model changes detected
            needs_upgrade = has_multiple_heads or has_pending_migrations or model_changes_detected
            
            logger.info(f"Schema status - Stored: {stored_hash[:8] if stored_hash else 'None'}... Current: {current_hash[:8]}... "
                        f"Multiple heads: {has_multiple_heads}, Pending migrations: {has_pending_migrations}, "
                        f"Model changes: {model_changes_detected}, Needs upgrade: {needs_upgrade}")
        except Exception as e:
            logger.error(f"Schema hash error: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            stored_hash = None
            current_hash = None
            # Don't automatically mark as needs_upgrade on error, this causes false positives
            # Only mark as needing upgrade if we have multiple heads or pending migrations
            needs_upgrade = "," in current_version or any(m.version != "pending" and not m.applied for m in available_migrations)
        
        return {
            "current_version": current_version,
            "available_migrations": available_migrations,
            "stored_schema_hash": stored_hash,
            "needs_upgrade": needs_upgrade,
            "db_version": "current"  # Remove bootstrap/legacy references
        }
    except Exception as e:
        logger.error(f"Migration error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "current_version": "unknown",
            "available_migrations": [],
            "stored_schema_hash": None,
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
        
        # Check if emergency access key exists in encrypted file storage
        emergency_key_exists = emergency_token_service.token_exists()
        
        return {
            "is_setup_complete": admin_exists and emergency_key_exists,
            "needs_admin": not admin_exists,
            "needs_emergency_key": not emergency_key_exists
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
                status_code=status.HTTP_400_BAD_REQUEST,
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
        db.add(admin)
        
        # Generate and store emergency access key using encrypted file storage
        emergency_key = emergency_token_service.generate_token()
        if not emergency_token_service.save_token(emergency_key):
            logger.error("Failed to save emergency token to encrypted file")
            # Still save to database as fallback
            emergency_config = models.SystemConfig(
                key="emergency_access_key",
                value=emergency_key,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(emergency_config)
        else:
            logger.info("Emergency token saved to encrypted file storage")
        
        db.commit()
        db.refresh(admin)
        
        return schemas.FirstTimeSetupResponse(
            success=True,
            message="System setup completed successfully",
            emergency_access_key=emergency_key,
            admin_user=schemas.FamilyMember(
                id=admin.id,
                name=admin.name,
                username=admin.username,
                email=admin.email,
                is_admin=admin.is_admin,
                wishlist_item_count=0
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"First-time setup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# Replace the existing emergency admin access endpoint
@app.post("/api/emergency/admin-access", response_model=schemas.EmergencyAccessResponse)
async def emergency_admin_access_secure(
    request: schemas.EmergencyAccessRequest,
    client_host: str = Header(None, alias="X-Forwarded-For"),
    db: Session = Depends(get_db)
):
    """Secure emergency endpoint to get admin access with file-based encrypted token validation"""
    try:
        # Get emergency token from encrypted file storage
        stored_token = emergency_token_service.get_token()
        
        if not stored_token:
            logger.error("Emergency access token not found in encrypted storage")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Emergency access not configured"
            )
        
        if request.emergency_token != stored_token:
            logger.warning("Emergency access attempt with invalid token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid emergency access token"
            )
        
        # Get real IP address
        real_ip = client_host
        if not real_ip:
            real_ip = "unknown"
        
        # Get admin user
        admin = db.query(models.FamilyMember).filter(
            models.FamilyMember.is_admin == True
        ).first()
        
        if not admin:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No admin user found"
            )
        
        return schemas.EmergencyAccessResponse(
            success=True,
            message="Emergency admin access granted",
            admin_user=schemas.FamilyMember(
                id=admin.id,
                name=admin.name,
                username=admin.username,
                email=admin.email,
                is_admin=admin.is_admin,
                wishlist_item_count=0
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Emergency admin access error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.put("/api/admin/emergency-token", response_model=schemas.UpdateEmergencyTokenResponse)
async def update_emergency_token(
    request: schemas.UpdateEmergencyTokenRequest,
    current_user_id: int = Depends(get_current_user_id_from_header),
    db: Session = Depends(get_db)
):
    """Update the emergency access token (admin only)"""
    if not current_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    user = db.query(models.FamilyMember).filter(models.FamilyMember.id == current_user_id).first()
    if not user or not (user.is_admin or user.name.lower() == 'admin'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    try:
        success = emergency_token_service.update_token(request.new_token)
        if success:
            logger.info(f"Emergency token updated by admin user {user.username}")
            return schemas.UpdateEmergencyTokenResponse(
                success=True,
                message="Emergency token updated successfully"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update emergency token"
            )
    except Exception as e:
        logger.error(f"Error updating emergency token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/api/admin/emergency-token/info", response_model=schemas.EmergencyTokenInfoResponse)
async def get_emergency_token_info(
    current_user_id: int = Depends(get_current_user_id_from_header),
    db: Session = Depends(get_db)
):
    """Get emergency token information (admin only)"""
    if not current_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    user = db.query(models.FamilyMember).filter(models.FamilyMember.id == current_user_id).first()
    if not user or not (user.is_admin or user.name.lower() == 'admin'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    try:
        token_info = emergency_token_service.get_token_info()
        if token_info:
            return schemas.EmergencyTokenInfoResponse(**token_info)
        else:
            return schemas.EmergencyTokenInfoResponse(
                exists=False,
                created_at=None,
                updated_at=None,
                has_token=False
            )
    except Exception as e:
        logger.error(f"Error getting emergency token info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/api/admin/emergency-token/generate", response_model=schemas.UpdateEmergencyTokenResponse)
async def generate_new_emergency_token(
    current_user_id: int = Depends(get_current_user_id_from_header),
    db: Session = Depends(get_db)
):
    """Generate a new emergency access token (admin only)"""
    if not current_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    user = db.query(models.FamilyMember).filter(models.FamilyMember.id == current_user_id).first()
    if not user or not (user.is_admin or user.name.lower() == 'admin'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    try:
        new_token = emergency_token_service.generate_token()
        success = emergency_token_service.update_token(new_token)
        
        if success:
            logger.info(f"New emergency token generated by admin user {user.username}")
            return schemas.UpdateEmergencyTokenResponse(
                success=True,
                message=f"New emergency token generated: {new_token}"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save new emergency token"
            )
    except Exception as e:
        logger.error(f"Error generating new emergency token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/api/admin/emergency-access", response_model=schemas.FamilyMember)
async def emergency_admin_access(
    db: Session = Depends(get_db)
):
    """Emergency endpoint to get or create admin access - DEPRECATED, use /api/emergency/admin-access instead"""
    logger.warning("Deprecated emergency access endpoint used - recommend using /api/emergency/admin-access")
    try:
        # Try to find existing admin user
        admin = db.query(models.FamilyMember).filter(
            models.FamilyMember.name.ilike('admin')
        ).first()
        
        if not admin:
            # Create admin user if doesn't exist
            admin = models.FamilyMember(
                name="Admin",
                is_admin=True,
                username="admin",
                email="admin@emergency.local"
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
        elif not admin.is_admin:
            # Ensure admin flag is set
            admin.is_admin = True
            db.commit()
            db.refresh(admin)
            
        return schemas.FamilyMember(
            id=admin.id,
            name=admin.name,
            is_admin=admin.is_admin,
            wishlist_item_count=0
        )
    except Exception as e:
        logger.error(f"Emergency admin access error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to access admin: {str(e)}"
        )

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
            detail="You can only add external wishlists to your own profile unless you're an admin."
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

# --- User Authentication ---
@app.post("/api/auth/login", response_model=schemas.LoginResponse)
async def login(
    request: schemas.LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate a user with username and password.
    """
    try:
        success, message, user = UserAuthService.authenticate_user(db, request.username, request.password)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=message
            )
        
        return schemas.LoginResponse(
            success=True,
            message=message,
            user=schemas.FamilyMember(
                id=user.id,
                name=user.name,
                username=user.username,
                email=user.email,
                is_admin=user.is_admin,
                wishlist_item_count=0
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
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
    db: Session = Depends(get_db)
):
    """
    Register a new user with username, password, etc.
    """
    try:
        # Validate password strength
        if not validate_password_strength(user_data.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters and include uppercase, lowercase, and numbers"
            )
        
        success, message, user = UserAuthService.register_new_user(db, user_data)
        
        if success and user:
            return {
                "success": True,
                "message": "Registration successful",
                "user_id": user.id,
                "is_admin": user.is_admin
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
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
    db: Session = Depends(get_db)
):
    """
    Request a password reset by username or email.
    """
    try:
        success, message = UserAuthService.create_reset_token(db, request.username_or_email)
        
        return {
            "success": success,
            "message": message
        }
    except Exception as e:
        logger.error(f"Password reset request error: {str(e)}")
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
    db: Session = Depends(get_db)
):
    """
    Complete the password reset with token and new password.
    """
    try:
        # Validate password strength
        if not validate_password_strength(request.new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters and include uppercase, lowercase, and numbers"
            )
        
        success, message = UserAuthService.reset_password(db, request.token, request.new_password)
        
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
            
        success = migration_service.reset_schema_hash()
        if success:
            # Also update the hash in system_settings
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
        # Get households with their actual members
        households = []
        for h in db.query(models.Household).all():
            # Get members for this household
            members = db.query(models.FamilyMember).join(
                models.user_household_association,
                models.FamilyMember.id == models.user_household_association.c.user_id
            ).filter(
                models.user_household_association.c.household_id == h.id
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
            
            household_dict = {
                "id": h.id,
                "name": h.name,
                "description": h.description,
                "created_at": h.created_at,
                "created_by": h.created_by,
                "member_count": len(members),
                "members": member_schemas
            }
            households.append(schemas.HouseholdWithMembers(**household_dict))
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
        
        # Get active users in last 30 days (if you have login tracking)
        thirty_days_ago = get_est_timedelta(days=-30)
        active_users = db.query(models.FamilyMember).count()  # For now, just count all users
        
        return {
            "total_users": total_users,
            "total_households": total_households,
            "total_wishlists": total_wishlists,
            "total_emails_sent": total_emails_sent,
            "active_users_30d": active_users
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
                use_tls=True,
                use_ssl=False,
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
    if not user or not user.is_admin:
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
    try:
        # Verify admin
        member = crud.get_family_member(db, current_user_id)
        if not member or not member.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")

        # Get email service
        email_service = EmailService(db)

        # Send test email
        log = email_service.test_email_settings(test_request.recipient_email)
        return log
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
            "version": "1.0.0",
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
        # Get all items with owner information
        items = db.query(models.WishlistItem).join(models.FamilyMember).all()
        
        result = []
        for item in items:
            # Get households for the owner
            households = db.query(models.Household).join(
                models.user_household_association,
                models.Household.id == models.user_household_association.c.household_id
            ).filter(models.user_household_association.c.user_id == item.owner_id).all()
            
            household_names = [h.name for h in households] if households else ["No household"]
            
            result.append({
                "id": item.id,
                "title": item.title,
                "description": item.description,
                "owner_id": item.owner_id,
                "owner_name": item.owner.name,
                "households": household_names,
                "is_purchased": item.is_purchased,
                "purchased_by": item.purchased_by,
                "priority": item.priority,
                "price": item.price,
                "created_at": item.id  # Using ID as proxy for creation order since created_at isn't in model
            })
        
        return result
    except Exception as e:
        logger.error(f"Failed to get all items: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get all items: {str(e)}"
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
    """Get current database version from migrations (admin only)"""
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required")
    
    # Check admin privileges
    user = crud.get_family_member(db, current_user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    try:
        # Get migrations to find current version
        from .services.migration_service import get_current_version
        current_version = get_current_version(db)
        return {"current_version": current_version}
    except Exception as e:
        logger.error(f"Failed to get database version: {e}")
        return {"current_version": "unknown"}

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