#!/usr/bin/env python3
"""
Tests for Shared Kid Wishlists feature.

Tests cover:
- Permission tests: owner vs co-owner vs non-owner
- Visibility tests: standard list hides for owner, shared kid shows for owners
- Regression tests for existing behavior
"""
import pytest
import sys
import os
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import models, schemas, crud
from app.database import Base


# Test database setup
@pytest.fixture(scope="function")
def db_session():
    """Create a test database session"""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


@pytest.fixture
def test_users(db_session):
    """Create test users: parent1, parent2, and a family member"""
    parent1 = models.FamilyMember(
        name="Parent1",
        username="parent1",
        email="parent1@test.com",
        is_admin=False
    )
    parent2 = models.FamilyMember(
        name="Parent2",
        username="parent2",
        email="parent2@test.com",
        is_admin=False
    )
    family_member = models.FamilyMember(
        name="FamilyMember",
        username="familymember",
        email="family@test.com",
        is_admin=False
    )
    admin = models.FamilyMember(
        name="Admin",
        username="admin",
        email="admin@test.com",
        is_admin=True
    )

    db_session.add_all([parent1, parent2, family_member, admin])
    db_session.commit()
    db_session.refresh(parent1)
    db_session.refresh(parent2)
    db_session.refresh(family_member)
    db_session.refresh(admin)

    return {
        "parent1": parent1,
        "parent2": parent2,
        "family_member": family_member,
        "admin": admin
    }


@pytest.fixture
def test_household(db_session, test_users):
    """Create a test household with all users"""
    household = models.Household(
        name="Test Family",
        description="Test household",
        created_by=test_users["parent1"].id
    )
    db_session.add(household)
    db_session.commit()
    db_session.refresh(household)

    # Add all users to household
    for user in test_users.values():
        db_session.execute(
            models.user_household_association.insert().values(
                user_id=user.id,
                household_id=household.id,
                status='active'
            )
        )
    db_session.commit()

    return household


class TestSharedWishlistCreation:
    """Tests for creating shared wishlists"""

    def test_create_shared_wishlist(self, db_session, test_users):
        """Test creating a shared wishlist"""
        parent1 = test_users["parent1"]

        wishlist_data = schemas.SharedWishlistCreate(
            name="Emma's Wishlist",
            description="Birthday wishlist for Emma"
        )

        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)

        assert wishlist.id is not None
        assert wishlist.name == "Emma's Wishlist"
        assert wishlist.description == "Birthday wishlist for Emma"
        assert wishlist.created_by == parent1.id

    def test_creator_is_added_as_owner(self, db_session, test_users):
        """Test that the creator is automatically added as an owner"""
        parent1 = test_users["parent1"]

        wishlist_data = schemas.SharedWishlistCreate(name="Test Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)

        is_owner = crud.is_shared_wishlist_owner(db_session, wishlist.id, parent1.id)
        assert is_owner is True

    def test_get_shared_wishlists_for_user(self, db_session, test_users):
        """Test getting shared wishlists for a user"""
        parent1 = test_users["parent1"]
        parent2 = test_users["parent2"]

        # Create two wishlists for parent1
        crud.create_shared_wishlist(db_session, schemas.SharedWishlistCreate(name="List 1"), parent1.id)
        crud.create_shared_wishlist(db_session, schemas.SharedWishlistCreate(name="List 2"), parent1.id)

        # Create one wishlist for parent2
        crud.create_shared_wishlist(db_session, schemas.SharedWishlistCreate(name="List 3"), parent2.id)

        parent1_wishlists = crud.get_shared_wishlists_for_user(db_session, parent1.id)
        parent2_wishlists = crud.get_shared_wishlists_for_user(db_session, parent2.id)

        assert len(parent1_wishlists) == 2
        assert len(parent2_wishlists) == 1


class TestSharedWishlistOwnership:
    """Tests for co-owner management"""

    def test_add_co_owner(self, db_session, test_users):
        """Test adding a co-owner to a shared wishlist"""
        parent1 = test_users["parent1"]
        parent2 = test_users["parent2"]

        wishlist_data = schemas.SharedWishlistCreate(name="Emma's Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)

        # Add parent2 as co-owner
        new_owner = crud.add_shared_wishlist_owner(
            db_session, wishlist.id, "parent2", parent1.id
        )

        assert new_owner is not None
        assert new_owner.id == parent2.id
        assert crud.is_shared_wishlist_owner(db_session, wishlist.id, parent2.id) is True

    def test_non_owner_cannot_add_co_owner(self, db_session, test_users):
        """Test that non-owners cannot add co-owners"""
        parent1 = test_users["parent1"]
        parent2 = test_users["parent2"]
        family_member = test_users["family_member"]

        wishlist_data = schemas.SharedWishlistCreate(name="Emma's Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)

        # Try to add parent2 as co-owner by family_member (should fail)
        result = crud.add_shared_wishlist_owner(
            db_session, wishlist.id, "parent2", family_member.id
        )

        assert result is None

    def test_remove_co_owner(self, db_session, test_users):
        """Test removing a co-owner from a shared wishlist"""
        parent1 = test_users["parent1"]
        parent2 = test_users["parent2"]

        wishlist_data = schemas.SharedWishlistCreate(name="Emma's Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)
        crud.add_shared_wishlist_owner(db_session, wishlist.id, "parent2", parent1.id)

        # Remove parent2
        result = crud.remove_shared_wishlist_owner(
            db_session, wishlist.id, parent2.id, parent1.id
        )

        assert result is True
        assert crud.is_shared_wishlist_owner(db_session, wishlist.id, parent2.id) is False

    def test_cannot_remove_last_owner(self, db_session, test_users):
        """Test that the last owner cannot be removed"""
        parent1 = test_users["parent1"]

        wishlist_data = schemas.SharedWishlistCreate(name="Emma's Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)

        # Try to remove the only owner
        result = crud.remove_shared_wishlist_owner(
            db_session, wishlist.id, parent1.id, parent1.id
        )

        assert result is False

    def test_self_removal(self, db_session, test_users):
        """Test that an owner can remove themselves"""
        parent1 = test_users["parent1"]
        parent2 = test_users["parent2"]

        wishlist_data = schemas.SharedWishlistCreate(name="Emma's Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)
        crud.add_shared_wishlist_owner(db_session, wishlist.id, "parent2", parent1.id)

        # Parent2 removes themselves
        result = crud.remove_shared_wishlist_owner(
            db_session, wishlist.id, parent2.id, parent2.id
        )

        assert result is True


class TestSharedWishlistItems:
    """Tests for shared wishlist items"""

    def test_owner_can_add_item(self, db_session, test_users):
        """Test that an owner can add items to a shared wishlist"""
        parent1 = test_users["parent1"]

        wishlist_data = schemas.SharedWishlistCreate(name="Emma's Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)

        item_data = schemas.SharedWishlistItemCreate(
            title="Lego Set",
            description="Star Wars Lego",
            price=49.99,
            priority=2
        )
        item = crud.create_shared_wishlist_item(db_session, wishlist.id, item_data, parent1.id)

        assert item is not None
        assert item.title == "Lego Set"
        assert item.price == 4999  # Converted to cents

    def test_non_owner_cannot_add_item(self, db_session, test_users):
        """Test that non-owners cannot add items"""
        parent1 = test_users["parent1"]
        family_member = test_users["family_member"]

        wishlist_data = schemas.SharedWishlistCreate(name="Emma's Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)

        item_data = schemas.SharedWishlistItemCreate(title="Test Item")
        item = crud.create_shared_wishlist_item(db_session, wishlist.id, item_data, family_member.id)

        assert item is None


class TestPurchaseVisibility:
    """Tests for purchase visibility rules - KEY FEATURE"""

    def test_owner_sees_purchased_status_on_shared_wishlist(self, db_session, test_users, test_household):
        """KEY TEST: Owners of shared wishlists CAN see purchased status"""
        parent1 = test_users["parent1"]
        parent2 = test_users["parent2"]
        family_member = test_users["family_member"]

        # Create shared wishlist with both parents as owners
        wishlist_data = schemas.SharedWishlistCreate(name="Emma's Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)
        crud.add_shared_wishlist_owner(db_session, wishlist.id, "parent2", parent1.id)

        # Add an item
        item_data = schemas.SharedWishlistItemCreate(title="Toy", price=20.00)
        item = crud.create_shared_wishlist_item(db_session, wishlist.id, item_data, parent1.id)

        # Family member purchases the item
        crud.toggle_shared_item_purchased(db_session, item.id, family_member.id)

        # Get items as parent1 (owner)
        items_for_parent1 = crud.get_shared_wishlist_items(db_session, wishlist.id, parent1.id)

        # Owner SHOULD see purchased status
        assert len(items_for_parent1) == 1
        assert items_for_parent1[0].is_purchased is True
        assert items_for_parent1[0].purchased_by == family_member.name

    def test_owners_cannot_mark_own_items_purchased(self, db_session, test_users, test_household):
        """Test that owners cannot mark items as purchased on their own shared wishlist"""
        parent1 = test_users["parent1"]

        wishlist_data = schemas.SharedWishlistCreate(name="Emma's Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)

        item_data = schemas.SharedWishlistItemCreate(title="Toy")
        item = crud.create_shared_wishlist_item(db_session, wishlist.id, item_data, parent1.id)

        # Owner tries to mark item as purchased (should fail)
        result = crud.toggle_shared_item_purchased(db_session, item.id, parent1.id)

        assert result is None

    def test_family_member_can_mark_purchased(self, db_session, test_users, test_household):
        """Test that family members (non-owners) can mark items as purchased"""
        parent1 = test_users["parent1"]
        family_member = test_users["family_member"]

        wishlist_data = schemas.SharedWishlistCreate(name="Emma's Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)

        item_data = schemas.SharedWishlistItemCreate(title="Toy")
        item = crud.create_shared_wishlist_item(db_session, wishlist.id, item_data, parent1.id)

        # Family member marks item as purchased
        result = crud.toggle_shared_item_purchased(db_session, item.id, family_member.id)

        assert result is not None
        assert result.is_purchased is True
        assert result.purchased_by == family_member.name


class TestRegressionStandardWishlists:
    """Regression tests for existing standard wishlist behavior"""

    def test_standard_wishlist_owner_cannot_see_purchased(self, db_session, test_users, test_household):
        """REGRESSION: Standard wishlist owners should NOT see purchased status"""
        parent1 = test_users["parent1"]
        family_member = test_users["family_member"]

        # Create a standard wishlist item (not shared)
        item = models.WishlistItem(
            title="Parent's Gift",
            owner_id=parent1.id,
            priority=1
        )
        db_session.add(item)
        db_session.commit()

        # Mark it as purchased by family member
        item.is_purchased = True
        item.purchased_by = family_member.name
        db_session.commit()

        # Get items as the owner (parent1)
        items = crud.get_wishlist_items_by_owner(db_session, parent1.id, parent1.id)

        # Owner should NOT see purchased status (preserve surprise)
        assert len(items) == 1
        assert items[0].is_purchased is False
        assert items[0].purchased_by is None

    def test_standard_wishlist_non_owner_sees_purchased(self, db_session, test_users, test_household):
        """REGRESSION: Non-owners viewing standard wishlist should see purchased status"""
        parent1 = test_users["parent1"]
        parent2 = test_users["parent2"]

        # Create a standard wishlist item
        item = models.WishlistItem(
            title="Parent's Gift",
            owner_id=parent1.id,
            priority=1,
            is_purchased=True,
            purchased_by=parent2.name
        )
        db_session.add(item)
        db_session.commit()

        # Get items as a non-owner (parent2)
        items = crud.get_wishlist_items_by_owner(db_session, parent1.id, parent2.id)

        # Non-owner SHOULD see purchased status
        assert len(items) == 1
        assert items[0].is_purchased is True
        assert items[0].purchased_by == parent2.name


class TestDeleteSharedWishlist:
    """Tests for deleting shared wishlists"""

    def test_creator_can_delete(self, db_session, test_users):
        """Test that the creator can delete the shared wishlist"""
        parent1 = test_users["parent1"]

        wishlist_data = schemas.SharedWishlistCreate(name="Emma's Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)

        result = crud.delete_shared_wishlist(db_session, wishlist.id, parent1.id)

        assert result is True
        assert crud.get_shared_wishlist(db_session, wishlist.id) is None

    def test_co_owner_cannot_delete(self, db_session, test_users):
        """Test that co-owners cannot delete the shared wishlist"""
        parent1 = test_users["parent1"]
        parent2 = test_users["parent2"]

        wishlist_data = schemas.SharedWishlistCreate(name="Emma's Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)
        crud.add_shared_wishlist_owner(db_session, wishlist.id, "parent2", parent1.id)

        # Co-owner tries to delete
        result = crud.delete_shared_wishlist(db_session, wishlist.id, parent2.id)

        assert result is False
        assert crud.get_shared_wishlist(db_session, wishlist.id) is not None

    def test_admin_can_delete(self, db_session, test_users):
        """Test that admin can delete any shared wishlist"""
        parent1 = test_users["parent1"]
        admin = test_users["admin"]

        wishlist_data = schemas.SharedWishlistCreate(name="Emma's Wishlist")
        wishlist = crud.create_shared_wishlist(db_session, wishlist_data, parent1.id)

        result = crud.delete_shared_wishlist(db_session, wishlist.id, admin.id)

        assert result is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
