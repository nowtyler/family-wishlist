#!/usr/bin/env python3
import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import models
from app.database import Base
from app.main import app, get_db


@pytest.fixture(scope="function")
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

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
    _, SessionLocal = test_db
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def client(test_db):
    return TestClient(app)


def add_member_to_household(db_session, user_id, household_id):
    db_session.execute(
        models.user_household_association.insert().values(
            user_id=user_id,
            household_id=household_id,
            status="active",
        )
    )


def test_family_members_only_include_shared_households_for_non_admins(db_session, client):
    viewer = models.FamilyMember(
        name="Bob",
        username="bob",
        email="bob@test.com",
        is_admin=False,
        password_hash="fakehash",
    )
    daniel = models.FamilyMember(
        name="Daniel",
        username="daniel",
        email="daniel@test.com",
        is_admin=False,
        password_hash="fakehash",
    )
    outsider = models.FamilyMember(
        name="Outsider",
        username="outsider",
        email="outsider@test.com",
        is_admin=False,
        password_hash="fakehash",
    )
    db_session.add_all([viewer, daniel, outsider])
    db_session.commit()
    db_session.refresh(viewer)
    db_session.refresh(daniel)
    db_session.refresh(outsider)

    smith = models.Household(name="Smith", created_by=viewer.id)
    hector = models.Household(name="Hector", created_by=viewer.id)
    jones = models.Household(name="Jones", created_by=viewer.id)
    db_session.add_all([smith, hector, jones])
    db_session.commit()
    db_session.refresh(smith)
    db_session.refresh(hector)
    db_session.refresh(jones)

    add_member_to_household(db_session, viewer.id, smith.id)
    add_member_to_household(db_session, viewer.id, jones.id)
    add_member_to_household(db_session, daniel.id, smith.id)
    add_member_to_household(db_session, daniel.id, hector.id)
    add_member_to_household(db_session, daniel.id, jones.id)
    add_member_to_household(db_session, outsider.id, hector.id)
    db_session.commit()

    response = client.get(
        "/api/family-members",
        headers={"X-Current-User-Id": str(viewer.id)},
    )

    assert response.status_code == 200
    members = response.json()

    assert {member["name"] for member in members} == {"Bob", "Daniel"}

    daniel_payload = next(member for member in members if member["id"] == daniel.id)
    assert daniel_payload["household_count"] == 2
    assert daniel_payload["households"] == [
        {"id": smith.id, "name": "Smith"},
        {"id": jones.id, "name": "Jones"},
    ]
