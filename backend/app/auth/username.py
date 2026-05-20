"""Unique username allocation for registration."""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import User


def allocate_unique_username(db: Session, *, preferred: str, email: str) -> str:
    """Prefer the user-chosen display name; fall back to email local-part."""
    display = (preferred or "").strip()
    base = display or (email.split("@")[0] if email else "user")
    username = base
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base}_{counter}"
        counter += 1
    return username
