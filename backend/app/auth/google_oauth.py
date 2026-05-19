import secrets

from fastapi import HTTPException, status
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlalchemy.orm import Session

from ..models import User
from ..config import settings
from .jwt_handler import create_access_token
from .user_payload import public_user_dict


async def verify_google_token(id_token_str: str) -> dict:
    """Verify Google ID token and return user info"""
    try:
        idinfo = id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )

        user_info = {
            "google_id": idinfo.get("sub"),
            "email": idinfo.get("email"),
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
        }

        return user_info
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )


async def authenticate_or_create_user(user_info: dict, db: Session) -> User:
    """Authenticate existing user or create new one"""
    user = db.query(User).filter(User.google_id == user_info["google_id"]).first()

    if not user:
        user = db.query(User).filter(User.email == user_info["email"]).first()
        if user:
            user.google_id = user_info["google_id"]
            user.name = user_info["name"] or user.name
        else:
            email = user_info["email"]
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Google account email is required",
                )
            base_username = email.split("@")[0]
            username = base_username
            counter = 1
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}_{counter}"
                counter += 1

            user = User(
                username=username,
                google_id=user_info["google_id"],
                email=email,
                name=user_info["name"] or base_username,
            )
            user.set_password(secrets.token_urlsafe(32))
            db.add(user)
            db.flush()
            from ..services.credit_service import grant_free_starter_credits_if_needed

            grant_free_starter_credits_if_needed(db, user.id)

        db.commit()
        db.refresh(user)

    return user


async def login_with_google(id_token_str: str, db: Session) -> dict:
    """Login user with Google OAuth token"""
    user_info = await verify_google_token(id_token_str)
    user = await authenticate_or_create_user(user_info, db)
    acct_status = getattr(user, "account_status", None) or "normal"
    if acct_status == "disabled" or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled",
        )
    access_token = create_access_token(data={"sub": user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": public_user_dict(user),
    }
