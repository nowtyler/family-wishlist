# backend/app/crud.py
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, exists, func, and_, or_
from . import models, schemas
from typing import List, Optional, Tuple, Set
from datetime import date, datetime, timedelta
import os
import logging
from .utils.timezone_utils import get_est_timestamp, get_est_date

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
    
    # Normalize username to lowercase
    normalized_username = member.username.lower().strip()
    
    # Check if username already exists (case insensitive)
    existing_user = db.query(models.FamilyMember).filter(func.lower(models.FamilyMember.username) == normalized_username).first()
    if existing_user:
        raise ValueError("Username already exists")
    
    # Check if email already exists (if provided) - case insensitive
    if member.email:
        normalized_email = member.email.lower().strip()
        existing_email = db.query(models.FamilyMember).filter(func.lower(models.FamilyMember.email) == normalized_email).first()
        if existing_email:
            raise ValueError("Email already in use")
    
    # Create new user with authentication details
    db_member = models.FamilyMember(
        name=member.name,
        username=normalized_username,  # Store username in lowercase
        password_hash=UserAuthService.get_password_hash(member.password),
        email=member.email.lower().strip() if member.email else None,  # Store email in lowercase
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
    
    # Check if username already exists (if being updated) - case insensitive
    if member_update.username and member_update.username.lower().strip() != db_member.username:
        normalized_username = member_update.username.lower().strip()
        existing_user = db.query(models.FamilyMember).filter(
            and_(
                func.lower(models.FamilyMember.username) == normalized_username,
                models.FamilyMember.id != member_id  # Exclude the current member being updated
            )
        ).first()
        if existing_user:
            raise ValueError("Username already exists")
    
    # Check if email already exists (if being updated) - case insensitive
    if member_update.email and member_update.email.lower().strip() != (db_member.email or "").lower():
        normalized_email = member_update.email.lower().strip()
        existing_email = db.query(models.FamilyMember).filter(
            and_(
                func.lower(models.FamilyMember.email) == normalized_email,
                models.FamilyMember.id != member_id  # Exclude the current member being updated
            )
        ).first()
        if existing_email:
            raise ValueError("Email already in use")
    
    # Update fields
    update_data = member_update.dict(exclude_unset=True)
    
    # Normalize username if being updated
    if 'username' in update_data and update_data['username']:
        update_data['username'] = update_data['username'].lower().strip()
    
    # Normalize email if being updated
    if 'email' in update_data and update_data['email']:
        update_data['email'] = update_data['email'].lower().strip()
    
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

def sync_cart_items_from_wishlist_item(db: Session, wishlist_item: models.WishlistItem) -> int:
    """Sync mirrored fields from a wishlist item onto linked shopping cart items."""
    if not wishlist_item:
        return 0

    linked_cart_items = db.query(models.ShoppingCartItem).filter(
        models.ShoppingCartItem.wishlist_item_id == wishlist_item.id
    ).all()

    for cart_item in linked_cart_items:
        cart_item.title = wishlist_item.title
        cart_item.link = wishlist_item.link
        cart_item.image_url = wishlist_item.image_url
        cart_item.price = wishlist_item.price

    return len(linked_cart_items)

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

    sync_cart_items_from_wishlist_item(db, db_item)
    
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
    sync_cart_items_from_wishlist_item(db, db_item)
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
    
    sync_cart_items_from_wishlist_item(db, db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def notify_cart_buyers_on_wishlist_delete(db: Session, wishlist_item: models.WishlistItem) -> None:
    """Disconnect cart items from a deleted wishlist item and notify each buyer."""
    cart_items = db.query(models.ShoppingCartItem).filter(
        models.ShoppingCartItem.wishlist_item_id == wishlist_item.id
    ).all()
    if not cart_items:
        return

    owner = get_family_member(db, wishlist_item.owner_id)
    owner_name = owner.name if owner else "Someone"

    for cart_item in cart_items:
        cart_item.wishlist_item_id = None
        notification = models.Notification(
            recipient_id=cart_item.buyer_id,
            message=f'{owner_name} removed "{wishlist_item.title}" from their wishlist.',
            cart_item_id=cart_item.id,
            is_read=False,
        )
        db.add(notification)

def delete_wishlist_item(db: Session, item_id: int, requesting_user_id: int) -> bool:
    db_item = db.query(models.WishlistItem).filter(models.WishlistItem.id == item_id).first()
    if not db_item:
        return False

    requesting_user = get_family_member(db, requesting_user_id)
    is_admin = requesting_user and requesting_user.name.lower() == 'admin'

    if is_admin or db_item.owner_id == requesting_user_id:
        notify_cart_buyers_on_wishlist_delete(db, db_item)
        db.query(models.Comment).filter(models.Comment.item_id == item_id).delete()
        db.delete(db_item)
        db.commit()
        return True
    return False

def delete_all_wishlist_items(db: Session, owner_id: int, requesting_user_id: int) -> bool:
    requesting_user = get_family_member(db, requesting_user_id)
    is_admin = requesting_user and requesting_user.name.lower() == 'admin'

    if is_admin or owner_id == requesting_user_id:
        items = db.query(models.WishlistItem).filter(models.WishlistItem.owner_id == owner_id).all()
        for item in items:
            notify_cart_buyers_on_wishlist_delete(db, item)
            db.query(models.Comment).filter(models.Comment.item_id == item.id).delete()

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
    now = get_est_timestamp()
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


def create_shared_wishlist_item_comment(db: Session, shared_item_id: int, text: str, author_id: int) -> Optional[models.Comment]:
    """Create a comment on a shared wishlist item."""
    # Verify the shared item exists
    shared_item = db.query(models.SharedWishlistItem).filter(
        models.SharedWishlistItem.id == shared_item_id
    ).first()
    if not shared_item:
        return None

    now = get_est_timestamp()
    db_comment = models.Comment(
        text=text,
        author_id=author_id,
        shared_item_id=shared_item_id,
        item_id=None,  # Not a regular wishlist item
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
            # Update last_updated timestamp
            now = get_est_timestamp()
            settings.last_updated = now.date()
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


# --- Shared Wishlist CRUD ---

def get_shared_wishlists_for_user(db: Session, user_id: int) -> List[models.SharedWishlist]:
    """Get all shared wishlists where the user is an owner"""
    return db.query(models.SharedWishlist).join(
        models.shared_wishlist_owners,
        models.SharedWishlist.id == models.shared_wishlist_owners.c.wishlist_id
    ).filter(
        models.shared_wishlist_owners.c.user_id == user_id
    ).all()


def get_all_shared_wishlists(db: Session, user_id: Optional[int] = None) -> List[models.SharedWishlist]:
    """Get all shared wishlists visible to the user (auto-follows owners across households)"""
    query = db.query(models.SharedWishlist)

    if user_id:
        # Get user's household IDs
        user_households = db.query(models.user_household_association.c.household_id).filter(
            models.user_household_association.c.user_id == user_id,
            models.user_household_association.c.status == 'active'
        ).subquery()

        # Find all owners who are in the user's households
        owners_in_user_households = db.query(models.FamilyMember.id).join(
            models.user_household_association,
            models.FamilyMember.id == models.user_household_association.c.user_id
        ).filter(
            models.user_household_association.c.household_id.in_(user_households),
            models.user_household_association.c.status == 'active'
        ).subquery()

        # Filter to wishlists where at least one owner is in the user's households
        query = query.filter(
            db.query(models.shared_wishlist_owners).filter(
                models.shared_wishlist_owners.c.wishlist_id == models.SharedWishlist.id,
                models.shared_wishlist_owners.c.user_id.in_(owners_in_user_households)
            ).exists()
        )

    return query.order_by(models.SharedWishlist.created_at.desc()).all()


def get_shared_wishlist(db: Session, wishlist_id: int) -> Optional[models.SharedWishlist]:
    """Get a shared wishlist by ID"""
    return db.query(models.SharedWishlist).filter(models.SharedWishlist.id == wishlist_id).first()


def is_shared_wishlist_owner(db: Session, wishlist_id: int, user_id: int) -> bool:
    """Check if a user is an owner of a shared wishlist"""
    result = db.query(models.shared_wishlist_owners).filter(
        models.shared_wishlist_owners.c.wishlist_id == wishlist_id,
        models.shared_wishlist_owners.c.user_id == user_id
    ).first()
    return result is not None


def get_shared_wishlist_owners(db: Session, wishlist_id: int) -> List[models.FamilyMember]:
    """Get all owners of a shared wishlist"""
    return db.query(models.FamilyMember).join(
        models.shared_wishlist_owners,
        models.FamilyMember.id == models.shared_wishlist_owners.c.user_id
    ).filter(
        models.shared_wishlist_owners.c.wishlist_id == wishlist_id
    ).all()


def create_shared_wishlist(db: Session, wishlist: schemas.SharedWishlistCreate, creator_id: int) -> models.SharedWishlist:
    """Create a new shared wishlist and add the creator as an owner"""
    db_wishlist = models.SharedWishlist(
        name=wishlist.name,
        description=wishlist.description,
        created_by=creator_id,
        household_id=wishlist.household_id,
        occasion_date=wishlist.occasion_date,
        occasion_type=wishlist.occasion_type,
        wishlist_type=wishlist.wishlist_type
    )
    db.add(db_wishlist)
    db.flush()  # Get the ID before adding owner

    # Add creator as first owner
    db.execute(
        models.shared_wishlist_owners.insert().values(
            wishlist_id=db_wishlist.id,
            user_id=creator_id,
            added_by=creator_id
        )
    )

    db.commit()
    db.refresh(db_wishlist)
    return db_wishlist


def update_shared_wishlist(db: Session, wishlist_id: int, wishlist_update: schemas.SharedWishlistUpdate, current_user_id: int) -> Optional[models.SharedWishlist]:
    """Update a shared wishlist (only owners can update)"""
    db_wishlist = get_shared_wishlist(db, wishlist_id)
    if not db_wishlist:
        return None

    # Check if user is an owner
    if not is_shared_wishlist_owner(db, wishlist_id, current_user_id):
        user = get_family_member(db, current_user_id)
        if not user or not user.is_admin:
            return None

    update_data = wishlist_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_wishlist, key, value)

    db.commit()
    db.refresh(db_wishlist)
    return db_wishlist


def delete_shared_wishlist(db: Session, wishlist_id: int, current_user_id: int) -> bool:
    """Delete a shared wishlist (only creator or admin can delete)"""
    db_wishlist = get_shared_wishlist(db, wishlist_id)
    if not db_wishlist:
        return False

    user = get_family_member(db, current_user_id)
    is_admin = user and user.is_admin

    # Only creator or admin can delete
    if db_wishlist.created_by != current_user_id and not is_admin:
        return False

    delete_all_shared_wishlist_items(db, wishlist_id, current_user_id)
    db.execute(
        models.shared_wishlist_owners.delete().where(
            models.shared_wishlist_owners.c.wishlist_id == wishlist_id
        )
    )
    db.delete(db_wishlist)
    db.commit()
    return True


def add_shared_wishlist_owner(db: Session, wishlist_id: int, new_owner_username: str, added_by_user_id: int) -> Optional[models.FamilyMember]:
    """Add a new owner to a shared wishlist by username"""
    # Check if requesting user is an owner
    if not is_shared_wishlist_owner(db, wishlist_id, added_by_user_id):
        user = get_family_member(db, added_by_user_id)
        if not user or not user.is_admin:
            return None

    # Find user by username (case insensitive)
    new_owner = db.query(models.FamilyMember).filter(
        func.lower(models.FamilyMember.username) == new_owner_username.lower().strip()
    ).first()

    if not new_owner:
        return None

    # Check if already an owner
    if is_shared_wishlist_owner(db, wishlist_id, new_owner.id):
        return new_owner  # Already an owner, return success

    # Add as owner
    db.execute(
        models.shared_wishlist_owners.insert().values(
            wishlist_id=wishlist_id,
            user_id=new_owner.id,
            added_by=added_by_user_id
        )
    )
    db.commit()
    return new_owner


def remove_shared_wishlist_owner(db: Session, wishlist_id: int, owner_id_to_remove: int, current_user_id: int) -> bool:
    """Remove an owner from a shared wishlist"""
    db_wishlist = get_shared_wishlist(db, wishlist_id)
    if not db_wishlist:
        return False

    user = get_family_member(db, current_user_id)
    is_admin = user and user.is_admin

    # Check permissions: creator, admin, or self-removal
    is_owner = is_shared_wishlist_owner(db, wishlist_id, current_user_id)
    is_self_removal = current_user_id == owner_id_to_remove
    is_creator = db_wishlist.created_by == current_user_id

    if not (is_creator or is_admin or (is_owner and is_self_removal)):
        return False

    # Don't allow removing the last owner
    owner_count = db.query(models.shared_wishlist_owners).filter(
        models.shared_wishlist_owners.c.wishlist_id == wishlist_id
    ).count()

    if owner_count <= 1:
        return False

    # Remove owner
    db.execute(
        models.shared_wishlist_owners.delete().where(
            and_(
                models.shared_wishlist_owners.c.wishlist_id == wishlist_id,
                models.shared_wishlist_owners.c.user_id == owner_id_to_remove
            )
        )
    )
    db.commit()
    return True


# --- Shared Wishlist Items CRUD ---

def get_shared_wishlist_items(db: Session, wishlist_id: int, current_user_id: int) -> List[schemas.SharedWishlistItem]:
    """
    Get items from a shared wishlist with proper visibility rules.

    Key difference from regular wishlists:
    - Owners of shared wishlists CAN see purchased status (to coordinate gift-giving for kids)
    - Non-owners see purchased status as usual
    """
    db_wishlist = get_shared_wishlist(db, wishlist_id)
    if not db_wishlist:
        return []

    # Check if user has access (is an owner or shares household with an owner)
    is_owner = is_shared_wishlist_owner(db, wishlist_id, current_user_id)

    user = get_family_member(db, current_user_id)
    is_admin = user and user.is_admin

    if not is_owner and not is_admin:
        # Check household access - user must share a household with at least one owner
        owners = get_shared_wishlist_owners(db, wishlist_id)
        owner_ids = [o.id for o in owners]

        # Get current user's households
        current_user_households = {
            row[0] for row in db.query(models.user_household_association.c.household_id).filter(
                models.user_household_association.c.user_id == current_user_id,
                models.user_household_association.c.status == 'active'
            ).all()
        }

        # Get owners' households
        owner_households = {
            row[0] for row in db.query(models.user_household_association.c.household_id).filter(
                models.user_household_association.c.user_id.in_(owner_ids),
                models.user_household_association.c.status == 'active'
            ).all()
        }

        # Check for shared households
        if not current_user_households.intersection(owner_households):
            return []

    # Get items
    db_items = db.query(models.SharedWishlistItem).filter(
        models.SharedWishlistItem.wishlist_id == wishlist_id
    ).order_by(
        models.SharedWishlistItem.priority.desc(),
        models.SharedWishlistItem.id.desc()
    ).all()

    result_items = []
    for item in db_items:
        # KEY DIFFERENCE: Owners of shared wishlists CAN see purchased status
        # This allows parents to coordinate without duplicating gifts
        # (Unlike regular wishlists where owner cannot see to preserve surprise)
        effective_is_purchased = item.is_purchased
        effective_purchased_by = item.purchased_by

        thinking_by_list = item.thinking_about_by.split(',') if item.thinking_about_by else []
        thinking_by_list = [name.strip() for name in thinking_by_list if name.strip()]

        # Get comments for this shared wishlist item
        item_comments = db.query(models.Comment).filter(
            models.Comment.shared_item_id == item.id
        ).order_by(models.Comment.created_at.asc()).all()

        comments_list = []
        for comment in item_comments:
            author = get_family_member(db, comment.author_id)
            author_name = author.name if author else "Unknown"
            comments_list.append(schemas.SharedWishlistItemComment(
                id=comment.id,
                author_id=comment.author_id,
                author_name=author_name,
                shared_item_id=comment.shared_item_id,
                text=comment.text,
                created_at=comment.created_at
            ))

        result_items.append(schemas.SharedWishlistItem(
            id=item.id,
            wishlist_id=item.wishlist_id,
            title=item.title,
            description=item.description,
            link=str(item.link) if item.link else None,
            image_url=str(item.image_url) if item.image_url else None,
            priority=item.priority,
            price=item.price,
            is_purchased=effective_is_purchased,
            purchased_by=effective_purchased_by,
            thinking_about_by_list=thinking_by_list,
            comments=comments_list,
            created_at=item.created_at,
            created_by=item.created_by
        ))

    return result_items


def create_shared_wishlist_item(db: Session, wishlist_id: int, item: schemas.SharedWishlistItemCreate, current_user_id: int) -> Optional[models.SharedWishlistItem]:
    """Create a new item in a shared wishlist (only owners can add items)"""
    if not is_shared_wishlist_owner(db, wishlist_id, current_user_id):
        user = get_family_member(db, current_user_id)
        if not user or not user.is_admin:
            return None

    item_data = item.model_dump()

    # Convert URLs to strings
    if item_data.get('link'):
        item_data['link'] = str(item_data['link'])
    if item_data.get('image_url'):
        item_data['image_url'] = str(item_data['image_url'])

    # Convert price to cents
    if item_data.get('price') is not None:
        item_data['price'] = int(item_data['price'] * 100)

    db_item = models.SharedWishlistItem(
        **item_data,
        wishlist_id=wishlist_id,
        created_by=current_user_id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def update_shared_wishlist_item(db: Session, item_id: int, item_update: schemas.SharedWishlistItemUpdate, current_user_id: int) -> Optional[models.SharedWishlistItem]:
    """Update an item in a shared wishlist (only owners can update)"""
    db_item = db.query(models.SharedWishlistItem).filter(models.SharedWishlistItem.id == item_id).first()
    if not db_item:
        return None

    if not is_shared_wishlist_owner(db, db_item.wishlist_id, current_user_id):
        user = get_family_member(db, current_user_id)
        if not user or not user.is_admin:
            return None

    update_data = item_update.model_dump(exclude_unset=True)

    # Convert price to cents if provided
    if 'price' in update_data and update_data['price'] is not None:
        update_data['price'] = int(update_data['price'] * 100)

    for key, value in update_data.items():
        setattr(db_item, key, value)

    sync_cart_items_from_shared_wishlist_item(db, db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def sync_cart_items_from_shared_wishlist_item(db: Session, shared_item: models.SharedWishlistItem) -> int:
    """Sync mirrored fields from a shared wishlist item onto linked shopping cart items."""
    if not shared_item:
        return 0

    linked_cart_items = db.query(models.ShoppingCartItem).filter(
        models.ShoppingCartItem.shared_wishlist_item_id == shared_item.id
    ).all()

    for cart_item in linked_cart_items:
        cart_item.title = shared_item.title
        cart_item.link = shared_item.link
        cart_item.image_url = shared_item.image_url
        cart_item.price = shared_item.price

    return len(linked_cart_items)


def notify_cart_buyers_on_shared_wishlist_delete(db: Session, shared_item: models.SharedWishlistItem) -> None:
    """Disconnect cart items from a deleted shared wishlist item and notify each buyer."""
    cart_items = db.query(models.ShoppingCartItem).filter(
        models.ShoppingCartItem.shared_wishlist_item_id == shared_item.id
    ).all()
    if not cart_items:
        return

    wishlist = db.query(models.SharedWishlist).filter(
        models.SharedWishlist.id == shared_item.wishlist_id
    ).first()
    wishlist_name = wishlist.name if wishlist else "A shared wishlist"

    for cart_item in cart_items:
        cart_item.shared_wishlist_item_id = None
        notification = models.Notification(
            recipient_id=cart_item.buyer_id,
            message=f'"{shared_item.title}" was removed from "{wishlist_name}".',
            cart_item_id=cart_item.id,
            is_read=False,
        )
        db.add(notification)


def delete_shared_wishlist_item(db: Session, item_id: int, current_user_id: int) -> bool:
    """Delete an item from a shared wishlist (only owners can delete)"""
    db_item = db.query(models.SharedWishlistItem).filter(models.SharedWishlistItem.id == item_id).first()
    if not db_item:
        return False

    if not is_shared_wishlist_owner(db, db_item.wishlist_id, current_user_id):
        user = get_family_member(db, current_user_id)
        if not user or not user.is_admin:
            return False

    # Notify cart buyers before deletion
    notify_cart_buyers_on_shared_wishlist_delete(db, db_item)

    db.delete(db_item)
    db.commit()
    return True


def delete_all_shared_wishlist_items(db: Session, wishlist_id: int, current_user_id: int) -> bool:
    """Delete all items from a shared wishlist (owners only)"""
    if not is_shared_wishlist_owner(db, wishlist_id, current_user_id):
        user = get_family_member(db, current_user_id)
        if not user or not user.is_admin:
            return False

    shared_items = db.query(models.SharedWishlistItem).filter(
        models.SharedWishlistItem.wishlist_id == wishlist_id
    ).all()

    for shared_item in shared_items:
        notify_cart_buyers_on_shared_wishlist_delete(db, shared_item)
        db.delete(shared_item)

    db.commit()
    return True


def toggle_shared_item_thinking_about(db: Session, item_id: int, user_id: int) -> Optional[models.SharedWishlistItem]:
    """Toggle 'thinking about' status for a shared wishlist item"""
    db_item = db.query(models.SharedWishlistItem).filter(models.SharedWishlistItem.id == item_id).first()
    if not db_item:
        return None

    user = get_family_member(db, user_id)
    if not user:
        return None

    # Owners cannot mark their own items as thinking about (unless no_secrets mode)
    if is_shared_wishlist_owner(db, db_item.wishlist_id, user_id):
        wishlist = get_shared_wishlist(db, db_item.wishlist_id)
        if not wishlist or (wishlist.wishlist_type or "normal") != "no_secrets":
            return None

    thinking_list = db_item.thinking_about_by.split(',') if db_item.thinking_about_by else []
    thinking_list = [name.strip() for name in thinking_list if name.strip()]

    if user.name in thinking_list:
        thinking_list.remove(user.name)
    else:
        thinking_list.append(user.name)

    db_item.thinking_about_by = ",".join(thinking_list)
    sync_cart_items_from_shared_wishlist_item(db, db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def toggle_shared_item_purchased(db: Session, item_id: int, user_id: int) -> Optional[models.SharedWishlistItem]:
    """Toggle purchased status for a shared wishlist item"""
    db_item = db.query(models.SharedWishlistItem).filter(models.SharedWishlistItem.id == item_id).first()
    if not db_item:
        return None

    user = get_family_member(db, user_id)
    if not user:
        return None

    # Owners cannot mark their own items as purchased (unless no_secrets mode)
    if is_shared_wishlist_owner(db, db_item.wishlist_id, user_id):
        wishlist = get_shared_wishlist(db, db_item.wishlist_id)
        if not wishlist or (wishlist.wishlist_type or "normal") != "no_secrets":
            return None

    if db_item.is_purchased:
        if db_item.purchased_by == user.name:
            db_item.is_purchased = False
            db_item.purchased_by = None
        else:
            return None  # Can't toggle if someone else purchased
    else:
        db_item.is_purchased = True
        db_item.purchased_by = user.name

    sync_cart_items_from_shared_wishlist_item(db, db_item)
    db.commit()
    db.refresh(db_item)
    return db_item
