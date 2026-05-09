from fastapi import Depends, HTTPException, status

from ..auth.jwt_handler import get_current_user
from ..models import User


async def require_admin_user(current_user: User = Depends(get_current_user)) -> User:
    role = getattr(current_user, "role", None) or "user"
    if role not in {"admin", "super_admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
