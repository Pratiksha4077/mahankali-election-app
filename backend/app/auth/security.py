import hashlib
import bcrypt
import jwt
import threading
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.config.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


# ============================================================
# PASSWORD HASHING
# ============================================================

def get_password_hash(password: str) -> str:
    try:
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
    except Exception:
        salt_fallback = "salt-election-app-2026"
        return hashlib.sha256((password + salt_fallback).encode()).hexdigest()


def hash_password(password: str) -> str:
    return get_password_hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        salt_fallback = "salt-election-app-2026"
        return (
            hashlib.sha256((plain_password + salt_fallback).encode()).hexdigest()
            == hashed_password
        )


# ============================================================
# JWT TOKEN
# ============================================================

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


# ============================================================
# AUTH USER MODEL
# ============================================================

class AuthUser:
    def __init__(self, doc: dict):
        self.id = str(doc.get("_id", doc.get("id", "")))
        self.username = doc.get("username", "")
        self.fullName = doc.get("fullName", self.username)
        self.mobileNumber = doc.get("mobileNumber", "")
        self.role = doc.get("role", "USER")
        self.accountStatus = doc.get("accountStatus", "ACTIVE")
        self.assignedVillages = doc.get("assignedVillages", ["11111111-1111-1111-1111-111111111111"])
        self.is_active = (self.accountStatus == "ACTIVE")
        self.permissions_granted = doc.get("permissions_granted", False)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "fullName": self.fullName,
            "mobileNumber": self.mobileNumber,
            "mobile": self.mobileNumber,
            "role": self.role,
            "accountStatus": self.accountStatus,
            "is_active": self.is_active,
            "assignedVillages": self.assignedVillages,
            "permissions_granted": self.permissions_granted,
        }


# ============================================================
# CURRENT USER DEPENDENCY (PURE SUPABASE POSTGRESQL)
# ============================================================

async def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> AuthUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    from app.services.supabase_service import SupabaseUserService
    user_doc = SupabaseUserService.get_user_by_username_or_mobile(username)

    if user_doc is None:
        raise credentials_exception

    user = AuthUser(user_doc)
    account_status = user_doc.get("accountStatus", "ACTIVE")
    if not user.is_active or account_status == "DISABLED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ॲडमिनने आपला प्रवेश नाकारला आहे. आपण युझर पॅनेलमध्ये प्रवेश करू शकत नाही. (Access Denied: The administrator has denied your access to the User Panel.)"
        )

    # Update lastActivity in Supabase (non-blocking in background daemon thread)
    try:
        threading.Thread(
            target=SupabaseUserService.update_last_activity,
            args=(username,),
            daemon=True
        ).start()
    except Exception:
        pass

    return user


# ============================================================
# ROLE GUARDS
# ============================================================

def require_admin(
    current_user: AuthUser = Depends(get_current_user),
) -> AuthUser:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


# ============================================================
# ACTIVITY LOGGING (PURE SUPABASE POSTGRESQL - ASYNC NON-BLOCKING)
# ============================================================

def _run_log_async(user_id, username, action, details, entity_type, entity_id, meta):
    try:
        from app.services.supabase_service import SupabaseActivityService
        SupabaseActivityService.log_activity_sync(
            user_id=user_id,
            username=username or "system",
            action=action,
            details=details or "",
            entity_type=entity_type,
            entity_id=entity_id,
            metadata=meta
        )
    except Exception:
        pass


def log_activity(
    db_or_none=None,
    user_id: Optional[str] = None,
    action: str = "ACTION",
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    details: Optional[str] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    ip_address: Optional[str] = None,
    username: Optional[str] = None,
):
    """Logs activity asynchronously without blocking the calling HTTP request."""
    try:
        meta = {}
        if old_values:
            meta["old_values"] = old_values
        if new_values:
            meta["new_values"] = new_values
        if ip_address:
            meta["ip_address"] = ip_address

        threading.Thread(
            target=_run_log_async,
            args=(user_id, username, action, details, entity_type, entity_id, meta),
            daemon=True
        ).start()
    except Exception:
        pass
