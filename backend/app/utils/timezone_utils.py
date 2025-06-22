"""
Timezone utilities for consistent EST timestamp handling across the application
"""
from datetime import datetime, date
import pytz

def get_est_timestamp() -> datetime:
    """Get current timestamp in EST timezone"""
    eastern = pytz.timezone('US/Eastern')
    return datetime.now(eastern)

def get_est_timestamp_iso() -> str:
    """Get current timestamp in EST timezone as ISO format string"""
    eastern = pytz.timezone('US/Eastern')
    return datetime.now(eastern).isoformat()

def get_est_timestamp_strftime(format_str: str = "%Y-%m-%d %H:%M:%S") -> str:
    """Get current timestamp in EST timezone as formatted string"""
    eastern = pytz.timezone('US/Eastern')
    return datetime.now(eastern).strftime(format_str)

def get_est_date() -> date:
    """Get current date in EST timezone"""
    eastern = pytz.timezone('US/Eastern')
    return datetime.now(eastern).date()

def convert_utc_to_est(utc_datetime: datetime) -> datetime:
    """Convert UTC datetime to EST timezone"""
    eastern = pytz.timezone('US/Eastern')
    if utc_datetime.tzinfo is None:
        # Assume UTC if no timezone info
        utc_datetime = utc_datetime.replace(tzinfo=pytz.UTC)
    return utc_datetime.astimezone(eastern)

def get_est_timedelta(hours: int = 0, minutes: int = 0, days: int = 0) -> datetime:
    """Get EST timestamp with timedelta applied"""
    eastern = pytz.timezone('US/Eastern')
    now = datetime.now(eastern)
    from datetime import timedelta
    return now + timedelta(hours=hours, minutes=minutes, days=days) 