from fastapi import Header, HTTPException, status, Request
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

def get_client_ip(request: Request) -> str:
    """
    Extract client IP from request headers.
    Prefers trusted proxy headers used by Cloudflare and reverse proxies.
    """
    cf_connecting_ip = request.headers.get("CF-Connecting-IP")
    if cf_connecting_ip:
        return cf_connecting_ip.strip()

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Get the first IP in the chain (client IP)
        return forwarded_for.split(',')[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    return request.client.host if request.client else "unknown"
