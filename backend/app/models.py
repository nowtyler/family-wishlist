# backend/app/models.py
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, Date, DateTime, Table, Float
from sqlalchemy.orm import relationship
from datetime import date, datetime
from .database import Base
from pydantic import BaseModel, HttpUrl
import json
import logging

logger = logging.getLogger(__name__)

# Association table for many-to-many relationship between users and households
user_household_association = Table(
    'user_household_association',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('family_members.id'), primary_key=True),
    Column('household_id', Integer, ForeignKey('households.id'), primary_key=True),
    Column('status', String, default='active'),  # 'active', 'pending', 'declined'
    Column('joined_at', DateTime, default=datetime.utcnow),
    Column('requested_at', DateTime, default=datetime.utcnow)
)

class FamilyMember(Base):
    __tablename__ = "family_members"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    birthday = Column(String, nullable=True) # Format: YYYY-MM-DD
    is_admin = Column(Boolean, default=False)
    _preferences = Column("preferences", Text, nullable=True)
    
    # Authentication fields
    username = Column(String, index=True, unique=True, nullable=True)
    password_hash = Column(String, nullable=True)
    email = Column(String, index=True, nullable=True)
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    first_login = Column(Boolean, default=True)
    
    # New fields for password management
    password_expires_at = Column(DateTime, nullable=True)
    temp_password_hash = Column(String, nullable=True)
    force_password_change = Column(Boolean, default=False)
    
    # Add JSON serialization/deserialization for preferences
    @property
    def preferences(self):
        if self._preferences is None:
            return None
        if not isinstance(self._preferences, str):
            logger.warning(f"Preferences field is not a string: {type(self._preferences)}")
            return None
        try:
            return json.loads(self._preferences)
        except Exception as e:
            logger.error(f"Error deserializing preferences: {e}")
            return None
            
    @preferences.setter
    def preferences(self, value):
        if value is None:
            self._preferences = None
        else:
            self._preferences = json.dumps(value)
    
    # Add relationship if they don't exist
    wishlist_items = relationship("WishlistItem", back_populates="owner", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    external_wishlists = relationship("ExternalWishlist", back_populates="owner", cascade="all, delete-orphan")
    
    # New relationships for households
    households = relationship("Household", secondary=user_household_association, back_populates="members")

    def __repr__(self):
        return f"<FamilyMember(id={self.id}, name='{self.name}', is_admin={self.is_admin})>"

class Household(Base):
    __tablename__ = "households"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("family_members.id"))
    
    # Relationships
    members = relationship("FamilyMember", secondary=user_household_association, back_populates="households")
    creator = relationship("FamilyMember")

    def __repr__(self):
        return f"<Household(id={self.id}, name='{self.name}')>"

class EmailSettings(Base):
    __tablename__ = "email_settings"
    
    id = Column(Integer, primary_key=True)
    smtp_server = Column(String, nullable=False)
    smtp_port = Column(Integer, nullable=False)
    smtp_username = Column(String, nullable=False)
    smtp_password = Column(String, nullable=False)
    from_email = Column(String, nullable=False)
    from_name = Column(String, nullable=False)
    use_tls = Column(Boolean, default=True)
    use_ssl = Column(Boolean, default=False)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<EmailSettings(id={self.id}, smtp_server='{self.smtp_server}')>"

class EmailTemplate(Base):
    __tablename__ = "email_templates"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<EmailTemplate(id={self.id}, name='{self.name}')>"

class EmailLog(Base):
    __tablename__ = "email_logs"
    
    id = Column(Integer, primary_key=True)
    recipient_email = Column(String, nullable=False)
    recipient_name = Column(String, nullable=True)
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    template_name = Column(String, nullable=True)
    status = Column(String, nullable=False)  # 'sent', 'failed', 'pending'
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<EmailLog(id={self.id}, recipient='{self.recipient_email}', status='{self.status}')>"

class WishlistItem(Base):
    __tablename__ = "wishlist_items"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    link = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    priority = Column(Integer, default=0) # e.g., 0=low, 1=medium, 2=high
    is_purchased = Column(Boolean, default=False)
    owner_id = Column(Integer, ForeignKey("family_members.id"))
    thinking_about_by = Column(String, nullable=True)
    purchased_by = Column(String, nullable=True)  # New column for who purchased the item
    price = Column(Integer, nullable=True)  # Store price in cents
    owner = relationship("FamilyMember", back_populates="wishlist_items")
    # Who is thinking about it (list of family member names or IDs, simple for now)
    comments = relationship("Comment", back_populates="item")

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("family_members.id")) # Who wrote the comment
    item_id = Column(Integer, ForeignKey("wishlist_items.id"))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)  # Add this line

    item = relationship("WishlistItem", back_populates="comments")
    author = relationship("FamilyMember") # To show who wrote the comment

class WishlistItemCreate(BaseModel):
    title: str
    description: str | None = None
    link: HttpUrl | None = None
    image_url: HttpUrl | None = None
    priority: int = 1
    price: int | None = None  # Add price field

    def to_db_dict(self) -> dict:
        """Convert model to a database-friendly dictionary"""
        data = self.model_dump()
        # Convert URLs to strings for database storage
        if data.get('link'):
            data['link'] = str(data['link'])
        if data.get('image_url'):
            data['image_url'] = str(data['image_url'])
        return data

class SystemSettings(Base):
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True)
    version = Column(String)
    schema_hash = Column(String)  # Add this line
    last_updated = Column(Date, default=date.today)
    is_foundation = Column(Boolean, default=False)  # New column
    created_at = Column(DateTime, default=datetime.utcnow)  # New column

class ExternalWishlist(Base):
    __tablename__ = "external_wishlists"
    
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("family_members.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g., "Amazon", "Etsy", etc.
    url = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to owner - use back_populates instead of backref
    owner = relationship("FamilyMember", back_populates="external_wishlists")
    
    def __repr__(self):
        return f"<ExternalWishlist(id={self.id}, name='{self.name}', owner_id={self.owner_id})>"

class ShoppingCartItem(Base):
    __tablename__ = "shopping_cart_items"

    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("family_members.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("family_members.id"), nullable=False)
    wishlist_item_id = Column(Integer, ForeignKey("wishlist_items.id"), nullable=True)
    title = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    link = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    price = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="pending")
    purchased_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    buyer = relationship("FamilyMember", foreign_keys=[buyer_id])
    recipient = relationship("FamilyMember", foreign_keys=[recipient_id])
    wishlist_item = relationship("WishlistItem")

class SystemConfig(Base):
    __tablename__ = "system_config"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("family_members.id"))
    session_id = Column(String, unique=True, index=True)
    data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    
    # Relationships
    user = relationship("FamilyMember")

    def __repr__(self):
        return f"<Session(id={self.id}, user_id={self.user_id})>"
