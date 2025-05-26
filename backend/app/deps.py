from fastapi import Header, HTTPException, status
from typing import Optional
from sqlalchemy.orm import Session
from .database import SessionLocal
import re

async def validate_user_agent(user_agent: str = Header(...)):
    """Validate User-Agent header to prevent basic scraping."""
    if not user_agent or len(user_agent) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User-Agent header is required"
        )
    return user_agent

def get_db():
    """Database dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def validate_password_strength(password: str) -> bool:
    """Validate password strength."""
    if len(password) < 8:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"\d", password):
        return False
    return True
