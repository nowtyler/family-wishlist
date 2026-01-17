# backend/app/schemas.py
from pydantic import BaseModel, Field, HttpUrl, validator, EmailStr, model_validator
from typing import List, Optional, Union, Dict, Any
from datetime import date, datetime
from enum import Enum

class PriorityLevel(int, Enum):
    LOW = 0
    MEDIUM = 1
    HIGH = 2

class HouseholdStatus(str, Enum):
    ACTIVE = "active"
    PENDING = "pending"
    DECLINED = "declined"

# Base models first
class FamilyMemberBase(BaseModel):
    name: str
    birthday: Optional[str] = None
    is_admin: Optional[bool] = False
    preferences: Optional[Dict[str, Any]] = None
    username: Optional[str] = None
    email: Optional[str] = None
    force_password_change: Optional[bool] = False

class HouseholdBase(BaseModel):
    name: str
    description: Optional[str] = None

class FamilyMember(FamilyMemberBase):
    id: int
    wishlist_item_count: Optional[int] = 0
    external_wishlist_count: Optional[int] = 0
    household_count: Optional[int] = 0

    class Config:
        from_attributes = True

class Household(HouseholdBase):
    id: int
    created_at: datetime
    created_by: int
    member_count: Optional[int] = 0

    class Config:
        from_attributes = True

class HouseholdMember(BaseModel):
    id: int
    name: str
    username: Optional[str] = None
    email: Optional[str] = None
    is_admin: bool = False

    class Config:
        from_attributes = True

class HouseholdWithMembers(HouseholdBase):
    id: int
    created_at: datetime
    created_by: int
    member_count: Optional[int] = 0
    members: List[HouseholdMember] = []

    class Config:
        from_attributes = True

class EmailSettingsBase(BaseModel):
    smtp_server: str
    smtp_port: int = Field(..., ge=1, le=65535)
    smtp_username: str
    smtp_password: str
    from_email: EmailStr
    from_name: str
    use_tls: bool = True
    use_ssl: bool = False

class EmailSettingsUpdate(BaseModel):
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = Field(None, ge=1, le=65535)
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: Optional[EmailStr] = None
    from_name: Optional[str] = None
    use_tls: Optional[bool] = None
    use_ssl: Optional[bool] = None
    is_active: Optional[bool] = None

class EmailSettings(EmailSettingsBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class EmailTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    subject: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1)

class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    subject: Optional[str] = Field(None, min_length=1, max_length=200)
    body: Optional[str] = Field(None, min_length=1)
    is_active: Optional[bool] = None

class EmailTemplate(EmailTemplateBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class EmailLog(BaseModel):
    id: int
    recipient_email: str
    recipient_name: Optional[str] = None
    subject: str
    body: str
    template_name: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    sent_at: datetime

    class Config:
        from_attributes = True

class EmailTestRequest(BaseModel):
    recipient_email: EmailStr
    template_name: Optional[str] = None

# --- Base Models ---
class BaseResponse(BaseModel):
    success: bool
    message: str

# --- Authentication ---
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseResponse):
    user: 'FamilyMember'

class UserRegisterRequest(BaseModel):
    username: str
    password: str
    name: str
    email: EmailStr
    birthday: Optional[date] = None

class AuthResponse(BaseResponse):
    user_id: Optional[int] = None
    is_admin: Optional[bool] = None

class PasswordResetRequest(BaseModel):
    username_or_email: str

class PasswordResetConfirmRequest(BaseModel):
    token: str
    new_password: str

# Admin user management schemas
class AdminUserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=8, max_length=50)
    name: str
    email: Optional[EmailStr] = None
    birthday: Optional[date] = None
    is_admin: bool = False

class AdminUserUpdateRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=20)
    password: Optional[str] = Field(None, min_length=8, max_length=50)
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    birthday: Optional[date] = None
    is_admin: Optional[bool] = None
    force_password_change: Optional[bool] = None

class AdminUserResponse(BaseModel):
    success: bool
    message: str
    user: Optional[FamilyMember] = None

# --- Household Management ---
class HouseholdCreate(HouseholdBase):
    pass

class HouseholdUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None

class HouseholdRequest(BaseModel):
    household_id: int
    user_id: int

class HouseholdResponse(BaseModel):
    success: bool
    message: str
    household: Optional[Household] = None

# --- User Household Management ---
class UserHouseholdJoinRequest(BaseModel):
    pass  # No additional data needed, user_id comes from auth header

class UserHouseholdResponse(BaseModel):
    success: bool
    message: str
    household: Optional[Household] = None

class UserHouseholdsResponse(BaseModel):
    success: bool
    message: str
    households: List[Household] = []

# --- Email Management ---
class EmailSettingsCreate(EmailSettingsBase):
    pass

class EmailTemplateCreate(EmailTemplateBase):
    pass

class EmailResponse(BaseModel):
    success: bool
    message: str
    email_log: Optional[EmailLog] = None

# --- Family Member ---
class FamilyMemberCreate(FamilyMemberBase):
    password: Optional[str] = None

class FamilyMemberPreferencesUpdate(BaseModel):
    preferences: Dict[str, Any]

# Family member update schema
class FamilyMemberUpdate(BaseModel):
    name: Optional[str] = None
    birthday: Optional[str] = None
    is_admin: Optional[bool] = None
    
    class Config:
        orm_mode = True

# --- User Profile Management ---
class UserProfileUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=20)
    email: EmailStr
    current_password: Optional[str] = None
    new_password: Optional[str] = Field(None, min_length=8, max_length=50)
    confirm_password: Optional[str] = None

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and values['new_password'] and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v

class UserProfileResponse(BaseModel):
    success: bool
    message: str
    user: Optional[FamilyMember] = None

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
    price_in_cents: Optional[int] = Field(
        None,
        ge=0,
        le=100000000,
        description="Price of the item in cents (bypasses dollar-to-cents conversion)"
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
    def validate_price(cls, v, values):
        if v is not None:
            if 'price_in_cents' in values and values['price_in_cents'] is not None:
                raise ValueError('Cannot specify both price and price_in_cents')
            if v < 0:
                raise ValueError('Price cannot be negative')
            # Convert dollars to cents and ensure it's an integer
            return int(round(v * 100))
        return None

    @validator('price_in_cents')
    def validate_price_in_cents(cls, v, values):
        if v is not None:
            if 'price' in values and values['price'] is not None:
                raise ValueError('Cannot specify both price and price_in_cents')
            if v < 0:
                raise ValueError('Price cannot be negative')
            return v
        return None

    @model_validator(mode='after')
    def set_final_price(cls, values):
        # Use price_in_cents if provided, otherwise use the converted price
        if values.price_in_cents is not None:
            values.price = values.price_in_cents
        # Remove price_in_cents as it's not needed in the final model
        values.price_in_cents = None
        return values

    def model_dump(self, *args, **kwargs):
        # Exclude price_in_cents from the output
        kwargs.setdefault("exclude", set()).add("price_in_cents")
        return super().model_dump(*args, **kwargs)

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

class WishlistExportItem(BaseModel):
    """Schema for items in the export format"""
    title: str
    description: Optional[str] = None
    link: Optional[HttpUrl] = None
    image_url: Optional[HttpUrl] = None
    priority: int = 0
    price: Optional[int] = None

class WishlistExport(BaseModel):
    """Schema for the complete wishlist export format"""
    items: List[WishlistExportItem]
    export_date: str
    version: str

class WishlistImportResponse(BaseModel):
    """Schema for the wishlist import response"""
    imported_items: List[WishlistItem]
    skipped_items: List[str]

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

# Add these new schemas after the existing schemas

class EmergencyAccessRequest(BaseModel):
    emergency_token: str

class EmergencyAccessResponse(BaseModel):
    success: bool
    message: str
    admin_user: FamilyMember

class UpdateEmergencyTokenRequest(BaseModel):
    new_token: str

class UpdateEmergencyTokenResponse(BaseModel):
    success: bool
    message: str

class EmergencyTokenInfoResponse(BaseModel):
    exists: bool
    created_at: Optional[str]
    updated_at: Optional[str]
    has_token: bool

class SystemConfig(BaseModel):
    key: str
    value: str
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class FirstTimeSetupRequest(BaseModel):
    admin_username: str = Field(..., min_length=3, max_length=20)
    admin_password: str = Field(..., min_length=8, max_length=72)
    admin_email: EmailStr
    admin_name: str = Field(default="Admin", min_length=1, max_length=100)

class FirstTimeSetupResponse(BaseModel):
    success: bool
    message: str
    emergency_access_key: str
    admin_user: FamilyMember

class MaintenanceBroadcastRequest(BaseModel):
    maintenance_time: Optional[str] = None
    expected_downtime: Optional[str] = None