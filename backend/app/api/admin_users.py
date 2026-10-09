from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.auth.security import require_admin, get_current_user, AuthUser, log_activity
from app.services.mongo_user_service import MongoUserService

router = APIRouter(prefix="/admin/users", tags=["Admin User Management"])

class UserCreateRequest(BaseModel):
    fullName: str
    username: str
    mobileNumber: str
    password: str
    role: str = "USER"
    accountStatus: str = "ACTIVE"
    assignedVillages: Optional[List[str]] = []

class UserUpdateRequest(BaseModel):
    fullName: Optional[str] = None
    mobileNumber: Optional[str] = None
    role: Optional[str] = None
    assignedVillages: Optional[List[str]] = None
    password: Optional[str] = None

class UserStatusRequest(BaseModel):
    status: str  # ACTIVE or DISABLED

class UserPermissionsRequest(BaseModel):
    permissions_granted: Optional[bool] = True
    permissions: Optional[dict] = None

@router.get("")
async def list_users(
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    admin: AuthUser = Depends(require_admin)
):
    """List application users for admin with status filter and search."""
    data = await MongoUserService.get_users(status=status, search_query=q, page=page, limit=limit)
    return {"success": True, "data": data}

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreateRequest,
    admin: AuthUser = Depends(require_admin)
):
    """Admin creates a new application user."""
    try:
        user = await MongoUserService.create_user(
            full_name=payload.fullName,
            username=payload.username,
            mobile_number=payload.mobileNumber,
            password=payload.password,
            role=payload.role,
            account_status=payload.accountStatus,
            assigned_villages=payload.assignedVillages,
            created_by=admin.username
        )
        log_activity(
            user_id=admin.id,
            action="CREATE_USER",
            entity_type="USER",
            entity_id=user["id"],
            details=f"Created user {payload.username} with role {payload.role}",
            username=admin.username
        )
        return {"success": True, "message": "User created successfully", "data": user}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{user_id}")
async def get_user_detail(
    user_id: str,
    admin: AuthUser = Depends(require_admin)
):
    """Get single user profile and metadata."""
    user = await MongoUserService.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "data": user}

@router.put("/{user_id}")
async def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    admin: AuthUser = Depends(require_admin)
):
    """Update user details."""
    updated = await MongoUserService.update_user(
        user_id=user_id,
        full_name=payload.fullName,
        mobile_number=payload.mobileNumber,
        role=payload.role,
        assigned_villages=payload.assignedVillages,
        password=payload.password
    )
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    
    log_activity(
        user_id=admin.id,
        action="UPDATE_USER",
        entity_type="USER",
        entity_id=user_id,
        details=f"Updated user {user_id}",
        username=admin.username
    )
    return {"success": True, "message": "User updated successfully", "data": updated}

@router.patch("/{user_id}/status")
async def set_user_status(
    user_id: str,
    payload: UserStatusRequest,
    admin: AuthUser = Depends(require_admin)
):
    """Enable or disable user account."""
    res = await MongoUserService.set_user_status(user_id, payload.status)
    if not res:
        raise HTTPException(status_code=404, detail="User not found")
    
    log_activity(
        user_id=admin.id,
        action="CHANGE_USER_STATUS",
        entity_type="USER",
        entity_id=user_id,
        details=f"Set user {user_id} status to {payload.status}",
        username=admin.username
    )
    return {"success": True, "message": f"User status changed to {payload.status}", "data": res}

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    admin: AuthUser = Depends(require_admin)
):
    """Deactivate or delete user."""
    success = await MongoUserService.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    
    log_activity(
        user_id=admin.id,
        action="DELETE_USER",
        entity_type="USER",
        entity_id=user_id,
        details=f"Deleted user {user_id}",
        username=admin.username
    )
    return {"success": True, "message": "User deleted successfully"}

class UserAccessRequest(BaseModel):
    access_allowed: bool
    reason: Optional[str] = None

@router.patch("/{user_id}/access")
async def set_user_access_route(
    user_id: str,
    payload: UserAccessRequest,
    admin: AuthUser = Depends(require_admin)
):
    """Admin grants or denies/revokes user panel access for a user based on real-time history."""
    res = await MongoUserService.set_user_access(user_id, payload.access_allowed)
    if not res:
        raise HTTPException(status_code=404, detail="User not found")

    action = "ADMIN_ALLOWED_USER_ACCESS" if payload.access_allowed else "ADMIN_DENIED_USER_ACCESS"
    log_activity(
        user_id=admin.id,
        action=action,
        entity_type="USER",
        entity_id=user_id,
        details=f"Admin {'allowed' if payload.access_allowed else 'denied'} User Panel access for {user_id}. Reason: {payload.reason or 'Admin discretion'}",
        username=admin.username
    )
    return {
        "success": True,
        "message": f"User panel access {'allowed' if payload.access_allowed else 'denied'}",
        "data": res
    }

@router.patch("/{user_id}/permissions")
async def set_user_permissions_route(
    user_id: str,
    payload: UserPermissionsRequest,
    admin: AuthUser = Depends(require_admin)
):
    """Admin cannot grant device permissions remotely; device permissions must be granted on device."""
    is_granted = payload.permissions_granted if payload.permissions_granted is not None else False
    if is_granted or (payload.permissions and any(bool(v) for v in payload.permissions.values())):
        raise HTTPException(
            status_code=400,
            detail="ॲडमिनद्वारे डिव्हाइस परवानग्या दूरस्थपणे मंजूर केल्या जाऊ शकत नाहीत. वापरकर्त्याने स्वतःच्या डिव्हाइसवर परवानग्या देणे आवश्यक आहे. (Device permissions cannot be granted remotely by Admin. Permissions must be granted on the user's device.)"
        )

    res = await MongoUserService.set_user_permissions(user_id, False, permissions_detail=payload.permissions)
    if not res:
        raise HTTPException(status_code=404, detail="User not found")

    log_activity(
        user_id=admin.id,
        action="UPDATE_USER_PERMISSIONS",
        entity_type="USER",
        entity_id=user_id,
        details=f"Admin revoked user {user_id} device permissions",
        username=admin.username
    )
    return {"success": True, "message": "Permissions revoked", "data": res}

@router.post("/self-permissions")
async def set_self_permissions(
    payload: UserPermissionsRequest,
    user: AuthUser = Depends(get_current_user)
):
    """User grants or denies phone, SMS, and location permissions on their own account."""
    perms_dict = payload.permissions or {}
    is_granted = payload.permissions_granted if payload.permissions_granted is not None else any(bool(v) for v in perms_dict.values())
    res = await MongoUserService.set_user_permissions(user.id, is_granted, permissions_detail=perms_dict)
    
    perm_desc = ", ".join([f"{k}: {'Granted' if v else 'Denied'}" for k, v in perms_dict.items()]) if perms_dict else ("Granted" if is_granted else "Denied")
    log_activity(
        user_id=user.id,
        action="PERMISSION_UPDATE",
        entity_type="USER",
        entity_id=user.id,
        details=f"User {user.username} updated permissions: {perm_desc}",
        username=user.username
    )
    return {"success": True, "message": "Permission status saved", "data": res}

class LogActivityRequest(BaseModel):
    action: str
    userId: Optional[str] = None
    user_id: Optional[str] = None
    username: Optional[str] = None
    targetMemberId: Optional[str] = None
    targetMemberName: Optional[str] = None
    details: Optional[str] = ""
    metadata: Optional[dict] = None

@router.post("/activity")
async def log_activity_route(
    payload: LogActivityRequest,
    request: Request = None
):
    """
    Log an in-app user action (CALL_INITIATED, SMS_INITIATED, LOCATION_CHECKIN, etc.).
    Uses explicit payload IDs, Authorization Bearer token, X-User-ID/X-Username headers, or metadata.
    """
    meta = payload.metadata or {}
    user_id = payload.userId or payload.user_id or meta.get("user_id") or "u-unknown"
    username = payload.username or meta.get("username") or "field_worker"

    if request:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                import jwt
                from app.config.config import settings
                token = auth_header.split(" ")[1]
                tdata = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
                user_id = str(tdata.get("user_id") or user_id)
                username = str(tdata.get("sub") or tdata.get("username") or username)
            except Exception:
                pass
        if request.headers.get("X-User-ID"):
            user_id = request.headers.get("X-User-ID")
        if request.headers.get("X-Username"):
            username = request.headers.get("X-Username")

    meta["user_id"] = user_id
    meta["username"] = username

    act = await MongoUserService.log_activity(
        user_id=user_id,
        username=username,
        action=payload.action,
        details=payload.details,
        target_member_id=payload.targetMemberId,
        target_member_name=payload.targetMemberName,
        metadata=meta
    )
    return {"success": True, "data": act}

class TelephonySyncPayload(BaseModel):
    callStatus: str = "UNKNOWN"
    smsStatus: str = "UNKNOWN"
    calls: List[Dict[str, Any]] = []
    sms: List[Dict[str, Any]] = []
    metadata: Optional[Dict[str, Any]] = None

@router.post("/activity/telephony-sync")
async def sync_telephony_route(
    payload: TelephonySyncPayload,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Synchronize permitted device Call Logs and SMS metadata from authenticated user.
    Uses JWT authentication to ensure user identity is untampered.
    """
    res = await MongoUserService.sync_telephony_activity(
        user_id=current_user.id,
        username=current_user.username,
        call_status=payload.callStatus,
        sms_status=payload.smsStatus,
        calls=payload.calls,
        sms=payload.sms,
        metadata=payload.metadata
    )
    return {"success": True, "message": "Telephony sync completed", "data": res}

@router.get("/{user_id}/activity")
async def get_user_activity(
    user_id: str,
    limit: int = Query(200, ge=1, le=500),
    admin: AuthUser = Depends(require_admin)
):
    """
    Retrieve categorized in-app activity timeline for a user (Call History, SMS History,
    Location History, and Application Events).
    """
    data = await MongoUserService.get_user_activity(user_id, limit=limit)
    return {"success": True, "data": data}

class BatchDeleteActivitiesRequest(BaseModel):
    activity_ids: Optional[List[str]] = None
    action_type: Optional[str] = None
    delete_all: Optional[bool] = False

@router.delete("/{user_id}/activity/{activity_id}")
async def delete_single_activity(
    user_id: str,
    activity_id: str,
    admin: AuthUser = Depends(require_admin)
):
    """Admin deletes a single user activity record (Call, SMS, or Location check-in)."""
    success = await MongoUserService.delete_activity(activity_id)
    if not success:
        raise HTTPException(status_code=404, detail="Activity record not found")
    return {"success": True, "message": "Activity record deleted successfully"}

@router.delete("/{user_id}/activity")
async def delete_activities_batch(
    user_id: str,
    payload: Optional[BatchDeleteActivitiesRequest] = None,
    action_type: Optional[str] = Query(None),
    delete_all: Optional[bool] = Query(False),
    admin: AuthUser = Depends(require_admin)
):
    """Admin deletes multiple activity records by IDs, or clears all activity for a user."""
    p_ids = payload.activity_ids if payload and payload.activity_ids else []
    p_all = (payload and payload.delete_all) or delete_all
    p_type = (payload and payload.action_type) or action_type

    if p_ids:
        count = await MongoUserService.delete_activities(p_ids)
        return {"success": True, "message": f"{count} activities deleted", "deleted_count": count}
    elif p_all or p_type:
        count = await MongoUserService.clear_user_activities(user_id, action_type=p_type)
        return {"success": True, "message": f"{count} activities cleared", "deleted_count": count}
    else:
        raise HTTPException(status_code=400, detail="Provide activity_ids or delete_all=true")

