# backend/app/schemas.py
from pydantic import BaseModel, Field, HttpUrl, validator, EmailStr
from typing import List, Optional, Union
from datetime import date, datetime
from enum import Enum

class PriorityLevel(int, Enum):
    LOW = 0
    MEDIUM = 1
    HIGH = 2

# --- Password ---
class PasswordRequest(BaseModel):
    password: str = Field(
        ...,
        min_length=8,
        max_length=50,
        description="Family password for authentication"
    )

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
    title: str = Field(
        ..., 
        min_length=1, 
        max_length=200,
        description="Title of the wishlist item"
    )
    description: Optional[str] = Field(
        None, 
        max_length=2000,
        description="Optional detailed description of the item"
    )
    link: Optional[HttpUrl] = Field(
        None,
        description="URL link to the item on an external website"
    )
    image_url: Optional[HttpUrl] = Field(
        None,
        description="URL of an image representing the item"
    )
    priority: PriorityLevel = Field(
        PriorityLevel.MEDIUM,
        description="Priority level of the item (0=Low, 1=Medium, 2=High)"
    )
    price: Optional[float] = Field(
        None,
        ge=0,
        le=1000000,
        description="Price of the item in dollars (will be converted to cents)"
    )

    @validator('title')
    def validate_title(cls, v):
        if not v.strip():
            raise ValueError('Title cannot be empty')
        if any(char in v for char in '<>{}'):
            raise ValueError('Title contains invalid characters')
        return v.strip()

    @validator('description')
    def validate_description(cls, v):
        if v and any(char in v for char in '<>{}'):
            raise ValueError('Description contains invalid characters')
        return v.strip() if v else None

    @validator('price')
    def validate_price(cls, v):
        if v is not None:
            if v < 0:
                raise ValueError('Price cannot be negative')
            return int(v * 100)  # Convert to cents
        return None

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Nintendo Switch",
                "description": "OLED Model - White",
                "link": "https://www.amazon.com/Nintendo-Switch-OLED-Model-White/dp/B098RKWHHZ",
                "image_url": "https://example.com/switch.jpg",
                "priority": 2,
                "price": 349.99
            }
        }

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