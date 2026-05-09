"""Admin statistics day boundaries.

TODO: Align with a single product-wide timezone policy if one is introduced.
Currently "today" uses Asia/Shanghai (UTC+8) start/end converted to UTC for DB filters.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

TZ_ADMIN = ZoneInfo("Asia/Shanghai")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today_range_utc_sh() -> tuple[datetime, datetime]:
    """Inclusive start, exclusive end in UTC for 'today' in UTC+8."""
    now_sh = datetime.now(TZ_ADMIN)
    start_sh = now_sh.replace(hour=0, minute=0, second=0, microsecond=0)
    end_sh = start_sh + timedelta(days=1)
    return start_sh.astimezone(timezone.utc), end_sh.astimezone(timezone.utc)


def last_n_days_dates_sh(n: int) -> list[date]:
    today_sh = datetime.now(TZ_ADMIN).date()
    return [today_sh - timedelta(days=i) for i in range(n - 1, -1, -1)]


def day_range_utc_sh(d: date) -> tuple[datetime, datetime]:
    start_sh = datetime.combine(d, datetime.min.time(), tzinfo=TZ_ADMIN)
    end_sh = start_sh + timedelta(days=1)
    return start_sh.astimezone(timezone.utc), end_sh.astimezone(timezone.utc)
