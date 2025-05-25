# backend/app/crud.py
from sqlalchemy.orm import Session, joinedload
from . import models, schemas
from typing import List, Optional, Tuple
from datetime import date, datetime, timedelta
import os

# --- Family Member CRUD ---
def get_family_member(db: Session, member_id: int) -> Optional[models.FamilyMember]:
    return db.query(models.FamilyMember).filter(models.FamilyMember.id == member_id).first()

def get_family_member_by_name(db: Session, name: str) -> Optional[models.FamilyMember]:
    return db.query(models.FamilyMember).filter(models.FamilyMember.name == name).first()

def get_family_members(db: Session, skip: int = 0, limit: int = 100) -> List[models.FamilyMember]:
    return db.query(models.FamilyMember).offset(skip).limit(limit).all()

def create_family_member(db: Session, member: schemas.FamilyMemberCreate) -> models.FamilyMember:
    db_member = models.FamilyMember(name=member.name, birthday=member.birthday)
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

def initialize_family_members(db: Session):
    """Initializes family members from .env if they don't exist."""
    env_config = os.getenv("FAMILY_MEMBERS_CONFIG")
    if not env_config:
        print("FAMILY_MEMBERS_CONFIG not set. Skipping auto-initialization.")
        return

    member_configs = env_config.split(',')
    for config_str in member_configs:
        parts = config_str.strip().split(':')
        name = parts[0]
        birthday_str = parts[1] if len(parts) > 1 else None

        existing_member = get_family_member_by_name(db, name)
        if not existing_member:
            birthday = None
            if birthday_str:
                try:
                    birthday = datetime.strptime(birthday_str, "%Y-%m-%d").date()
                except ValueError:
                    print(f"Warning: Could not parse birthday for {name}: {birthday_str}")
            
            create_family_member(db, schemas.FamilyMemberCreate(name=name, birthday=birthday))
            print(f"Created family member: {name}")


# --- Wishlist Item CRUD ---
def get_wishlist_items_by_owner(db: Session, owner_id: int, current_user_id: int) -> List[schemas.WishlistItem]:
    items_query = db.query(models.WishlistItem).options(
        joinedload(models.WishlistItem.comments).joinedload(models.Comment.author)
    ).filter(models.WishlistItem.owner_id == owner_id)

    # Sort by priority (desc) then by id (desc, for most recent)
    items_query = items_query.order_by(models.WishlistItem.priority.desc(), models.WishlistItem.id.desc())
    db_items = items_query.all()

    result_items = []
    for item in db_items:
        # If the current user is the owner, they see everything normally
        # If the current user is NOT the owner AND the item is purchased, they don't see it as purchased (it's hidden for owner)
        # Actually, the prompt says: "mark that they purchased something, which will hide it from the wishlist owner but remain visible to others."
        
        is_item_visible_to_current_user = True
        effective_is_purchased = item.is_purchased
        effective_purchased_by = item.purchased_by

        if owner_id == current_user_id:  # Current user IS the owner
            # Owner can still see the item but not who purchased it
            effective_purchased_by = None
            effective_is_purchased = False  # Don't show as purchased to owner
        
        thinking_by_list = item.thinking_about_by.split(',') if item.thinking_about_by else []
        
        visible_comments = []
        if owner_id != current_user_id: # Only show comments to others
            for comment in item.comments:
                visible_comments.append(schemas.Comment(
                    id=comment.id,
                    text=comment.text,
                    author_id=comment.author_id,
                    author_name=comment.author.name, # Assuming author relationship is loaded
                    item_id=comment.item_id,
                    created_at=comment.created_at if hasattr(comment, 'created_at') else datetime.now() # Handle if no timestamp
                ))

        result_items.append(schemas.WishlistItem(
            id=item.id,
            title=item.title,
            description=item.description,
            link=str(item.link) if item.link else None,
            image_url=str(item.image_url) if item.image_url else None,
            priority=item.priority,
            owner_id=item.owner_id,
            is_purchased=effective_is_purchased,
            purchased_by=effective_purchased_by,
            thinking_about_by_list=thinking_by_list,
            comments=visible_comments
        ))

    return result_items


def create_wishlist_item(db: Session, item: schemas.WishlistItemCreate, owner_id: int) -> models.WishlistItem:
    db_item = models.WishlistItem(**item.model_dump(), owner_id=owner_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def update_wishlist_item(db: Session, item_id: int, item_update: schemas.WishlistItemUpdate, requesting_user_id: int) -> Optional[models.WishlistItem]:
    db_item = db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()
    if not db_item:
        return None

    update_data = item_update.model_dump(exclude_unset=True)

    # Handle 'thinking_about_by' list - this is tricky if we are just passing strings.
    # Let's assume the frontend sends the full new string or an action.
    # For simplicity, if 'thinking_about_by' is in update_data, we replace it.
    # A more robust way would be to add/remove individual names.
    # User can only modify their own items, or mark purchased/thinking_about on others
    
    # If the requester is the owner, they can update most fields
    if db_item.owner_id == requesting_user_id:
        if "title" in update_data: db_item.title = update_data["title"]
        if "description" in update_data: db_item.description = update_data["description"]
        if "link" in update_data: db_item.link = str(update_data["link"]) if update_data["link"] else None
        if "image_url" in update_data: db_item.image_url = str(update_data["image_url"]) if update_data["image_url"] else None
        if "priority" in update_data: db_item.priority = update_data["priority"]
        # Owner cannot directly set is_purchased or thinking_about_by via this route
        # (or rather, it has special meaning if they could)
    
    # Anyone (not the owner) can mark as purchased or add themselves to 'thinking_about_by'
    # Owner does NOT interact with these fields for their own items.
    if db_item.owner_id != requesting_user_id:
        if "is_purchased" in update_data:
            db_item.is_purchased = update_data["is_purchased"]
        
        if "thinking_about_by" in update_data: # Expects a name to add/remove
            # This needs more complex logic: add/remove name from CSV string
            # For now, let's simplify: a special endpoint for thinking_about
            pass # We will handle this in a dedicated route for clarity

    db.commit()
    db.refresh(db_item)
    return db_item

def toggle_thinking_about(db: Session, item_id: int, user_id: int) -> Optional[models.WishlistItem]:
    db_item = db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()
    user = get_family_member(db, user_id)
    if not db_item or not user or db_item.owner_id == user_id: # Owner cannot mark 'thinking about' on their own items
        return None

    thinking_list = db_item.thinking_about_by.split(',') if db_item.thinking_about_by else []
    thinking_list = [name.strip() for name in thinking_list if name.strip()] # Clean list

    if user.name in thinking_list:
        thinking_list.remove(user.name)
    else:
        thinking_list.append(user.name)
    
    db_item.thinking_about_by = ",".join(thinking_list)
    db.commit()
    db.refresh(db_item)
    return db_item


def mark_item_purchased(db: Session, item_id: int, purchased: bool, user_id: int) -> Optional[models.WishlistItem]:
    db_item = db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()
    user = get_family_member(db, user_id)
    if not db_item or db_item.owner_id == user_id: # Owner cannot mark their own items as purchased
        return None
    
    db_item.is_purchased = purchased
    if purchased:
        db_item.purchased_by = user.name
    else:
        db_item.purchased_by = None
        
    db.commit()
    db.refresh(db_item)
    return db_item


def delete_wishlist_item(db: Session, item_id: int, requesting_user_id: int) -> bool:
    db_item = db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()
    if db_item and db_item.owner_id == requesting_user_id: # Only owner can delete
        # Also delete associated comments
        db.query(models.Comment).filter(models.Comment.item_id == item_id).delete()
        db.delete(db_item)
        db.commit()
        return True
    return False

# --- Comment CRUD ---
def create_comment(db: Session, item_id: int, comment: schemas.CommentCreate, author_id: int) -> models.Comment:
    db_item = db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()
    if not db_item or db_item.owner_id == author_id: # Cannot comment on your own item
        raise ValueError("Cannot comment on own item or item does not exist")

    db_comment = models.Comment(**comment.model_dump(), item_id=item_id, author_id=author_id)
    # We need to add created_at if it's part of the model
    # if hasattr(db_comment, 'created_at'): db_comment.created_at = datetime.utcnow()
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment

# --- Gift Reminder Logic ---
def get_next_gift_event() -> Optional[schemas.GiftEvent]:
    family_members_str = os.getenv("FAMILY_MEMBERS_CONFIG")
    christmas_month = int(os.getenv("CHRISTMAS_MONTH", "12"))
    christmas_day = int(os.getenv("CHRISTMAS_DAY", "25"))
    
    if not family_members_str:
        return None

    today = date.today()
    current_year = today.year
    events = []

    # Add Christmas
    christmas_this_year = date(current_year, christmas_month, christmas_day)
    if christmas_this_year >= today:
        events.append({"name": "Christmas", "date": christmas_this_year})
    else: # Christmas next year
        events.append({"name": "Christmas", "date": date(current_year + 1, christmas_month, christmas_day)})
    
    # Add Birthdays
    member_configs = family_members_str.split(',')
    for config_str in member_configs:
        parts = config_str.strip().split(':')
        name = parts[0]
        birthday_str = parts[1] if len(parts) > 1 else None
        if birthday_str:
            try:
                birth_month, birth_day = map(int, birthday_str.split('-')[1:]) # Assuming YYYY-MM-DD format, take MM-DD
                birthday_this_year = date(current_year, birth_month, birth_day)
                if birthday_this_year >= today:
                    events.append({"name": f"{name}'s Birthday", "date": birthday_this_year})
                else: # Birthday next year
                    events.append({"name": f"{name}'s Birthday", "date": date(current_year + 1, birth_month, birth_day)})
            except ValueError:
                print(f"Could not parse birthday for reminder: {name} - {birthday_str}")
                continue # Skip malformed entries

    if not events:
        return None

    # Find the soonest event
    events.sort(key=lambda x: x["date"])
    next_event_date = events[0]["date"]
    next_event_name = events[0]["name"]
    
    days_until = (next_event_date - today).days

    return schemas.GiftEvent(name=next_event_name, date=next_event_date, days_until=days_until)