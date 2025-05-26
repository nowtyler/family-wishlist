# backend/app/schemas.py
from pydantic import BaseModel, Field, HttpUrl, validator
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
    is_admin: bool = False

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
    text: str = Field(..., min_length=1, max_length=1000)

    @validator('text')
    def text_not_empty(cls, v):
        if not v.strip():
            raise ValueError('Comment cannot be empty')
        return v.strip()

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
    price: Optional[int] = None

class WishlistItemCreate(WishlistItemBase):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    link: Optional[HttpUrl] = None
    image_url: Optional[HttpUrl] = None
    priority: int = Field(..., ge=0, le=2)
    price: Optional[float] = Field(None, ge=0, le=1000000)

    @validator('title')
    def title_not_empty(cls, v):
        if not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()

    @validator('price')
    def convert_price_to_cents(cls, v):
        if v is not None:
            return int(v * 100)
        return None

class WishlistItemUpdate(WishlistItemBase):
    title: Optional[str] = None
    description: Optional[str] = None
    link: Optional[HttpUrl] = None
    image_url: Optional[HttpUrl] = None
    priority: Optional[int] = None
    price: Optional[int] = None  # Make sure price is included
    is_purchased: Optional[bool] = None
    thinking_about_by: Optional[str] = None # Comma-separated list of names

class WishlistItem(WishlistItemBase):
    id: int
    owner_id: int
    is_purchased: bool
    purchased_by: Optional[str] = None  # Add this field
    thinking_about_by_list: List[str] = []
    comments: List[Comment] = []
    price: Optional[int] = None  # Make sure price is included in response

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