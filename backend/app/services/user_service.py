from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.models import User, AuditLog
from app.schemas.schemas import UserCreate, UserUpdate
from app.auth.security import get_password_hash, log_activity

class UserService:

    @staticmethod
    def get_users(db: Session, is_active: Optional[bool] = None) -> List[User]:
        q = db.query(User)
        if is_active is not None:
            q = q.filter(User.is_active == is_active)
        return q.order_by(User.created_at.desc()).all()

    @staticmethod
    def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        return db.query(User).filter(User.username == username).first()

    @staticmethod
    def create_user(db: Session, user_in: UserCreate, current_admin_id: str = None) -> User:
        user = User(
            username=user_in.username,
            mobile=user_in.mobile,
            hashed_password=get_password_hash(user_in.password),
            role=user_in.role,
            is_active=user_in.is_active,
            created_at=datetime.utcnow(),
            last_activity=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        log_activity(
            db=db,
            user_id=current_admin_id,
            action="CREATE_USER",
            entity_type="USER",
            entity_id=user.id,
            details=f"Created user {user.username} with role {user.role}"
        )

        return user

    @staticmethod
    def update_user(db: Session, user_id: str, user_in: UserUpdate, current_admin_id: str = None) -> Optional[User]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return None

        old_vals = {"username": user.username, "mobile": user.mobile, "role": user.role, "is_active": user.is_active}

        if user_in.username is not None:
            user.username = user_in.username
        if user_in.mobile is not None:
            user.mobile = user_in.mobile
        if user_in.role is not None:
            user.role = user_in.role
        if user_in.is_active is not None:
            user.is_active = user_in.is_active
        if user_in.password:
            user.hashed_password = get_password_hash(user_in.password)

        db.commit()
        db.refresh(user)

        log_activity(
            db=db,
            user_id=current_admin_id,
            action="UPDATE_USER",
            entity_type="USER",
            entity_id=user.id,
            details=f"Updated user {user.username}",
            old_values=old_vals,
            new_values={"username": user.username, "mobile": user.mobile, "role": user.role, "is_active": user.is_active}
        )

        return user

    @staticmethod
    def delete_user(db: Session, user_id: str, current_admin_id: str = None) -> bool:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False

        username = user.username
        db.delete(user)
        db.commit()

        log_activity(
            db=db,
            user_id=current_admin_id,
            action="DELETE_USER",
            entity_type="USER",
            entity_id=user_id,
            details=f"Deleted user {username}"
        )

        return True

    @staticmethod
    def get_user_activity(db: Session, user_id: Optional[str] = None, limit: int = 100) -> List[AuditLog]:
        q = db.query(AuditLog)
        if user_id:
            q = q.filter(AuditLog.user_id == user_id)
        return q.order_by(AuditLog.timestamp.desc()).limit(limit).all()
