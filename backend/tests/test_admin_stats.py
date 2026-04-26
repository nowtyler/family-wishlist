#!/usr/bin/env python3
"""
Tests for Admin Stats endpoint including cart items count.

Tests cover:
- Admin stats endpoint returns all expected fields including total_cart_items
- Cart items count accuracy with various data scenarios
- Permission tests (admin-only access)
- Edge cases (empty database, multiple users)
"""
import pytest
import sys
import os
import tempfile
from datetime import datetime
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import models
from app.database import Base
from app.main import app, get_db


@pytest.fixture(scope="function")
def test_db():
    """Create a test database with shared connection for in-memory SQLite"""
    # Use StaticPool to share the same connection across all sessions
    engine = create_engine(
        "sqlite:///:memory:",
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Override the get_db dependency to use our test database
    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    yield engine, SessionLocal

    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)


@pytest.fixture
def db_session(test_db):
    """Create a test database session"""
    engine, SessionLocal = test_db
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def client(test_db):
    """Create test client with overridden database dependency"""
    return TestClient(app)


@pytest.fixture
def admin_user(db_session):
    """Create an admin user"""
    admin = models.FamilyMember(
        name="Admin User",
        username="admin",
        email="admin@test.com",
        is_admin=True,
        password_hash="fakehash"
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture
def regular_user(db_session):
    """Create a regular (non-admin) user"""
    user = models.FamilyMember(
        name="Regular User",
        username="regular",
        email="regular@test.com",
        is_admin=False,
        password_hash="fakehash"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def multiple_users(db_session):
    """Create multiple users for testing"""
    users = []
    for i in range(3):
        user = models.FamilyMember(
            name=f"User {i}",
            username=f"user{i}",
            email=f"user{i}@test.com",
            is_admin=False,
            password_hash="fakehash"
        )
        db_session.add(user)
        users.append(user)
    db_session.commit()
    for user in users:
        db_session.refresh(user)
    return users


class TestAdminStatsEndpoint:
    """Tests for GET /api/admin/stats endpoint"""

    def test_returns_all_expected_fields(self, client, admin_user):
        """Test that the endpoint returns all required stat fields including total_cart_items"""
        response = client.get(
            "/api/admin/stats",
            headers={"X-Current-User-Id": str(admin_user.id)}
        )

        assert response.status_code == 200
        data = response.json()

        # Verify all expected fields are present
        expected_fields = [
            "total_users",
            "total_households",
            "total_wishlists",
            "total_emails_sent",
            "total_cart_items"
        ]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"

    def test_total_cart_items_zero_when_empty(self, client, admin_user):
        """Test that total_cart_items is 0 when no cart items exist"""
        response = client.get(
            "/api/admin/stats",
            headers={"X-Current-User-Id": str(admin_user.id)}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_cart_items"] == 0

    def test_total_cart_items_counts_single_item(self, db_session, client, admin_user):
        """Test that total_cart_items correctly counts a single cart item"""
        # Create a cart item
        cart_item = models.ShoppingCartItem(
            buyer_id=admin_user.id,
            title="Test Item",
            status="pending"
        )
        db_session.add(cart_item)
        db_session.commit()

        response = client.get(
            "/api/admin/stats",
            headers={"X-Current-User-Id": str(admin_user.id)}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_cart_items"] == 1

    def test_total_cart_items_counts_multiple_items(self, db_session, client, admin_user):
        """Test that total_cart_items correctly counts multiple cart items"""
        # Create multiple cart items
        for i in range(5):
            cart_item = models.ShoppingCartItem(
                buyer_id=admin_user.id,
                title=f"Test Item {i}",
                status="pending"
            )
            db_session.add(cart_item)
        db_session.commit()

        response = client.get(
            "/api/admin/stats",
            headers={"X-Current-User-Id": str(admin_user.id)}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_cart_items"] == 5

    def test_total_cart_items_aggregates_across_users(self, db_session, client, admin_user, multiple_users):
        """Test that total_cart_items sums items from all users"""
        # Create cart items for different users
        for i, user in enumerate(multiple_users):
            for j in range(i + 1):  # User 0 gets 1 item, User 1 gets 2, User 2 gets 3
                cart_item = models.ShoppingCartItem(
                    buyer_id=user.id,
                    title=f"Item {j} for User {i}",
                    status="pending"
                )
                db_session.add(cart_item)
        db_session.commit()

        # Total should be 1 + 2 + 3 = 6
        response = client.get(
            "/api/admin/stats",
            headers={"X-Current-User-Id": str(admin_user.id)}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_cart_items"] == 6

    def test_total_cart_items_includes_all_statuses(self, db_session, client, admin_user):
        """Test that total_cart_items counts items regardless of status"""
        statuses = ["pending", "purchased", "cancelled"]
        for status in statuses:
            cart_item = models.ShoppingCartItem(
                buyer_id=admin_user.id,
                title=f"Item with status {status}",
                status=status
            )
            db_session.add(cart_item)
        db_session.commit()

        response = client.get(
            "/api/admin/stats",
            headers={"X-Current-User-Id": str(admin_user.id)}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_cart_items"] == 3


class TestAdminStatsPermissions:
    """Tests for admin-only access to stats endpoint"""

    def test_non_admin_cannot_access_stats(self, client, regular_user):
        """Test that non-admin users get 403 Forbidden"""
        response = client.get(
            "/api/admin/stats",
            headers={"X-Current-User-Id": str(regular_user.id)}
        )

        assert response.status_code == 403

    def test_missing_user_id_header_returns_403(self, client, admin_user):
        """Test that missing X-Current-User-Id header returns 403"""
        response = client.get("/api/admin/stats")

        assert response.status_code == 403

    def test_invalid_user_id_returns_403(self, client, admin_user):
        """Test that invalid user ID returns 403"""
        response = client.get(
            "/api/admin/stats",
            headers={"X-Current-User-Id": "99999"}
        )

        assert response.status_code == 403


class TestAdminStatsDataIntegrity:
    """Tests for data integrity and accuracy"""

    def test_cart_items_not_affected_by_wishlist_items(self, db_session, client, admin_user):
        """Test that wishlist items don't affect cart items count"""
        # Create wishlist items
        for i in range(3):
            item = models.WishlistItem(
                title=f"Wishlist Item {i}",
                owner_id=admin_user.id,
                priority=1
            )
            db_session.add(item)
        db_session.commit()

        response = client.get(
            "/api/admin/stats",
            headers={"X-Current-User-Id": str(admin_user.id)}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_cart_items"] == 0
        assert data["total_wishlists"] == 3

    def test_stats_independent_counts(self, db_session, client, admin_user):
        """Test that each stat field counts independently"""
        # Create one of each
        household = models.Household(
            name="Test Household",
            created_by=admin_user.id
        )
        db_session.add(household)

        wishlist_item = models.WishlistItem(
            title="Wishlist Item",
            owner_id=admin_user.id,
            priority=1
        )
        db_session.add(wishlist_item)

        cart_item = models.ShoppingCartItem(
            buyer_id=admin_user.id,
            title="Cart Item",
            status="pending"
        )
        db_session.add(cart_item)

        email_log = models.EmailLog(
            recipient_email="test@test.com",
            subject="Test",
            body="Test body",
            status="sent"
        )
        db_session.add(email_log)

        db_session.commit()

        response = client.get(
            "/api/admin/stats",
            headers={"X-Current-User-Id": str(admin_user.id)}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_users"] == 1  # Only admin user
        assert data["total_households"] == 1
        assert data["total_wishlists"] == 1
        assert data["total_cart_items"] == 1
        assert data["total_emails_sent"] == 1


class TestAdminStatsResponseFormat:
    """Tests for response format and types"""

    def test_all_values_are_integers(self, client, admin_user):
        """Test that all stat values are integers"""
        response = client.get(
            "/api/admin/stats",
            headers={"X-Current-User-Id": str(admin_user.id)}
        )

        assert response.status_code == 200
        data = response.json()

        for key, value in data.items():
            assert isinstance(value, int), f"{key} should be an integer, got {type(value)}"

    def test_response_is_json(self, client, admin_user):
        """Test that response content type is JSON"""
        response = client.get(
            "/api/admin/stats",
            headers={"X-Current-User-Id": str(admin_user.id)}
        )

        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/json"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
