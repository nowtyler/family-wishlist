# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
import logging
import traceback
from datetime import datetime

from . import crud, models, schemas, auth, database
from .database import engine, create_db_and_tables, get_db, SessionLocal
from .services.auth_service import AuthenticationService

# Create database tables on startup
# In a more complex app, you'd use Alembic migrations for this.
# For simplicity here, we create them if they don't exist.
# This should ideally be run by an entrypoint script or a separate command.
# database.Base.metadata.create_all(bind=engine)
# We will call create_db_and_tables() from startup event

app = FastAPI(title="Family Wishlist API", version="0.1.0")

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

# --- App Startup ---
@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    # Initialize family members from .env if they don't exist
    db = SessionLocal()
    try:
        crud.initialize_family_members(db)
    finally:
        db.close()
    print("Family Wishlist API startup complete. Database and tables checked/created.")


# --- Authentication ---
logger = logging.getLogger(__name__)

# Modify the verify_family_password endpoint to give better error messages
# Keep the /api prefix in the route
@app.post("/api/auth/verify-password", response_model=schemas.PasswordVerificationResponse)
async def verify_family_password(request: schemas.PasswordRequest):
    try:
        logger.debug(f"Received password verification request")
        if auth.verify_password(request.password):
            return {"authenticated": True, "message": "Password verified successfully."}
        return {"authenticated": False, "message": "Incorrect family password."}
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

@app.get("/api/family-members", response_model=List[schemas.FamilyMember])
def read_family_members(db: Session = Depends(get_db)):
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
@app.post("/api/members/{owner_id}/items", response_model=schemas.WishlistItem, status_code=status.HTTP_201_CREATED)
def create_item_for_member(
    owner_id: int,
    item: schemas.WishlistItemCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    if current_user_id is None or current_user_id != owner_id:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only add items to your own wishlist.")
    db_member = crud.get_family_member(db, member_id=owner_id)
    if not db_member:
        raise HTTPException(status_code=404, detail="Owner (family member) not found")
    
    created_item = crud.create_wishlist_item(db=db, item=item, owner_id=owner_id)
    # Convert to schema, handling potential None for link/image_url
    return schemas.WishlistItem(
        id=created_item.id,
        title=created_item.title,
        description=created_item.description,
        link=str(created_item.link) if created_item.link else None,
        image_url=str(created_item.image_url) if created_item.image_url else None,
        priority=created_item.priority,
        owner_id=created_item.owner_id,
        is_purchased=created_item.is_purchased,
        thinking_about_by_list=[], # New item won't have these
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

    db_item_model = crud.update_wishlist_item(db, item_id, item_update, current_user_id)
    if not db_item_model:
        raise HTTPException(status_code=404, detail="Item not found or not authorized to update.")

    # Re-fetch or carefully construct the response schema
    # For simplicity, we assume update_wishlist_item returns the updated model.
    # We need to convert it to the response schema, including processed fields.
    thinking_by_list = db_item_model.thinking_about_by.split(',') if db_item_model.thinking_about_by else []
    # Comments would need to be re-fetched or handled if they can be updated here (they can't directly)
    
    # Crucially, what the user sees depends on whether they are the owner or not.
    # The crud.update_wishlist_item should handle the database state.
    # When fetching for response, we might need to apply similar logic as get_wishlist_items_by_owner.
    # For now, return the direct state post-update. Frontend needs to be smart.
    
    # Let's reload the item as if the current_user_id is viewing it to ensure consistent response rules
    # This is inefficient but ensures correct response data visibility
    reloaded_items = crud.get_wishlist_items_by_owner(db, owner_id=db_item_model.owner_id, current_user_id=current_user_id)
    updated_item_schema = next((i for i in reloaded_items if i.id == item_id), None)

    if not updated_item_schema:
         # This case should ideally not happen if update was successful and item still matches criteria
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
    
    success = crud.delete_wishlist_item(db, item_id, current_user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found or not authorized to delete.")
    return # No content response

# --- Comments ---
@app.post("/api/items/{item_id}/comments", response_model=schemas.Comment, status_code=status.HTTP_201_CREATED)
def add_comment_to_item(
    item_id: int,
    comment_data: schemas.CommentCreate, # Frontend sends text, backend determines author_id from header
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id_from_header)
):
    if current_user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User context required to comment.")
    
    # Ensure the author_id in the payload matches the current user context to prevent impersonation
    # Or, better, derive author_id from current_user_id directly and ignore any author_id in payload
    comment_data_with_author = schemas.CommentCreate(text=comment_data.text, author_id=current_user_id)

    try:
        created_comment_model = crud.create_comment(db, item_id, comment_data_with_author, author_id=current_user_id)
    except ValueError as e: # e.g., commenting on own item
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    # Fetch author details for the response
    author_model = crud.get_family_member(db, created_comment_model.author_id)
    author_name = author_model.name if author_model else "Unknown"

    return schemas.Comment(
        id=created_comment_model.id,
        text=created_comment_model.text,
        author_id=created_comment_model.author_id,
        author_name=author_name,
        item_id=created_comment_model.item_id,
        # created_at will be handled by model default or db if set up
    )

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

# Catch-all for documentation (FastAPI provides /docs and /redoc automatically)
# If you were serving a frontend from FastAPI, you'd have a catch-all route here.