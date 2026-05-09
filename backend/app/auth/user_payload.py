from __future__ import annotations

from typing import Any

from ..models import User


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
        "created_at": user.created_at,
    }
