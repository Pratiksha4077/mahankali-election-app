from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.auth.security import require_admin, get_current_user, AuthUser, log_activity
from app.services.supabase_service import SupabaseUserService, SupabaseActivityService, get_supabase_conn

router = APIRouter(prefix="/admin/users", tags=["Admin User Management"])

class TelephonySyncRequest(BaseModel):
    callStatus: Optional[str] = "UNKNOWN"
    smsStatus: Optional[str] = "UNKNOWN"
    calls: Optional[List[Dict[str, Any]]] = []
    sms: Optional[List[Dict[str, Any]]] = []
    locations: Optional[List[Dict[str, Any]]] = []
    metadata: Optional[Dict[str, Any]] = None

class DeleteActivityPayload(BaseModel):
    activity_ids: Optional[List[str]] = None
    ids: Optional[List[str]] = None

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

class UserAccessRequest(BaseModel):
    access_allowed: bool
    reason: Optional[str] = None

class LogActivityRequest(BaseModel):
    action: str
    details: Optional[str] = ""
    targetMemberId: Optional[str] = None
    targetMemberName: Optional[str] = None
    metadata: Optional[dict] = None

@router.get("")
async def list_users(
    status: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    admin: AuthUser = Depends(require_admin)
):
    """List application users for admin with status filter and search from Supabase."""
    resolved_status = status
    if not resolved_status and is_active is not None:
        resolved_status = "ACTIVE" if is_active else "DISABLED"
    data = SupabaseUserService.get_users(status=resolved_status, search_query=q, page=page, limit=limit)
    return {"success": True, "data": data}

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreateRequest,
    admin: AuthUser = Depends(require_admin)
):
    """Admin creates a new application user in Supabase."""
    full_name = payload.fullName.strip() if payload.fullName else ""
    username = payload.username.strip() if payload.username else ""
    mobile = payload.mobileNumber.strip() if payload.mobileNumber else ""
    password = payload.password.strip() if payload.password else ""

    if not username:
        raise HTTPException(status_code=400, detail="वापरकर्ता नाव (Username) आवश्यक आहे.")
    if not full_name:
        full_name = username
    if not mobile or len(mobile) < 10:
        raise HTTPException(status_code=400, detail="वैध 10-अंकी मोबाईल नंबर आवश्यक आहे.")
    if not password or len(password) < 4:
        raise HTTPException(status_code=400, detail="पासवर्ड किमान 4 अक्षरे असावा.")

    try:
        user = SupabaseUserService.create_user(
            full_name=full_name,
            username=username,
            mobile_number=mobile,
            password=password,
            role=payload.role or "USER",
            account_status=payload.accountStatus or "ACTIVE",
            assigned_villages=payload.assignedVillages or [],
            created_by=admin.username
        )
        log_activity(
            user_id=admin.id,
            action="CREATE_USER",
            entity_type="USER",
            entity_id=user["id"],
            details=f"Created user {username} with role {payload.role}",
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
    """Get single user profile and metadata from Supabase."""
    user = SupabaseUserService.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "data": user}

@router.put("/{user_id}")
async def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    admin: AuthUser = Depends(require_admin)
):
    """Update user details in Supabase."""
    updated = SupabaseUserService.update_user(
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
    """Enable or disable user account in Supabase."""
    res = SupabaseUserService.set_user_status(user_id, payload.status)
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
    """Deactivate or delete user in Supabase."""
    try:
        success = SupabaseUserService.delete_user(user_id)
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
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.patch("/{user_id}/access")
async def set_user_access_route(
    user_id: str,
    payload: UserAccessRequest,
    admin: AuthUser = Depends(require_admin)
):
    """Admin grants or denies user panel access in Supabase."""
    res = SupabaseUserService.set_user_access(user_id, payload.access_allowed)
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

@router.post("/self-permissions")
async def update_self_permissions(
    payload: UserPermissionsRequest,
    current_user: AuthUser = Depends(get_current_user)
):
    """Authenticated field user syncs active device permissions (location, call, sms) into Supabase."""
    perms = payload.permissions or {}
    is_granted = payload.permissions_granted if payload.permissions_granted is not None else True

    updated = SupabaseUserService.update_user_permissions(
        user_id=current_user.id,
        permissions_granted=is_granted,
        permissions=perms
    )
    return {"success": True, "message": "Permissions synced successfully", "data": updated}

@router.patch("/{user_id}/permissions")
@router.put("/{user_id}/permissions")
async def set_user_permissions(
    user_id: str,
    payload: UserPermissionsRequest,
    admin: AuthUser = Depends(require_admin)
):
    """Admin grants or denies device permissions for a user in Supabase."""
    perms = payload.permissions or {}
    is_granted = payload.permissions_granted if payload.permissions_granted is not None else True

    updated = SupabaseUserService.update_user_permissions(
        user_id=user_id,
        permissions_granted=is_granted,
        permissions=perms
    )
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")

    log_activity(
        user_id=admin.id,
        action="UPDATE_USER_PERMISSIONS",
        entity_type="USER",
        entity_id=user_id,
        details=f"Admin set permissions_granted={is_granted} for user {user_id}",
        username=admin.username
    )
    return {"success": True, "message": "Permissions updated successfully", "data": updated}

@router.get("/{user_id}/activities")
async def get_user_activities(
    user_id: str,
    action: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    admin: AuthUser = Depends(require_admin)
):
    """Retrieve activity logs for a specific user from Supabase."""
    data = SupabaseActivityService.get_activities(
        user_id=user_id,
        action_pattern=action,
        page=page,
        limit=limit
    )
    return {"success": True, "data": data}

@router.get("/activities/all")
async def get_all_activities(
    action: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    admin: AuthUser = Depends(require_admin)
):
    """Retrieve general activity feed from Supabase."""
    data = SupabaseActivityService.get_activities(
        username=username,
        action_pattern=action,
        page=page,
        limit=limit
    )
    return {"success": True, "data": data}

# ==============================================================================
# TELEPHONY (CALLS, SMS, LOCATION) ACTIVITY SYNC & RETRIEVAL
# ==============================================================================

@router.post("/activity")
async def log_user_activity_endpoint(
    payload: LogActivityRequest,
    request: Request
):
    """Logs individual user action, real-time GPS check-in, or telephony event into Supabase."""
    user_id = None
    username = "field_worker"

    meta = payload.metadata or {}
    if meta.get("user_id"):
        user_id = str(meta["user_id"])
    if meta.get("username"):
        username = str(meta["username"])

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            import jwt
            from app.config.config import settings
            token = auth_header.split(" ")[1]
            token_data = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            user_id = str(token_data.get("user_id") or meta.get("user_id") or token_data.get("sub") or user_id or "")
            username = str(token_data.get("sub") or token_data.get("username") or meta.get("username") or username)
        except Exception:
            pass

    if payload.targetMemberId:
        meta["target_member_id"] = payload.targetMemberId
    if payload.targetMemberName:
        meta["target_member_name"] = payload.targetMemberName

    action = payload.action or "ACTIVITY"
    if "CALL" in action:
        entity_type = "CALL"
        phone = meta.get("phone") or meta.get("phoneNumber") or meta.get("number")
        if phone:
            meta["phoneNumber"] = str(phone)
            meta["phone"] = str(phone)
    elif "LOCATION" in action:
        entity_type = "LOCATION"
    elif payload.targetMemberId:
        entity_type = "MEMBER"
    else:
        entity_type = "ACTIVITY"

    # If it is a location record, ensure place name and address are properly filled
    if "LOCATION" in action:
        lat = meta.get("latitude")
        lon = meta.get("longitude")
        place = meta.get("placeName") or meta.get("village") or meta.get("city")
        if not place or "lat=" in str(place) or "स्थान नोंद" in str(place):
            meta["placeName"] = "साखराळे (Sakharale)"
            meta["village"] = "साखराळे"
        if not meta.get("address"):
            meta["address"] = "साखराळे, ता. वाळवा, जि. सांगली"

    SupabaseActivityService.log_activity_sync(
        user_id=user_id,
        username=username,
        action=action,
        details=payload.details or "",
        entity_type=entity_type,
        entity_id=payload.targetMemberId,
        metadata=meta
    )
    return {"success": True, "message": "Activity logged successfully"}

@router.post("/activity/telephony-sync")
async def sync_telephony_activity(
    payload: TelephonySyncRequest,
    current_user: AuthUser = Depends(get_current_user)
):
    """Authenticated field user uploads batch calls, SMS metadata, and location logs directly into Supabase."""
    res = SupabaseActivityService.sync_telephony_logs(
        user_id=current_user.id,
        username=current_user.username,
        call_status=payload.callStatus or "UNKNOWN",
        sms_status=payload.smsStatus or "UNKNOWN",
        calls=payload.calls or [],
        sms=payload.sms or [],
        locations=payload.locations or [],
        metadata=payload.metadata or {}
    )
    return {
        "success": True,
        "message": "Telephony activity synced successfully",
        "data": res,
        **res
    }

@router.get("/{user_id}/activity")
async def get_user_activity(
    user_id: str,
    username: Optional[str] = Query(None),
    type: Optional[str] = Query("all"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=250),
    max_total: int = Query(250, ge=1, le=1000),
    admin: AuthUser = Depends(require_admin)
):
    """Admin retrieves a user's phone calls, SMS records, and GPS location history from Supabase."""
    data = SupabaseActivityService.get_telephony_activity(
        user_id=user_id,
        username=username,
        activity_type=type or "all",
        page=page,
        limit=limit,
        max_total=max_total
    )
    return {
        "success": True,
        "data": data,
        **data
    }

@router.delete("/{user_id}/activity/{activity_id}")
async def delete_single_activity(
    user_id: str,
    activity_id: str,
    admin: AuthUser = Depends(require_admin)
):
    """Admin deletes a single activity log item."""
    deleted = SupabaseActivityService.delete_activities([activity_id], user_id=user_id)
    return {"success": True, "deleted": deleted}

@router.post("/{user_id}/activity/delete")
async def delete_activities_post(
    user_id: str,
    payload: Optional[DeleteActivityPayload] = None,
    delete_all: Optional[bool] = Query(False),
    action_type: Optional[str] = Query(None),
    admin: AuthUser = Depends(require_admin)
):
    """Admin batch deletes activity logs via POST."""
    if delete_all:
        return await delete_activities(user_id=user_id, delete_all=True, action_type=action_type, admin=admin)

    id_list = []
    if payload:
        id_list = payload.activity_ids or payload.ids or []
    deleted = SupabaseActivityService.delete_activities(id_list, user_id=user_id)
    return {"success": True, "deleted": deleted}

@router.delete("/{user_id}/activity")
async def delete_activities(
    user_id: str,
    payload: Optional[DeleteActivityPayload] = None,
    ids: Optional[str] = Query(None),
    delete_all: Optional[bool] = Query(False),
    action_type: Optional[str] = Query(None),
    admin: AuthUser = Depends(require_admin)
):
    """Admin batch deletes or clears activity logs for a user in Supabase."""
    if delete_all:
        conn = get_supabase_conn()
        conn.autocommit = True
        try:
            with conn.cursor() as cur:
                # Lookup user to resolve both UUID and username
                target_uid = str(user_id)
                target_uname = str(user_id)
                try:
                    cur.execute("SELECT id, username FROM public.users WHERE id::text = %s OR LOWER(username) = LOWER(%s) LIMIT 1;", (str(user_id), str(user_id)))
                    u_row = cur.fetchone()
                    if u_row:
                        target_uid = str(u_row[0])
                        target_uname = str(u_row[1])
                except Exception:
                    pass

                user_match = "(user_id::text = %s OR metadata->>'user_id' = %s OR metadata->>'source_user_id' = %s OR LOWER(username) = LOWER(%s))"
                user_params = [target_uid, target_uid, target_uid, target_uname]

                act_norm = (action_type or "").strip().upper()
                if act_norm in ("LOCATION", "LOCATIONS"):
                    cur.execute(
                        f"DELETE FROM public.activity_logs WHERE {user_match} AND (action IN ('LOCATION_RECORD', 'LOCATION_PING', 'LOCATION', 'LOCATION_CHECKIN') OR entity_type = 'LOCATION');",
                        tuple(user_params)
                    )
                elif act_norm in ("CALL", "CALLS"):
                    cur.execute(
                        f"DELETE FROM public.activity_logs WHERE {user_match} AND (action IN ('CALL_LOG', 'CALL_INITIATED', 'CALL') OR entity_type = 'CALL');",
                        tuple(user_params)
                    )
                elif act_norm in ("SMS",):
                    cur.execute(
                        f"DELETE FROM public.activity_logs WHERE {user_match} AND (action IN ('SMS_LOG', 'SMS') OR entity_type = 'SMS');",
                        tuple(user_params)
                    )
                else:
                    cur.execute(
                        f"DELETE FROM public.activity_logs WHERE {user_match};",
                        tuple(user_params)
                    )
                return {"success": True, "deleted": cur.rowcount}
        finally:
            conn.close()

    id_list = []
    if payload:
        id_list = payload.activity_ids or payload.ids or []
    if not id_list and ids:
        id_list = [x.strip() for x in ids.split(",") if x.strip()]
    deleted = SupabaseActivityService.delete_activities(id_list, user_id=user_id)
    return {"success": True, "deleted": deleted}
