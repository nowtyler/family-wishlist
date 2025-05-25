# backend/app/models.py
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from .database import Base
from pydantic import BaseModel, HttpUrl

class FamilyMember(Base):
    __tablename__ = "family_members"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    birthday = Column(Date, nullable=True) # YYYY-MM-DD
    is_admin = Column(Boolean, default=False)  # Add this line

    wishlist_items = relationship("WishlistItem", back_populates="owner")

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

    owner = relationship("FamilyMember", back_populates="wishlist_items")
    # Who is thinking about it (list of family member names or IDs, simple for now)
    thinking_about_by = Column(String, nullable=True)
    comments = relationship("Comment", back_populates="item")
    purchased_by = Column(String, nullable=True)  # New column for who purchased the item

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("family_members.id")) # Who wrote the comment
    item_id = Column(Integer, ForeignKey("wishlist_items.id"))

    item = relationship("WishlistItem", back_populates="comments")
    author = relationship("FamilyMember") # To show who wrote the comment

class WishlistItemCreate(BaseModel):
    title: str
    description: str | None = None
    link: HttpUrl | None = None
    image_url: HttpUrl | None = None
    priority: int = 1

    def to_db_dict(self) -> dict:
        """Convert model to a database-friendly dictionary"""
        data = self.model_dump()
        # Convert URLs to strings for database storage
        if data.get('link'):
            data['link'] = str(data['link'])
        if data.get('image_url'):
            data['image_url'] = str(data['image_url'])
        return data