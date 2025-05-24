# backend/app/models.py
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from .database import Base

class FamilyMember(Base):
    __tablename__ = "family_members"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    birthday = Column(Date, nullable=True) # YYYY-MM-DD

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
    thinking_about_by = Column(String, nullable=True) # e.g., "Emily,Tyler" - simpler than a many-to-many for now
    comments = relationship("Comment", back_populates="item")

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("family_members.id")) # Who wrote the comment
    item_id = Column(Integer, ForeignKey("wishlist_items.id"))

    item = relationship("WishlistItem", back_populates="comments")
    author = relationship("FamilyMember") # To show who wrote the comment