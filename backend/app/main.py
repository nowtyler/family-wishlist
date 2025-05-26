# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException, status, Header, Request, Body, Path, Query
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
import logging
import traceback
from datetime import datetime
from pydantic import BaseModel

from . import crud, models, schemas, auth, database
from .database import engine, create_db_and_tables, get_db, SessionLocal
from .services.auth_service import AuthenticationService
from .middleware.rate_limiter import RateLimiter

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

# Enhanced API documentation
app = FastAPI(
    title="Family Wishlist API",
    description="""
    A family wishlist application API that allows family members to:
    * Create and manage wishlists
    * Mark items as "thinking about" or "purchased"
    * Add comments on wishlist items
    * Track upcoming events and gift reminders
    """,
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
    "http://localhost:8888",  # Add local Docker port
    "http://192.168.50.188:8888",  # Add your local IP
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

# Initialize rate limiter
rate_limiter = RateLimiter(requests_per_minute=60)

# --- App Startup ---
@app.on_event("startup")
async def startup_event():
    # Create the database and tables
    create_db_and_tables()
    
    # Initialize family members from .env if they don't exist
    db = SessionLocal()
    try:
        crud.initialize_family_members(db)
    finally:
        db.close()
    print("Family Wishlist API startup complete. Database and tables checked/created.")

    await rate_limiter.start_cleanup()

# Add rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    await rate_limiter.check_rate_limit(request)
    response = await call_next(request)
    return response

# Enhanced error responses
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path
        }
    )

# --- Authentication ---
logger = logging.getLogger(__name__)

@app.post("/api/auth/verify-password", 
    response_model=schemas.PasswordVerificationResponse,
    tags=["Authentication"],
    summary="Verify family password",
    responses={
        200: {"description": "Password verification result"},
        429: {"description": "Too many failed attempts"}
    }
)
async def verify_family_password(
    request: schemas.PasswordRequest = Body(
        ...,
        examples={
            "normal": {
                "summary": "Valid password",
                "value": {"password": "your-family-password"}
            }
        }
    )
):
    """
    Verify the family password for access to the application.
    
    Rate limited to prevent brute force attacks.
    """
    try:
        logger.debug(f"Received password verification request")
        if auth.verify_password(request.password):
            return {"authenticated": True, "message": "Password verified successfully."}
        return {"authenticated": False, "message": "Incorrect family password."}
    except ValueError as e:
        # Handle lockout error
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Password verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during password verification.",
        )

# --- Family Members ---
# The "current_user_id" will be passed from the frontend after user selection.
# It's not a secure "logged-in" session user ID but rather context for display.
def get_current_user_id_from_header(x_current_user_id: Optional[int] = Header(None)) -> Optional[int]:
    if x_current_user_id is None:
        # For some public endpoints or if user context isn't strictly needed for a route.
        # However, for most wishlist operations, we'll need it.
        # Consider raising HTTPException if it's mandatory for a route.
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
    db: Session = Depends(get_db)
):
    """
    Retrieve all family members with their wishlist item counts.
    """
    members = crud.get_family_members(db)
    members_with_counts = []
    for member in members:
        count = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == member.id).count()
        # Ensure birthday is correctly formatted if present
        member_schema = schemas.FamilyMember.from_orm(member)
        member_schema.wishlist_item_count = count
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

    updated_item = crud.update_wishlist_item(db, item_id, item_update, current_user_id)
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
    
    updated_item_model = crud.toggle_thinking_about(db, item_id, current_user_id)
    if not updated_item_model:
        raise HTTPException(status_code=404, detail="Item not found or operation not allowed (e.g., owner trying to mark own item).")

    # Similar to update, reconstruct the view
    reloaded_items = crud.get_wishlist_items_by_owner(db, owner_id=updated_item_model.owner_id, current_user_id=current_user_id)
    updated_item_schema = next((i for i in reloaded_items if i.id == item_id), None)
    if not updated_item_schema:
         raise HTTPException(status_code=500, detail="Failed to reconstruct item view after toggling 'thinking about'.")
    return updated_item_schema

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
        
        if item.owner_id == current_user_id:
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
            created_at=datetime.now()
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Gift Reminder ---
@app.get("/api/upcoming-event", response_model=Optional[schemas.UpcomingEventResponse])
def get_upcoming_gift_event():
    event = crud.get_next_gift_event()
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
    user = crud.get_family_member(db, current_user_id)
    print(f"Version update request from user: {user.name if user else 'None'}, id: {current_user_id}, is_admin: {user.is_admin if user else False}")
    
    new_version = crud.update_system_version(db, version_update.version, current_user_id)
    if not new_version:
        raise HTTPException(status_code=403, detail="Only admin can update version")
    return {"version": new_version}


# More explicit health check
@app.get("/api/health")
async def health_check():
    try:
        # Test database connection
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected"
        }
    except Exception as e:
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