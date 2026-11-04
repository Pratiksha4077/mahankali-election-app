from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.config.config import settings
from app.auth.security import verify_password, create_access_token, get_current_user, AuthUser, log_activity
from app.services.supabase_service import SupabaseUserService

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginPayload(BaseModel):
    username: str
    password: str

@router.post("/login")
async def login(payload: LoginPayload):
    username = payload.username.strip()

    # Search in Supabase public.users by username or mobile_number
    user = SupabaseUserService.get_user_by_username_or_mobile(username)

    if not user or not verify_password(payload.password, user.get("hashedPassword", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/mobile number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    account_status = user.get("accountStatus", "ACTIVE")
    is_active = user.get("is_active", True)

    if account_status == "DISABLED" or is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ॲडमिनने आपला प्रवेश नाकारला आहे. आपण युझर पॅनेलमध्ये लॉग इन करू शकत नाही. (Access Denied: The administrator has denied your access to the User Panel.)"
        )

    user_id = str(user.get("id", ""))

    # Update last_login in Supabase
    try:
        SupabaseUserService.update_last_login(user_id)
    except Exception:
        pass

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        data={"sub": user["username"], "role": user["role"], "user_id": user_id},
        expires_delta=access_token_expires
    )

    log_activity(
        user_id=user_id,
        action="LOGIN",
        details=f"User {user['username']} logged in",
        username=user["username"]
    )

    user_info = {
        "id": user_id,
        "_id": user_id,
        "username": user["username"],
        "fullName": user.get("fullName", user["username"]),
        "mobile": user.get("mobileNumber", ""),
        "mobileNumber": user.get("mobileNumber", ""),
        "role": user["role"],
        "accountStatus": user.get("accountStatus", "ACTIVE"),
        "is_active": user.get("accountStatus", "ACTIVE") == "ACTIVE",
        "assignedVillages": user.get("assignedVillages", ["11111111-1111-1111-1111-111111111111"]),
        "permissions_granted": user.get("permissions_granted", False)
    }

    return {
        "success": True,
        "access_token": token,
        "accessToken": token,
        "token_type": "bearer",
        "user": user_info
    }

@router.get("/me")
async def get_me(current_user: AuthUser = Depends(get_current_user)):
    return {
        "success": True,
        "data": current_user.to_dict()
    }

@router.post("/logout")
async def logout(current_user: AuthUser = Depends(get_current_user)):
    log_activity(
        user_id=current_user.id,
        action="LOGOUT",
        details=f"User {current_user.username} logged out",
        username=current_user.username
    )
    return {
        "success": True,
        "message": "Logged out successfully"
    }
