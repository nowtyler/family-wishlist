#!/usr/bin/env python3
import os
import sys

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import crud, models
from app.database import Base


@pytest.fixture(scope="function")
def db_session():
    engine = create_engine("sqlite:///:memory:", echo=False)

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


def seed_cart_notification_graph(db_session):
    owner = models.FamilyMember(name="Owner", username="owner", email="owner@test.com")
    buyer = models.FamilyMember(name="Buyer", username="buyer", email="buyer@test.com")
    db_session.add_all([owner, buyer])
    db_session.commit()

    wishlist_item = models.WishlistItem(title="Test Item", owner_id=owner.id)
    db_session.add(wishlist_item)
    db_session.commit()

    cart_item = models.ShoppingCartItem(
        buyer_id=buyer.id,
        recipient_id=owner.id,
        wishlist_item_id=wishlist_item.id,
        title="Test Item",
        status="pending",
    )
    db_session.add(cart_item)
    db_session.commit()

    notification = models.Notification(
        recipient_id=buyer.id,
        message='Owner removed "Test Item" from their wishlist.',
        cart_item_id=cart_item.id,
        is_read=False,
    )
    db_session.add(notification)
    db_session.commit()
    db_session.refresh(cart_item)
    db_session.refresh(notification)
    return cart_item, notification


def test_cart_delete_fails_while_notification_still_references_item(db_session):
    cart_item, _ = seed_cart_notification_graph(db_session)

    db_session.delete(cart_item)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_detach_notifications_for_cart_items_allows_cart_delete(db_session):
    cart_item, notification = seed_cart_notification_graph(db_session)

    detached_count = crud.detach_notifications_for_cart_items(db_session, [cart_item.id])
    db_session.delete(cart_item)
    db_session.commit()
    db_session.refresh(notification)

    assert detached_count == 1
    assert notification.cart_item_id is None
    assert (
        db_session.query(models.ShoppingCartItem)
        .filter(models.ShoppingCartItem.id == cart_item.id)
        .first()
        is None
    )
