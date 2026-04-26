"""
Rate limiting helpers for authentication endpoints beyond login.
"""

import time
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class AttemptRecord:
    count: int = 0
    first_attempt: float = 0.0
    last_attempt: float = 0.0
    locked_until: Optional[float] = None


@dataclass
class RateLimitResult:
    allowed: bool
    retry_after: Optional[int] = None
    message: Optional[str] = None


class AuthActionRateLimiter:
    def __init__(
        self,
        action_label: str,
        ip_max_attempts: int,
        ip_window_ms: int,
        ip_lockout_ms: int,
        identifier_max_attempts: int,
        identifier_window_ms: int,
        identifier_lockout_ms: int,
    ):
        self._by_ip: Dict[str, AttemptRecord] = {}
        self._by_identifier: Dict[str, AttemptRecord] = {}
        self._action_label = action_label
        self._ip_max_attempts = ip_max_attempts
        self._ip_window_ms = ip_window_ms
        self._ip_lockout_ms = ip_lockout_ms
        self._identifier_max_attempts = identifier_max_attempts
        self._identifier_window_ms = identifier_window_ms
        self._identifier_lockout_ms = identifier_lockout_ms

    def _cleanup_store(self):
        now = time.time() * 1000
        expired_ips = []
        for ip, record in self._by_ip.items():
            window_expired = now - record.last_attempt > self._ip_window_ms
            lockout_expired = not record.locked_until or now > record.locked_until
            if window_expired and lockout_expired:
                expired_ips.append(ip)
        for ip in expired_ips:
            del self._by_ip[ip]

        expired_identifiers = []
        for identifier, record in self._by_identifier.items():
            window_expired = now - record.last_attempt > self._identifier_window_ms
            lockout_expired = not record.locked_until or now > record.locked_until
            if window_expired and lockout_expired:
                expired_identifiers.append(identifier)
        for identifier in expired_identifiers:
            del self._by_identifier[identifier]

    def check_rate_limit(self, ip: str, identifier: Optional[str] = None) -> RateLimitResult:
        self._cleanup_store()
        now = time.time() * 1000

        ip_record = self._by_ip.get(ip)
        if ip_record:
            if ip_record.locked_until and now < ip_record.locked_until:
                retry_after = int((ip_record.locked_until - now) / 1000)
                minutes = max(1, retry_after // 60)
                return RateLimitResult(
                    allowed=False,
                    retry_after=retry_after,
                    message=f"Too many {self._action_label} attempts from this IP. Try again in {minutes} minutes.",
                )
            if (now - ip_record.first_attempt < self._ip_window_ms and
                ip_record.count >= self._ip_max_attempts):
                retry_after = int((ip_record.first_attempt + self._ip_window_ms - now) / 1000)
                minutes = max(1, retry_after // 60)
                return RateLimitResult(
                    allowed=False,
                    retry_after=retry_after,
                    message=f"Too many {self._action_label} attempts. Try again in {minutes} minutes.",
                )

        if identifier:
            identifier_key = identifier.lower()
            identifier_record = self._by_identifier.get(identifier_key)
            if identifier_record:
                if identifier_record.locked_until and now < identifier_record.locked_until:
                    retry_after = int((identifier_record.locked_until - now) / 1000)
                    minutes = max(1, retry_after // 60)
                    return RateLimitResult(
                        allowed=False,
                        retry_after=retry_after,
                        message=f"Too many {self._action_label} attempts for this account. Try again in {minutes} minutes.",
                    )
                if (now - identifier_record.first_attempt < self._identifier_window_ms and
                    identifier_record.count >= self._identifier_max_attempts):
                    retry_after = int((identifier_record.first_attempt + self._identifier_window_ms - now) / 1000)
                    minutes = max(1, retry_after // 60)
                    return RateLimitResult(
                        allowed=False,
                        retry_after=retry_after,
                        message=f"Too many {self._action_label} attempts for this account. Try again in {minutes} minutes.",
                    )

        return RateLimitResult(allowed=True)

    def _record(self, record: AttemptRecord, now: float, window_ms: int, max_attempts: int, lockout_ms: int):
        if not record.first_attempt or now - record.first_attempt > window_ms:
            record.count = 0
            record.first_attempt = now
            record.locked_until = None
        record.count += 1
        record.last_attempt = now
        if record.count >= max_attempts and now - record.first_attempt < window_ms:
            record.locked_until = now + lockout_ms

    def record_attempt(self, ip: str, identifier: Optional[str] = None):
        now = time.time() * 1000
        ip_record = self._by_ip.setdefault(ip, AttemptRecord())
        self._record(ip_record, now, self._ip_window_ms, self._ip_max_attempts, self._ip_lockout_ms)

        if identifier:
            identifier_key = identifier.lower()
            identifier_record = self._by_identifier.setdefault(identifier_key, AttemptRecord())
            self._record(
                identifier_record,
                now,
                self._identifier_window_ms,
                self._identifier_max_attempts,
                self._identifier_lockout_ms,
            )


REGISTER_RATE_LIMIT_CONFIG = {
    "IP_MAX_ATTEMPTS": 5,
    "IP_WINDOW_MS": 15 * 60 * 1000,
    "IP_LOCKOUT_MS": 15 * 60 * 1000,
    "IDENTIFIER_MAX_ATTEMPTS": 3,
    "IDENTIFIER_WINDOW_MS": 15 * 60 * 1000,
    "IDENTIFIER_LOCKOUT_MS": 15 * 60 * 1000,
}

PASSWORD_RESET_RATE_LIMIT_CONFIG = {
    "IP_MAX_ATTEMPTS": 6,
    "IP_WINDOW_MS": 15 * 60 * 1000,
    "IP_LOCKOUT_MS": 10 * 60 * 1000,
    "IDENTIFIER_MAX_ATTEMPTS": 4,
    "IDENTIFIER_WINDOW_MS": 15 * 60 * 1000,
    "IDENTIFIER_LOCKOUT_MS": 10 * 60 * 1000,
}

register_rate_limiter = AuthActionRateLimiter(
    action_label="registration",
    ip_max_attempts=REGISTER_RATE_LIMIT_CONFIG["IP_MAX_ATTEMPTS"],
    ip_window_ms=REGISTER_RATE_LIMIT_CONFIG["IP_WINDOW_MS"],
    ip_lockout_ms=REGISTER_RATE_LIMIT_CONFIG["IP_LOCKOUT_MS"],
    identifier_max_attempts=REGISTER_RATE_LIMIT_CONFIG["IDENTIFIER_MAX_ATTEMPTS"],
    identifier_window_ms=REGISTER_RATE_LIMIT_CONFIG["IDENTIFIER_WINDOW_MS"],
    identifier_lockout_ms=REGISTER_RATE_LIMIT_CONFIG["IDENTIFIER_LOCKOUT_MS"],
)

password_reset_rate_limiter = AuthActionRateLimiter(
    action_label="password reset",
    ip_max_attempts=PASSWORD_RESET_RATE_LIMIT_CONFIG["IP_MAX_ATTEMPTS"],
    ip_window_ms=PASSWORD_RESET_RATE_LIMIT_CONFIG["IP_WINDOW_MS"],
    ip_lockout_ms=PASSWORD_RESET_RATE_LIMIT_CONFIG["IP_LOCKOUT_MS"],
    identifier_max_attempts=PASSWORD_RESET_RATE_LIMIT_CONFIG["IDENTIFIER_MAX_ATTEMPTS"],
    identifier_window_ms=PASSWORD_RESET_RATE_LIMIT_CONFIG["IDENTIFIER_WINDOW_MS"],
    identifier_lockout_ms=PASSWORD_RESET_RATE_LIMIT_CONFIG["IDENTIFIER_LOCKOUT_MS"],
)
