# backend/app/schemas.py
from pydantic import BaseModel, Field, HttpUrl, validator, EmailStr
from typing import List, Optional, Union, Dict, Any
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

class FamilyMemberPreferencesUpdate(BaseModel):
    preferences: Dict[str, Any]

class FamilyMember(BaseModel):
    id: int
    name: str
    birthday: Optional[str] = None
    wishlist_item_count: Optional[int] = 0
    is_admin: Optional[bool] = False
    preferences: Optional[Dict[str, Any]] = None

    class Config:
        orm_mode = True
        from_attributes = True  # For newer versions of Pydantic

# --- Comment ---
class CommentBase(BaseModel):
    text: str

class CommentCreate(CommentBase):
    text: str = Field(
        ..., 
        min_length=1, 
        max_length=1000,
        description="Comment text content"
    )
    # Remove author_id requirement as it will be derived from the header

    class Config:
        json_schema_extra = {
            "example": {
                "text": "I am thinking of getting this."
            }
        }

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

class WishlistItemCreate(BaseModel):
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
            # Convert dollars to cents and ensure it's an integer
            return int(round(v * 100))
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

class WishlistItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    link: Optional[str] = None
    image_url: Optional[str] = None
    priority: Optional[int] = None
    price: Optional[Union[float, int, None]] = None  # Allow either float or int
    
    class Config:
        # Enable ORM mode for Pydantic
        from_attributes = True  # Modern Pydantic v2 name
        orm_mode = True  # Legacy name for compatibility

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

# --- Migration Management ---
class MigrationInfo(BaseModel):
    version: str
    description: str
    applied: bool = False
    protected: bool = False  # Add this line

class MigrationList(BaseModel):
    current_version: str
    available_migrations: List[MigrationInfo]
    stored_schema_hash: Optional[str]
    needs_upgrade: bool
    db_version: str  # "legacy" or "current"

class MigrationResponse(BaseModel):
    success: bool
    message: str
    new_version: Optional[str] = None

# --- Backup Management ---
class BackupInfo(BaseModel):
    filename: str
    created_at: datetime
    size_kb: float
    can_restore: bool
    version: str  # Add this field

class BackupList(BaseModel):
    backups: List[BackupInfo]
    backup_directory: str

class BackupResponse(BaseModel):
    success: bool
    message: str
    backup_path: Optional[str] = None

class RestoreResponse(BaseModel):
    success: bool
    message: str
    requires_migration: bool = False
    backup_version: Optional[str] = None
    current_version: Optional[str] = None

# --- Admin Access ---
class AdminAccessResponse(BaseModel):
    id: int
    name: str
    is_admin: bool = True
    message: str = "Admin access granted"

# --- External Wishlist ---
class ExternalWishlistBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    url: HttpUrl = Field(..., description="URL to the external wishlist")

class ExternalWishlistCreate(ExternalWishlistBase):
    pass

class ExternalWishlistUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[HttpUrl] = None

class ExternalWishlist(ExternalWishlistBase):
    id: int
    owner_id: int
    
    class Config:
        from_attributes = True