from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import urllib.parse

from ..database import get_db
from ..models import User
from ..schemas import (
    GoogleAuthRequest,
    GoogleAuthUrlResponse,
    LoginRequest,
    RegisterRequest,
    Token,
)
from ..config import settings
from .google_oauth import login_with_google
from .jwt_handler import create_access_token

router = APIRouter()


@router.post("/login")
async def login_with_email(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password"""
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect"
        )

    if not user.verify_password(request.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "google_id": user.google_id,
            "picture": None,
            "is_active": user.is_active,
            "created_at": user.created_at,
        }
    }


@router.post("/register")
async def register_with_email(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register with email and password"""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Generate unique username from email prefix
    base_username = request.email.split("@")[0]
    username = base_username

    # Check if username exists, add suffix if needed
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}_{counter}"
        counter += 1

    # Create new user
    new_user = User(
        username=username,
        name=request.name,
        email=request.email,
    )
    new_user.set_password(request.password)

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration failed: {str(e)}"
        )

    access_token = create_access_token(data={"sub": new_user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "name": new_user.name,
            "google_id": new_user.google_id,
            "picture": None,
            "is_active": new_user.is_active,
            "created_at": new_user.created_at,
        }
    }


@router.get("/google")
async def google_auth():
    """Google OAuth placeholder endpoint"""
    return {
        "success": False,
        "message": "Google OAuth not configured yet"
    }


@router.post("/google/login", response_model=Token)
async def google_login(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Login with Google OAuth token"""
    try:
        result = await login_with_google(request.id_token, db)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )


@router.get("/google/auth-url", response_model=GoogleAuthUrlResponse)
async def get_google_auth_url():
    """Get Google OAuth authorization URL"""
    auth_url_params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "scope": "openid email profile",
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent",
    }

    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"&".join([f"{k}={urllib.parse.quote(str(v))}" for k, v in auth_url_params.items()])
    )

    return GoogleAuthUrlResponse(url=auth_url)