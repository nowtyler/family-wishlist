# backend/app/schemas.py
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Union
from datetime import date, datetime

# --- Password ---
class PasswordRequest(BaseModel):
    password: str

class PasswordVerificationResponse(BaseModel):
    authenticated: bool
    message: str

# --- Family Member ---
class FamilyMemberBase(BaseModel):
    name: str
    birthday: Optional[date] = None

class FamilyMemberCreate(FamilyMemberBase):
    pass

class FamilyMember(FamilyMemberBase):
    id: int
    wishlist_item_count: int = 0 # For summary card
    is_admin: bool = False  # Add this line

    class Config:
        from_attributes = True # Changed from orm_mode for Pydantic v2

# --- Comment ---
class CommentBase(BaseModel):
    text: str

class CommentCreate(CommentBase):
    author_id: int # This will be the ID of the logged-in (selected) user

class Comment(CommentBase):
    id: int
    author_id: int
    author_name: str # For display
    item_id: int
    created_at: datetime = datetime.now() # Assuming we add a timestamp later

    class Config:
        from_attributes = True

# --- Wishlist Item ---
class WishlistItemBase(BaseModel):
    title: str
    description: Optional[str] = None
    link: Optional[HttpUrl] = None
    image_url: Optional[HttpUrl] = None
    priority: int = 0

class WishlistItemCreate(WishlistItemBase):
    pass # owner_id will be set based on the selected user context

class WishlistItemUpdate(WishlistItemBase):
    title: Optional[str] = None
    description: Optional[str] = None
    link: Optional[HttpUrl] = None
    image_url: Optional[HttpUrl] = None
    priority: Optional[int] = None
    is_purchased: Optional[bool] = None
    thinking_about_by: Optional[str] = None # Comma-separated list of names

class WishlistItem(WishlistItemBase):
    id: int
    owner_id: int
    is_purchased: bool
    purchased_by: Optional[str] = None  # Add this field
    thinking_about_by_list: List[str] = []
    comments: List[Comment] = []

    class Config:
        from_attributes = True

# --- Gift Reminder ---
class GiftEvent(BaseModel):
    name: str # "Christmas" or "Tyler's Birthday"
    date: date
    days_until: int

class UpcomingEventResponse(BaseModel):
    event_name: str
    display_text: str # e.g., "in 10 days" or "on Jan 5"