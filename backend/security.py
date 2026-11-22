
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from dotenv import load_dotenv
from pwdlib import PasswordHash
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import SessionLocal
from models.user import User
from models.role import Role


load_dotenv(Path(__file__).resolve().parent / ".env")

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is missing from backend/.env")

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def create_access_token(user_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=60)

    payload = {
        "sub": str(user_id),
        "exp": expires,
        "type": "access",
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")
        token_type = payload.get("type")

        if not user_id or token_type != "access":
            raise credentials_error

        user_id = int(user_id)

    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise credentials_error

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.id == user_id).first()

        if not user or not user.is_active:
            raise credentials_error

        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role_id": user.role_id,
        }

    finally:
        db.close()




def require_roles(*allowed_roles):
    def role_checker(
        current_user: dict = Depends(get_current_user)
    ):
        db = SessionLocal()

        try:
            role = db.query(Role).filter(
                Role.id == current_user["role_id"]
            ).first()

            if not role or not role.is_active:
                raise HTTPException(
                    status_code=403,
                    detail="Role is inactive or missing"
                )

            if role.name not in allowed_roles:
                raise HTTPException(
                    status_code=403,
                    detail="You do not have permission to access this resource"
                )

            return current_user

        finally:
            db.close()

    return role_checker
