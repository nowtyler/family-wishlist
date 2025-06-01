# backend/app/models.py
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, Date, DateTime
from sqlalchemy.orm import relationship
from datetime import date, datetime
from .database import Base
from pydantic import BaseModel, HttpUrl
import json

class FamilyMember(Base):
    __tablename__ = "family_members"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    birthday = Column(String, nullable=True) # Format: YYYY-MM-DD
    is_admin = Column(Boolean, default=False)
    _preferences = Column("preferences", Text, nullable=True)
    
    # Add JSON serialization/deserialization for preferences
    @property
    def preferences(self):
        if self._preferences is None:
            return None
        try:
            return json.loads(self._preferences)
        except:
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

    def __repr__(self):
        return f"<FamilyMember(id={self.id}, name='{self.name}', is_admin={self.is_admin})>"

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
    owner_id = Column(Integer, ForeignKey("family_members.id"))
    name = Column(String, nullable=False)  # e.g., "Amazon", "Etsy", etc.
    url = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to owner
    owner = relationship("FamilyMember", backref="external_wishlists")
    
    def __repr__(self):
        return f"<ExternalWishlist(id={self.id}, name='{self.name}', owner_id={self.owner_id})>"