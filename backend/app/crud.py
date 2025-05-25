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

    # First, check if we have any members at all
    existing_count = db.query(models.FamilyMember).count()
    if existing_count > 0:
        print(f"Found {existing_count} existing family members, skipping initialization")
        return

    # Only proceed with initialization if no members exist
    member_configs = env_config.split(',')
    for config_str in member_configs:
        parts = config_str.strip().split(':')
        name = parts[0]
        birthday_str = parts[1] if len(parts) > 1 else None

        existing_member = get_family_member_by_name(db, name)
        if not existing_member:
            birthday = None
            is_admin = False

            if birthday_str == "admin":
                is_admin = True
            elif birthday_str:
                try:
                    birthday = datetime.strptime(birthday_str, "%Y-%m-%d").date()
                except ValueError:
                    print(f"Warning: Could not parse birthday for {name}: {birthday_str}")
            
            create_family_member(db, schemas.FamilyMemberCreate(
                name=name,
                birthday=birthday,
                is_admin=is_admin
            ))
            print(f"Created {'admin' if is_admin else 'family'} member: {name}")


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

def get_wishlist_item(db: Session, item_id: int) -> Optional[models.WishlistItem]:
    return db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()

def update_wishlist_item(db: Session, item_id: int, item_update: schemas.WishlistItemUpdate, requesting_user_id: int) -> Optional[models.WishlistItem]:
    db_item = get_wishlist_item(db, item_id)
    if not db_item:
        return None

    requesting_user = get_family_member(db, requesting_user_id)
    if not requesting_user:
        return None
        
    is_admin = requesting_user.name.lower() == 'admin'
    if not (is_admin or db_item.owner_id == requesting_user_id):
        return None

    update_data = item_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        if hasattr(db_item, key):
            if key in ['link', 'image_url'] and value is not None:
                setattr(db_item, key, str(value))
            else:
                setattr(db_item, key, value)
    
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


def toggle_item_purchased(db: Session, item_id: int, user_id: int) -> Optional[models.WishlistItem]:
    db_item = db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()
    user = get_family_member(db, user_id)
    if not db_item or not user or db_item.owner_id == user_id: # Owner cannot mark their own items
        return None

    # If item is already purchased by this user, unpurchase it
    # If item is purchased by someone else, do nothing (return None)
    # If item is not purchased, mark it as purchased by this user
    if db_item.is_purchased:
        if db_item.purchased_by == user.name:
            db_item.is_purchased = False
            db_item.purchased_by = None
        else:
            return None  # Can't toggle if someone else purchased
    else:
        db_item.is_purchased = True
        db_item.purchased_by = user.name
    
    db.commit()
    db.refresh(db_item)
    return db_item


def delete_wishlist_item(db: Session, item_id: int, requesting_user_id: int) -> bool:
    db_item = db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()
    if not db_item:
        return False
        
    requesting_user = get_family_member(db, requesting_user_id)
    is_admin = requesting_user and requesting_user.name.lower() == 'admin'
    
    if is_admin or db_item.owner_id == requesting_user_id:
        db.query(models.Comment).filter(models.Comment.item_id == item_id).delete()
        db.delete(db_item)
        db.commit()
        return True
    return False

# --- Comment CRUD ---
def create_comment(db: Session, item_id: int, comment: schemas.CommentCreate, author_id: int) -> models.Comment:
    db_item = db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()
    if not db_item or db_item.owner_id == author_id:  # Cannot comment on your own item
        raise ValueError("Cannot comment on own item or item does not exist")

    db_comment = models.Comment(**comment.model_dump(), item_id=item_id, author_id=author_id)
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment

def delete_comment(db: Session, comment_id: int, author_id: int) -> bool:
    db_comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if db_comment and db_comment.author_id == author_id:
        db.delete(db_comment)
        db.commit()
        return True
    return False

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
        if birthday_str and birthday_str != "admin":
            try:
                birth_month, birth_day = map(int, birthday_str.split('-')[1:])
                birthday_this_year = date(current_year, birth_month, birth_day)
                if birthday_this_year >= today:
                    events.append({"name": f"{name}'s Birthday", "date": birthday_this_year})
                else:  # Birthday next year
                    events.append({"name": f"{name}'s Birthday", "date": date(current_year + 1, birth_month, birth_day)})
            except ValueError:
                print(f"Could not parse birthday for reminder: {name} - {birthday_str}")
                continue

    # Find the soonest event
    if not events:
        return None
    
    events.sort(key=lambda x: x["date"])
    next_event_date = events[0]["date"]
    next_event_name = events[0]["name"]
    
    days_until = (next_event_date - today).days

    return schemas.GiftEvent(name=next_event_name, date=next_event_date, days_until=days_until)