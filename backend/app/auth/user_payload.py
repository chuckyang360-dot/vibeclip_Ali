from __future__ import annotations

from typing import Any

from ..models import User


def _iso(dt: Any) -> str | None:
    if dt is None:
        return None
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)


def public_user_dict(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "username": user.username,
        "google_id": user.google_id,
        "picture": None,
        "is_active": user.is_active,
        "role": getattr(user, "role", None) or "user",
        "status": getattr(user, "account_status", None) or "normal",
        "subscription_status": getattr(user, "subscription_status", None) or "inactive",
        "subscription_plan": getattr(user, "subscription_plan", None),
        "subscription_period": getattr(user, "subscription_period", None),
        "subscription_started_at": _iso(getattr(user, "subscription_started_at", None)),
        "subscription_current_period_end": _iso(getattr(user, "subscription_current_period_end", None)),
        "created_at": user.created_at,
    }
