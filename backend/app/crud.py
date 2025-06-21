# backend/app/crud.py
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, exists
from . import models, schemas
from typing import List, Optional, Tuple, Set
from datetime import date, datetime, timedelta
import os
import logging

logger = logging.getLogger(__name__)

# --- Family Member CRUD ---
def get_family_member(db: Session, member_id: int) -> Optional[models.FamilyMember]:
    """Get a family member by ID with better error handling"""
    try:
        return db.query(models.FamilyMember).filter(models.FamilyMember.id == member_id).first()
    except Exception as e:
        logger.error(f"Database error in get_family_member: {e}")
        return None

def get_family_member_by_name(db: Session, name: str) -> Optional[models.FamilyMember]:
    return db.query(models.FamilyMember).filter(models.FamilyMember.name == name).first()

def get_family_members(db: Session, skip: int = 0, limit: int = 100) -> List[models.FamilyMember]:
    return db.query(models.FamilyMember).offset(skip).limit(limit).all()

def create_family_member(db: Session, member: schemas.FamilyMemberCreate) -> models.FamilyMember:
    db_member = models.FamilyMember(
        name=member.name,
        birthday=member.birthday,
        is_admin=member.is_admin
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

def create_family_member_with_auth(db: Session, member: schemas.AdminUserCreateRequest) -> models.FamilyMember:
    """Create a family member with authentication details (admin only)"""
    from .services.user_auth_service import UserAuthService
    
    # Check if username already exists
    existing_user = db.query(models.FamilyMember).filter(models.FamilyMember.username == member.username).first()
    if existing_user:
        raise ValueError("Username already exists")
    
    # Check if email already exists (if provided)
    if member.email:
        existing_email = db.query(models.FamilyMember).filter(models.FamilyMember.email == member.email).first()
        if existing_email:
            raise ValueError("Email already in use")
    
    # Create new user with authentication details
    db_member = models.FamilyMember(
        name=member.name,
        username=member.username,
        password_hash=UserAuthService.get_password_hash(member.password),
        email=member.email,
        birthday=member.birthday.isoformat() if member.birthday else None,
        is_admin=member.is_admin
    )
    
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

def update_family_member_with_auth(db: Session, member_id: int, member_update: schemas.AdminUserUpdateRequest) -> Optional[models.FamilyMember]:
    """Update a family member with authentication details (admin only)"""
    from .services.user_auth_service import UserAuthService
    
    db_member = get_family_member(db, member_id)
    if not db_member:
        return None
    
    # Check if username already exists (if being updated)
    if member_update.username and member_update.username != db_member.username:
        existing_user = db.query(models.FamilyMember).filter(models.FamilyMember.username == member_update.username).first()
        if existing_user:
            raise ValueError("Username already exists")
    
    # Check if email already exists (if being updated)
    if member_update.email and member_update.email != db_member.email:
        existing_email = db.query(models.FamilyMember).filter(models.FamilyMember.email == member_update.email).first()
        if existing_email:
            raise ValueError("Email already in use")
    
    # Update fields
    update_data = member_update.dict(exclude_unset=True)
    
    # Handle password update
    if 'password' in update_data and update_data['password']:
        update_data['password_hash'] = UserAuthService.get_password_hash(update_data['password'])
        del update_data['password']
    
    # Handle birthday conversion
    if 'birthday' in update_data and update_data['birthday']:
        update_data['birthday'] = update_data['birthday'].isoformat()
    
    for key, value in update_data.items():
        setattr(db_member, key, value)
    
    db.commit()
    db.refresh(db_member)
    return db_member

def initialize_family_members(db: Session):
    """Initializes family members from .env if they don't exist."""
    env_config = os.getenv("FAMILY_MEMBERS_CONFIG")
    if not env_config:
        logger.info("FAMILY_MEMBERS_CONFIG not set. Skipping auto-initialization.")
        return

    # First, check if we have any members at all
    existing_count = db.query(models.FamilyMember).count()
    if existing_count > 0:
        logger.info(f"Found {existing_count} existing family members, skipping initialization")
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
                logger.info(f"Creating admin user: {name}")
            elif birthday_str:
                try:
                    birthday = datetime.strptime(birthday_str, "%Y-%m-%d").date()
                except ValueError:
                    logger.warning(f"Warning: Could not parse birthday for {name}: {birthday_str}")
            
            create_family_member(db, schemas.FamilyMemberCreate(
                name=name,
                birthday=birthday,
                is_admin=is_admin
            ))
            logger.info(f"Created {'admin' if is_admin else 'family'} member: {name}")


# --- Wishlist Item CRUD ---
def get_wishlist_items_by_owner(db: Session, owner_id: int, current_user_id: int) -> List[schemas.WishlistItem]:
    # First check if the current user and owner share any households (household-based access control)
    requesting_user = get_family_member(db, current_user_id)
    is_admin = requesting_user and requesting_user.name.lower() == 'admin'
    
    # Skip household check for admin users
    if not is_admin:
        # Check if users share any households
        try:
            # Get current user's household IDs
            current_user_households_query = db.query(models.user_household_association.c.household_id).filter(
                models.user_household_association.c.user_id == current_user_id,
                models.user_household_association.c.status == 'active'
            )
            current_user_households = {row[0] for row in current_user_households_query.all()}
            
            # Get owner's household IDs  
            owner_households_query = db.query(models.user_household_association.c.household_id).filter(
                models.user_household_association.c.user_id == owner_id,
                models.user_household_association.c.status == 'active'
            )
            owner_households = {row[0] for row in owner_households_query.all()}
            
            # Check if they share any households
            shared_households = current_user_households.intersection(owner_households)
            
            # If no shared households and not the same user, return empty list
            if not shared_households and current_user_id != owner_id:
                logger.info(f"User {current_user_id} denied access to user {owner_id}'s wishlist (no shared households)")
                return []
                
        except Exception as e:
            logger.error(f"Error checking household access for user {current_user_id} viewing user {owner_id}: {e}")
            # If household check fails, only allow viewing own items (fallback security)
            if current_user_id != owner_id:
                return []
    
    items_query = db.query(models.WishlistItem).options(
        joinedload(models.WishlistItem.comments).joinedload(models.Comment.author)
    ).filter(models.WishlistItem.owner_id == owner_id)

    # Sort by priority (desc) then by id (desc, for most recent)
    items_query = items_query.order_by(models.WishlistItem.priority.desc(), models.WishlistItem.id.desc())
    db_items = items_query.all()

    result_items = []
    for item in db_items:
        is_item_visible_to_current_user = True
        effective_is_purchased = item.is_purchased
        effective_purchased_by = item.purchased_by

        if owner_id == current_user_id and not is_admin:  # Current user IS the owner (but not admin)
            # Owner can still see the item but not who purchased it
            effective_purchased_by = None
            effective_is_purchased = False  # Don't show as purchased to owner
        
        thinking_by_list = item.thinking_about_by.split(',') if item.thinking_about_by else []
        
        visible_comments = []

        # Fix for admin comment visibility:
        # Always show comments for:
        # 1. Admin users (regardless of viewing their own list or others)
        # 2. Regular users viewing someone else's wishlist
        if is_admin or owner_id != current_user_id:
            visible_comments = [schemas.Comment(
                id=comment.id,
                text=comment.text,
                author_id=comment.author_id,
                author_name=comment.author.name,
                item_id=comment.item_id,
                created_at=comment.created_at
            ) for comment in item.comments]
        
        result_items.append(schemas.WishlistItem(
            id=item.id,
            title=item.title,
            description=item.description,
            link=str(item.link) if item.link else None,
            image_url=str(item.image_url) if item.image_url else None,
            priority=item.priority,
            price=item.price,
            owner_id=item.owner_id,
            is_purchased=effective_is_purchased,
            purchased_by=effective_purchased_by,
            thinking_about_by_list=thinking_by_list,
            comments=visible_comments
        ))

    return result_items


def create_wishlist_item(db: Session, item: schemas.WishlistItemCreate, owner_id: int) -> models.WishlistItem:
    item_data = item.model_dump()
    # Convert URLs to strings if they exist
    if item_data.get('link'):
        item_data['link'] = str(item_data['link'])
    if item_data.get('image_url'):
        item_data['image_url'] = str(item_data['image_url'])
    
    # Make sure price is integer cents
    if 'price' in item_data and item_data['price'] is not None:
        item_data['price'] = int(item_data['price'])
    
    db_item = models.WishlistItem(**item_data, owner_id=owner_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def get_wishlist_item(db: Session, item_id: int) -> Optional[models.WishlistItem]:
    return db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()

def update_wishlist_item(db: Session, item_id: int, item_update: schemas.WishlistItemUpdate, current_user_id: int):
    """Update a wishlist item with proper authorization checks"""
    db_item = db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()
    if not db_item:
        return None
    
    # Check if user is authorized to update (owner or admin)
    user = get_family_member(db, current_user_id)
    if not user or (user.name.lower() != 'admin' and db_item.owner_id != current_user_id):
        return None
    
    # Update fields that were provided
    update_data = item_update.model_dump(exclude_unset=True)
    
    # Make sure price is already converted to cents and is an integer
    if 'price' in update_data and update_data['price'] is not None:
        # If somehow the price is still a float here, convert it
        if isinstance(update_data['price'], float):
            update_data['price'] = int(update_data['price'] * 100)
    
    for key, value in update_data.items():
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

def delete_all_wishlist_items(db: Session, owner_id: int, requesting_user_id: int) -> bool:
    requesting_user = get_family_member(db, requesting_user_id)
    is_admin = requesting_user and requesting_user.name.lower() == 'admin'
    
    if is_admin or owner_id == requesting_user_id:
        # First delete all comments for the items
        items = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == owner_id).all()
        for item in items:
            db.query(models.Comment).filter(models.Comment.item_id == item.id).delete()
        
        # Then delete all items
        db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == owner_id).delete()
        db.commit()
        return True
    return False

def delete_all_wishlists(db: Session, requesting_user_id: int) -> bool:
    requesting_user = get_family_member(db, requesting_user_id)
    if not requesting_user or requesting_user.name.lower() != 'admin':
        return False

    try:
        # First delete all comments
        db.query(models.Comment).delete()
        
        # Then delete all wishlist items
        db.query(models.WishlistItem).delete()
        
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting all wishlists: {e}")
        return False

# --- Comment CRUD ---
def create_comment(db: Session, item_id: int, text: str, author_id: int) -> models.Comment:
    now = datetime.utcnow()
    db_comment = models.Comment(
        text=text,
        author_id=author_id,
        item_id=item_id,
        created_at=now
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment

def delete_comment(db: Session, comment_id: int, author_id: int) -> bool:
    """Delete a comment with proper authorization check"""
    db_comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not db_comment:
        return False
        
    # Get the requesting user to check if they're an admin
    requesting_user = get_family_member(db, author_id)
    is_admin = requesting_user and requesting_user.name.lower() == 'admin'
    
    # Allow deletion if admin or comment author
    if is_admin or db_comment.author_id == author_id:
        db.delete(db_comment)
        db.commit()
        return True
    
    return False

# --- Gift Reminder Logic ---
def get_next_gift_event(db: Session, current_user_id: int) -> Optional[schemas.GiftEvent]:
    """Get the next gift event (birthday or Christmas) for users in the same households as current user"""
    christmas_month = int(os.getenv("CHRISTMAS_MONTH", "12"))
    christmas_day = int(os.getenv("CHRISTMAS_DAY", "25"))
    
    today = date.today()
    current_year = today.year
    events = []

    # Add Christmas (universal event - always included)
    christmas_this_year = date(current_year, christmas_month, christmas_day)
    if christmas_this_year >= today:
        events.append({"name": "Christmas", "date": christmas_this_year})
    else:  # Christmas next year
        events.append({"name": "Christmas", "date": date(current_year + 1, christmas_month, christmas_day)})

    # Add Birthdays - only for users in the same households as current user
    try:
        # Get current user info
        current_user = get_family_member(db, current_user_id)
        if not current_user:
            logger.warning(f"Could not find current user {current_user_id}")
            return None
        
        is_admin = current_user.name.lower() == 'admin'
        
        if is_admin:
            # Admin can see all birthdays
            visible_members = db.query(models.FamilyMember).filter(
                models.FamilyMember.birthday.isnot(None),
                models.FamilyMember.birthday != ""
            ).all()
        else:
            # Get current user's household IDs
            current_user_households_query = db.query(models.user_household_association.c.household_id).filter(
                models.user_household_association.c.user_id == current_user_id,
                models.user_household_association.c.status == 'active'
            )
            current_user_households = {row[0] for row in current_user_households_query.all()}
            
            if not current_user_households:
                # If user has no households, only show their own birthday
                visible_members = [current_user]
            else:
                # Get all users who share at least one household with current user
                household_member_ids_query = db.query(models.user_household_association.c.user_id).filter(
                    models.user_household_association.c.household_id.in_(current_user_households),
                    models.user_household_association.c.status == 'active'
                ).distinct()
                household_member_ids = {row[0] for row in household_member_ids_query.all()}
                
                # Get family members with birthdays who are in the same households
                visible_members = db.query(models.FamilyMember).filter(
                    models.FamilyMember.id.in_(household_member_ids),
                    models.FamilyMember.birthday.isnot(None),
                    models.FamilyMember.birthday != ""
                ).all()
        
        # Process visible members' birthdays
        for member in visible_members:
            if member.birthday:
                try:
                    # Parse birthday from YYYY-MM-DD format
                    birthday_date = datetime.strptime(member.birthday, "%Y-%m-%d").date()
                    birth_month = birthday_date.month
                    birth_day = birthday_date.day
                    
                    birthday_this_year = date(current_year, birth_month, birth_day)
                    if birthday_this_year >= today:
                        events.append({"name": f"{member.name}'s Birthday", "date": birthday_this_year})
                    else:  # Birthday next year
                        events.append({"name": f"{member.name}'s Birthday", "date": date(current_year + 1, birth_month, birth_day)})
                except ValueError:
                    logger.warning(f"Could not parse birthday for reminder: {member.name} - {member.birthday}")
                    continue
                    
    except Exception as e:
        logger.error(f"Error getting household members for gift events for user {current_user_id}: {e}")
        # Fallback: only show Christmas if there's an error
        pass

    # Find the soonest event
    if not events:
        return None
    
    events.sort(key=lambda x: x["date"])
    next_event_date = events[0]["date"]
    next_event_name = events[0]["name"]
    
    days_until = (next_event_date - today).days

    return schemas.GiftEvent(name=next_event_name, date=next_event_date, days_until=days_until)

# --- System Settings CRUD ---
def get_system_version(db: Session) -> str:
    try:
        settings = db.query(models.SystemSettings).first()
        if not settings:
            settings = models.SystemSettings()
            db.add(settings)
            db.commit()
        return settings.version
    except Exception as e:
        logger.error(f"Error getting system version: {e}")
        return "1.0.0"  # Fallback version

def update_system_version(db: Session, new_version: str, user_id: int) -> Optional[str]:
    try:
        user = get_family_member(db, user_id)
        if not user:
            logger.warning(f"User not found: ID {user_id}")
            return None
            
        # More comprehensive admin check
        is_admin = user.is_admin or user.name.lower() == 'admin'
        
        # Debug log with comprehensive information
        logger.debug(f"Update version attempt - User: {user.name}, ID: {user.id}, is_admin flag: {user.is_admin}, name check: {user.name.lower() == 'admin'}, Final result: {is_admin}")
    
        if not is_admin:
            logger.warning(f"User {user.name} (ID: {user_id}) is not admin. Permission denied.")
            return None

        settings = db.query(models.SystemSettings).first()
        if not settings:
            settings = models.SystemSettings(version=new_version)
            db.add(settings)
        else:
            settings.version = new_version
            settings.last_updated = datetime.now().date()
        db.commit()
        logger.info(f"Version updated successfully to {new_version} by {user.name}")
        return settings.version
    except Exception as e:
        logger.error(f"Error updating system version: {e}")
        db.rollback()
        return None

def get_schema_hash(db: Session) -> Optional[str]:
    """Get the stored schema hash"""
    try:
        settings = db.query(models.SystemSettings).first()
        if settings is None:
            settings = models.SystemSettings()
            db.add(settings)
            db.commit()
            
        return settings.schema_hash
    except Exception as e:
        logger.error(f"Error getting schema hash: {e}")
        return None

def update_schema_hash(db: Session, new_hash: str) -> bool:
    """Update the stored schema hash"""
    try:
        settings = db.query(models.SystemSettings).first()
        if not settings:
            settings = models.SystemSettings(schema_hash=new_hash)
            db.add(settings)
        else:
            settings.schema_hash = new_hash
        db.commit()
        return True
    except Exception as e:
        logger.error(f"Error updating schema hash: {e}")
        db.rollback()
        return False

# --- External Wishlist CRUD ---
def get_external_wishlists(db: Session, owner_id: int) -> List[models.ExternalWishlist]:
    """Get all external wishlists for a specific owner"""
    try:
        wishlists = db.query(models.ExternalWishlist).filter(models.ExternalWishlist.owner_id == owner_id).all()
        return wishlists if wishlists else []
    except Exception as e:
        logger.error(f"Error fetching external wishlists: {str(e)}")
        return []  # Always return a list even on error

def create_external_wishlist(db: Session, wishlist: schemas.ExternalWishlistCreate, owner_id: int) -> models.ExternalWishlist:
    """Create a new external wishlist link"""
    db_wishlist = models.ExternalWishlist(
        owner_id=owner_id,
        name=wishlist.name,
        url=str(wishlist.url)
    )
    db.add(db_wishlist)
    db.commit()
    db.refresh(db_wishlist)
    return db_wishlist

def get_external_wishlist(db: Session, wishlist_id: int) -> Optional[models.ExternalWishlist]:
    """Get a specific external wishlist by ID"""
    return db.query(models.ExternalWishlist).filter(models.ExternalWishlist.id == wishlist_id).first()

def update_external_wishlist(db: Session, wishlist_id: int, wishlist_update: schemas.ExternalWishlistUpdate, current_user_id: int) -> Optional[models.ExternalWishlist]:
    """Update an external wishlist with authorization check"""
    db_wishlist = get_external_wishlist(db, wishlist_id)
    if not db_wishlist:
        return None
    
    # Check authorization (owner or admin)
    user = get_family_member(db, current_user_id)
    if not user or (user.name.lower() != 'admin' and db_wishlist.owner_id != current_user_id):
        return None
    
    update_data = wishlist_update.model_dump(exclude_unset=True)
    
    # Convert URL to string if present
    if 'url' in update_data and update_data['url'] is not None:
        update_data['url'] = str(update_data['url'])
    
    for key, value in update_data.items():
        setattr(db_wishlist, key, value)
    
    db.commit()
    db.refresh(db_wishlist)
    return db_wishlist

def delete_external_wishlist(db: Session, wishlist_id: int, current_user_id: int) -> bool:
    """Delete an external wishlist with authorization check"""
    db_wishlist = get_external_wishlist(db, wishlist_id)
    if not db_wishlist:
        return False
    
    # Check authorization (owner or admin)
    user = get_family_member(db, current_user_id)
    if not user or (user.name.lower() != 'admin' and db_wishlist.owner_id != current_user_id):
        return False
    
    db.delete(db_wishlist)
    db.commit()
    return True

def update_member_preferences(db: Session, member_id: int, preferences: dict):
    """Update a family member's preferences"""
    member = db.query(models.FamilyMember).filter(models.FamilyMember.id == member_id).first()
    if not member:
        return None
        
    member.preferences = preferences
    db.commit()
    db.refresh(member)
    return member

def update_family_member(db: Session, member_id: int, member_update: schemas.FamilyMemberUpdate) -> Optional[models.FamilyMember]:
    """Update a family member"""
    db_member = get_family_member(db, member_id)
    if not db_member:
        return None
    
    # Update fields
    update_data = member_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_member, key, value)
    
    db.commit()
    db.refresh(db_member)
    return db_member

def delete_family_member(db: Session, member_id: int) -> bool:
    """Delete a family member and all their associated data"""
    db_member = get_family_member(db, member_id)
    if not db_member:
        return False
    
    try:
        # First, delete all comments created by the user
        db.query(models.Comment).filter(models.Comment.author_id == member_id).delete()
        
        # Find all wishlist items owned by the user
        item_ids = [item.id for item in db.query(models.WishlistItem.id).filter(
            models.WishlistItem.owner_id == member_id
        ).all()]
        
        # Delete comments on the user's wishlist items
        if item_ids:
            db.query(models.Comment).filter(models.Comment.item_id.in_(item_ids)).delete(synchronize_session=False)
        
        # Delete the user's wishlist items
        db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == member_id).delete()
        
        # Delete external wishlists
        db.query(models.ExternalWishlist).filter(models.ExternalWishlist.owner_id == member_id).delete()
        
        # Finally, delete the family member (which will also delete preferences since they're stored in the same record)
        db.delete(db_member)
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting family member: {e}")
        return False