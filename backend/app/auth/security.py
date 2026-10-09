import hashlib
import bcrypt
import jwt
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
        self.assignedVillages = doc.get("assignedVillages", [])
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
# CURRENT USER DEPENDENCY
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

    # Import inside function to avoid circular imports
    from app.database.mongodb import get_mongo_db
    mongo_db = get_mongo_db()

    user_doc = await mongo_db.users.find_one({"username": username})

    if user_doc is None:
        # Fallback to SQLite
        try:
            from app.config.database import SessionLocal
            from app.models.models import User
            with SessionLocal() as s_db:
                s_user = s_db.query(User).filter(
                    User.username == username
                ).first()
                if s_user:
                    user_doc = {
                        "_id": s_user.id,
                        "username": s_user.username,
                        "fullName": s_user.username,
                        "mobileNumber": s_user.mobile,
                        "hashedPassword": s_user.hashed_password,
                        "role": s_user.role,
                        "accountStatus": (
                            "ACTIVE" if s_user.is_active else "DISABLED"
                        ),
                    }
        except Exception:
            pass

    if user_doc is None:
        raise credentials_exception

    user = AuthUser(user_doc)
    account_status = user_doc.get("accountStatus", "ACTIVE")
    if not user.is_active or account_status == "DISABLED" or user_doc.get("admin_access_allowed") is False or user_doc.get("admin_access_denied") is True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ॲडमिनने आपला प्रवेश नाकारला आहे. आपण युझर पॅनेलमध्ये प्रवेश करू शकत नाही. (Access Denied: The administrator has denied your access to the User Panel.)"
        )

    # Update lastActivity (non-blocking)
    try:
        await mongo_db.users.update_one(
            {"username": username},
            {"$set": {"lastActivity": datetime.utcnow()}}
        )
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
# ACTIVITY LOGGING
# ============================================================

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
    """Logs activity to MongoDB audit_logs & app_activities."""
    now = datetime.utcnow()

    try:
        from app.database.mongodb import get_sync_mongo_db
        s_mongo = get_sync_mongo_db()
        s_mongo.audit_logs.insert_one({
            "userId": user_id,
            "username": username,
            "action": action,
            "entityType": entity_type,
            "entityId": entity_id,
            "details": details,
            "oldValues": old_values,
            "newValues": new_values,
            "ipAddress": ip_address,
            "timestamp": now,
        })

        if action in [
            "LOGIN", "LOGOUT", "SEARCH", "VIEW_MEMBER",
            "UPDATE_MEMBER", "CALL_INITIATED", "SMS_INITIATED",
            "WHATSAPP_OPENED"
        ]:
            s_mongo.app_activities.insert_one({
                "userId": user_id,
                "username": username,
                "action": action,
                "targetMemberId": (
                    entity_id if entity_type == "MEMBER" else None
                ),
                "details": details or "",
                "metadata": {"ipAddress": ip_address} if ip_address else {},
                "timestamp": now,
            })
    except Exception:
        pass

    # Optional SQLite fallback
    if db_or_none is not None:
        try:
            from sqlalchemy.orm import Session
            from app.models.models import AuditLog
            if isinstance(db_or_none, Session):
                audit = AuditLog(
                    user_id=user_id,
                    action=action,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    details=details,
                    old_values=old_values,
                    new_values=new_values,
                    ip_address=ip_address,
                    timestamp=now,
                )
                db_or_none.add(audit)
                db_or_none.commit()
        except Exception:
            pass