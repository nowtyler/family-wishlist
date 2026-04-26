"""
Login-specific rate limiting for authentication endpoints.

This module provides in-memory rate limiting with:
- IP-based limiting (5 attempts per 15 minutes, 15-minute lockout)
- Username-based limiting (3 attempts per 15 minutes, progressive lockout)
- Webhook notifications to n8n for observability
- Privacy-preserving logging (masked IPs and usernames)

Based on the implementation from wagsandwalks project.
"""

import os
import time
import asyncio
import logging
import base64
from typing import Dict, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import httpx

logger = logging.getLogger(__name__)


class RateLimitReason(str, Enum):
    IP_RATE_LIMIT = "ip_rate_limit"
    IP_LOCKOUT = "ip_lockout"
    USERNAME_RATE_LIMIT = "username_rate_limit"
    USERNAME_LOCKOUT = "username_lockout"


class RateLimitEvent(str, Enum):
    ATTEMPT_BLOCKED = "attempt_blocked"
    LOCKOUT_APPLIED = "lockout_applied"
    ATTEMPT_RECORDED = "attempt_recorded"
    LOGIN_SUCCESS = "login_success"


# Configuration - exported for documentation and testing
LOGIN_RATE_LIMIT_CONFIG = {
    # IP-based limits
    "IP_MAX_ATTEMPTS": 5,
    "IP_WINDOW_MS": 15 * 60 * 1000,  # 15 minutes
    "IP_LOCKOUT_MS": 15 * 60 * 1000,  # 15 minute lockout after max attempts

    # Username-based limits (stricter)
    "USERNAME_MAX_ATTEMPTS": 3,
    "USERNAME_WINDOW_MS": 15 * 60 * 1000,  # 15 minutes
    "USERNAME_LOCKOUT_BASE_MS": 5 * 60 * 1000,  # 5 minute base lockout
    "USERNAME_LOCKOUT_MULTIPLIER": 2,  # Double lockout for each subsequent failure batch
    "USERNAME_MAX_LOCKOUT_MS": 60 * 60 * 1000,  # Max 1 hour lockout

    # Cleanup
    "CLEANUP_INTERVAL_MS": 5 * 60 * 1000,  # Cleanup every 5 minutes
}


@dataclass
class AttemptRecord:
    count: int = 0
    first_attempt: float = 0.0
    last_attempt: float = 0.0
    locked_until: Optional[float] = None
    lockout_count: int = 0  # Track number of lockouts for progressive penalties


@dataclass
class RateLimitResult:
    allowed: bool
    retry_after: Optional[int] = None  # seconds until retry allowed
    reason: Optional[RateLimitReason] = None
    message: Optional[str] = None


class LoginRateLimiter:
    """
    Rate limiter specifically for login attempts.

    Features:
    - Dual tracking: by IP and by username
    - Progressive lockouts for repeated failures
    - Webhook integration for observability
    - Privacy-preserving logging
    """

    def __init__(self):
        self._by_ip: Dict[str, AttemptRecord] = {}
        self._by_username: Dict[str, AttemptRecord] = {}
        self._last_cleanup: float = time.time() * 1000
        self._cleanup_task: Optional[asyncio.Task] = None
        self._http_client: Optional[httpx.AsyncClient] = None

    async def start(self):
        """Start the cleanup task and HTTP client."""
        if not self._cleanup_task:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        if not self._http_client:
            self._http_client = httpx.AsyncClient(timeout=10.0)

    async def stop(self):
        """Stop the cleanup task and HTTP client."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

    async def _cleanup_loop(self):
        """Periodic cleanup of expired entries."""
        while True:
            await asyncio.sleep(LOGIN_RATE_LIMIT_CONFIG["CLEANUP_INTERVAL_MS"] / 1000)
            self._cleanup_store()

    def _cleanup_store(self):
        """Clean up expired entries."""
        now = time.time() * 1000  # milliseconds
        config = LOGIN_RATE_LIMIT_CONFIG

        # Clean IP records
        expired_ips = []
        for ip, record in self._by_ip.items():
            window_expired = now - record.last_attempt > config["IP_WINDOW_MS"]
            lockout_expired = not record.locked_until or now > record.locked_until

            if window_expired and lockout_expired:
                expired_ips.append(ip)

        for ip in expired_ips:
            del self._by_ip[ip]

        # Clean username records
        expired_usernames = []
        for username, record in self._by_username.items():
            window_expired = now - record.last_attempt > config["USERNAME_WINDOW_MS"]
            lockout_expired = not record.locked_until or now > record.locked_until

            if window_expired and lockout_expired:
                expired_usernames.append(username)

        for username in expired_usernames:
            del self._by_username[username]

        self._last_cleanup = now

    def check_rate_limit(self, ip: str, username: Optional[str] = None) -> RateLimitResult:
        """
        Check if a login attempt should be rate limited.

        Args:
            ip: Client IP address
            username: Username being attempted (optional, but recommended)

        Returns:
            RateLimitResult indicating if the attempt is allowed
        """
        self._cleanup_store()
        now = time.time() * 1000  # milliseconds
        config = LOGIN_RATE_LIMIT_CONFIG

        # Check IP-based limits
        ip_record = self._by_ip.get(ip)
        if ip_record:
            # Check if IP is locked out
            if ip_record.locked_until and now < ip_record.locked_until:
                retry_after = int((ip_record.locked_until - now) / 1000)
                minutes = max(1, retry_after // 60)
                return RateLimitResult(
                    allowed=False,
                    retry_after=retry_after,
                    reason=RateLimitReason.IP_LOCKOUT,
                    message=f"Too many login attempts from this IP. Try again in {minutes} minutes.",
                )

            # Check if within window and exceeded attempts
            if (now - ip_record.first_attempt < config["IP_WINDOW_MS"] and
                ip_record.count >= config["IP_MAX_ATTEMPTS"]):
                retry_after = int((ip_record.first_attempt + config["IP_WINDOW_MS"] - now) / 1000)
                minutes = max(1, retry_after // 60)
                return RateLimitResult(
                    allowed=False,
                    retry_after=retry_after,
                    reason=RateLimitReason.IP_RATE_LIMIT,
                    message=f"Too many login attempts. Try again in {minutes} minutes.",
                )

        # Check username-based limits if provided
        if username:
            username_lower = username.lower()
            username_record = self._by_username.get(username_lower)
            if username_record:
                # Check if username is locked out
                if username_record.locked_until and now < username_record.locked_until:
                    retry_after = int((username_record.locked_until - now) / 1000)
                    minutes = max(1, retry_after // 60)
                    return RateLimitResult(
                        allowed=False,
                        retry_after=retry_after,
                        reason=RateLimitReason.USERNAME_LOCKOUT,
                        message=f"This account is temporarily locked. Try again in {minutes} minutes.",
                    )

                # Check if within window and exceeded attempts
                if (now - username_record.first_attempt < config["USERNAME_WINDOW_MS"] and
                    username_record.count >= config["USERNAME_MAX_ATTEMPTS"]):
                    retry_after = int((username_record.first_attempt + config["USERNAME_WINDOW_MS"] - now) / 1000)
                    minutes = max(1, retry_after // 60)
                    return RateLimitResult(
                        allowed=False,
                        retry_after=retry_after,
                        reason=RateLimitReason.USERNAME_RATE_LIMIT,
                        message=f"Too many login attempts for this account. Try again in {minutes} minutes.",
                    )

        return RateLimitResult(allowed=True)

    def record_failed_attempt(self, ip: str, username: Optional[str] = None):
        """
        Record a failed login attempt.

        Args:
            ip: Client IP address
            username: Username that was attempted (optional)
        """
        now = time.time() * 1000  # milliseconds
        config = LOGIN_RATE_LIMIT_CONFIG

        # Record IP attempt
        ip_record = self._by_ip.get(ip)
        if not ip_record:
            ip_record = AttemptRecord(
                count=1,
                first_attempt=now,
                last_attempt=now,
                lockout_count=0,
            )
            self._by_ip[ip] = ip_record
        else:
            # Reset window if expired
            if now - ip_record.first_attempt > config["IP_WINDOW_MS"]:
                ip_record.count = 1
                ip_record.first_attempt = now
                ip_record.locked_until = None
            else:
                ip_record.count += 1
            ip_record.last_attempt = now

            # Apply lockout if max attempts reached
            if ip_record.count >= config["IP_MAX_ATTEMPTS"] and not ip_record.locked_until:
                ip_record.locked_until = now + config["IP_LOCKOUT_MS"]
                ip_record.lockout_count += 1
                self._log_event(RateLimitEvent.LOCKOUT_APPLIED, ip, None, {
                    "type": "ip",
                    "locked_until_ms": ip_record.locked_until,
                    "lockout_count": ip_record.lockout_count,
                })

        # Record username attempt if provided
        if username:
            username_lower = username.lower()
            username_record = self._by_username.get(username_lower)
            if not username_record:
                username_record = AttemptRecord(
                    count=1,
                    first_attempt=now,
                    last_attempt=now,
                    lockout_count=0,
                )
                self._by_username[username_lower] = username_record
            else:
                # Reset window if expired
                if now - username_record.first_attempt > config["USERNAME_WINDOW_MS"]:
                    username_record.count = 1
                    username_record.first_attempt = now
                    # Don't reset lockout_count - progressive lockout persists
                else:
                    username_record.count += 1
                username_record.last_attempt = now

                # Apply progressive lockout if max attempts reached
                if (username_record.count >= config["USERNAME_MAX_ATTEMPTS"] and
                    username_record.count % config["USERNAME_MAX_ATTEMPTS"] == 0):
                    username_record.lockout_count += 1
                    # Calculate progressive lockout duration
                    lockout_duration = min(
                        config["USERNAME_LOCKOUT_BASE_MS"] *
                        (config["USERNAME_LOCKOUT_MULTIPLIER"] ** (username_record.lockout_count - 1)),
                        config["USERNAME_MAX_LOCKOUT_MS"]
                    )
                    username_record.locked_until = now + lockout_duration
                    self._log_event(RateLimitEvent.LOCKOUT_APPLIED, ip, username, {
                        "type": "username",
                        "locked_until_ms": username_record.locked_until,
                        "lockout_duration_ms": lockout_duration,
                        "lockout_count": username_record.lockout_count,
                    })

        self._log_event(RateLimitEvent.ATTEMPT_RECORDED, ip, username, {
            "ip_attempts": self._by_ip.get(ip, AttemptRecord()).count,
            "username_attempts": self._by_username.get(username.lower() if username else "", AttemptRecord()).count if username else None,
        })

    def record_successful_login(self, ip: str, username: Optional[str] = None):
        """
        Record a successful login - resets the counters.

        Args:
            ip: Client IP address
            username: Username that logged in successfully
        """
        # Reset IP record
        if ip in self._by_ip:
            del self._by_ip[ip]

        # Reset username record
        if username:
            username_lower = username.lower()
            if username_lower in self._by_username:
                del self._by_username[username_lower]

        # Log successful login
        self._log_event(RateLimitEvent.LOGIN_SUCCESS, ip, username)

    def _log_event(
        self,
        event: RateLimitEvent,
        ip: str,
        username: Optional[str] = None,
        details: Optional[Dict] = None,
    ):
        """Log a rate limit event and send to webhook."""
        import datetime

        timestamp = datetime.datetime.utcnow().isoformat() + "Z"
        log_entry = {
            "timestamp": timestamp,
            "event": event.value,
            "ip": ip,
            "ip_masked": self._mask_ip(ip),
            "username": username,
            "username_masked": self._mask_username(username) if username else None,
            "environment": os.environ.get("ENVIRONMENT", "development"),
            "application": "family-wishlist",
            **(details or {}),
        }

        # Log to console (with masked values for privacy)
        safe_log = {**log_entry, "ip": log_entry["ip_masked"], "username": log_entry["username_masked"]}
        logger.info(f"[LoginRateLimit] {safe_log}")

        # Send to webhook asynchronously (fire and forget)
        asyncio.create_task(self._send_to_webhook(log_entry))

    async def _send_to_webhook(self, payload: Dict):
        """Send event to n8n webhook."""
        webhook_url = self._get_webhook_url()
        if not webhook_url:
            return

        headers = {"Content-Type": "application/json"}

        # Add basic auth if configured
        auth = self._get_webhook_auth()
        if auth:
            credentials = base64.b64encode(f"{auth[0]}:{auth[1]}".encode()).decode()
            headers["Authorization"] = f"Basic {credentials}"

        try:
            if not self._http_client:
                self._http_client = httpx.AsyncClient(timeout=10.0)

            await self._http_client.post(webhook_url, json=payload, headers=headers)
        except Exception as e:
            # Don't let webhook failures affect the main flow
            logger.warning(f"[LoginRateLimit] Failed to send webhook: {e}")

    def _get_webhook_url(self) -> Optional[str]:
        """Get the appropriate webhook URL based on environment."""
        environment = os.environ.get("ENVIRONMENT", "development")
        if environment == "prod":
            return os.environ.get("RATELIMIT_WEBHOOK_URL")
        return os.environ.get("DEV_RATELIMIT_WEBHOOK_URL")

    def _get_webhook_auth(self) -> Optional[Tuple[str, str]]:
        """Get webhook basic auth credentials."""
        user = os.environ.get("WEBHOOK_AUTH_USER")
        password = os.environ.get("WEBHOOK_AUTH_PASS")
        if user and password:
            return (user, password)
        return None

    @staticmethod
    def _mask_ip(ip: str) -> str:
        """Mask IP for logging (privacy)."""
        if ip == "unknown":
            return "unknown"
        if ":" in ip:
            # IPv6 - show first 4 segments
            parts = ip.split(":")
            return ":".join(parts[:4]) + ":****"
        # IPv4 - show first 2 octets
        parts = ip.split(".")
        return ".".join(parts[:2]) + ".*.*"

    @staticmethod
    def _mask_username(username: str) -> str:
        """Mask username for logging (privacy)."""
        if len(username) <= 2:
            return "**"
        return username[0] + "*" * (len(username) - 2) + username[-1]


# Global instance
login_rate_limiter = LoginRateLimiter()
