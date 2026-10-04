from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.models import User
from app.schemas.schemas import UserResponse, UserCreate, UserUpdate, AuditLogResponse
from app.auth.security import require_admin, log_activity
from app.services.user_service import UserService

router = APIRouter(prefix="/admin/users", tags=["Admin User Management"])

@router.get("", response_model=List[UserResponse])
def get_users(
    is_active: Optional[bool] = Query(None, description="Filter for ALL or DISABLED users"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    return UserService.get_users(db, is_active=is_active)

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    existing = UserService.get_user_by_username(db, user_in.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    return UserService.create_user(db, user_in, current_admin_id=admin.id)

@router.get("/{user_id}", response_model=UserResponse)
def get_user_detail(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    user = UserService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    user = UserService.update_user(db, user_id, user_in, current_admin_id=admin.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.patch("/{user_id}/status", response_model=UserResponse)
def toggle_user_status(
    user_id: str,
    is_active: bool,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    user = UserService.update_user(db, user_id, UserUpdate(is_active=is_active), current_admin_id=admin.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    success = UserService.delete_user(db, user_id, current_admin_id=admin.id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User successfully deleted"}

@router.get("/{user_id}/activity", response_model=List[AuditLogResponse])
def get_user_activity(
    user_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    return UserService.get_user_activity(db, user_id=user_id, limit=limit)
