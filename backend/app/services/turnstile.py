import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TURNSTILE_SECRET_KEY = os.getenv("SECRET_KEY")
# Only enforce Turnstile in production
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"


async def verify_turnstile(token: Optional[str], remote_ip: Optional[str] = None) -> bool:
    """
    Verify Cloudflare Turnstile token.

    In development (ENVIRONMENT != "production"), always returns True to allow testing.
    In production, validates the token with Cloudflare.
    """
    # Skip verification in development
    if not IS_PRODUCTION:
        logger.debug("Turnstile verification skipped (development mode)")
        return True

    # In production, require both secret key and token
    if not TURNSTILE_SECRET_KEY:
        logger.error("Turnstile secret key is not configured in production!")
        return False

    if not token:
        logger.warning("No Turnstile token provided in production")
        return False

    payload = {
        "secret": TURNSTILE_SECRET_KEY,
        "response": token,
    }
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(TURNSTILE_VERIFY_URL, data=payload)
            response.raise_for_status()
            data = response.json()
            success = bool(data.get("success"))
            if not success:
                logger.warning("Turnstile verification failed: %s", data.get("error-codes", []))
            return success
    except httpx.HTTPError as exc:
        logger.error("Turnstile verification HTTP error: %s", exc)
        return False
