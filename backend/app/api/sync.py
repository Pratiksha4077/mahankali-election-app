from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.security import get_current_user, AuthUser, log_activity
from app.services.supabase_service import SupabaseMemberService

router = APIRouter(prefix="/sync", tags=["Data Synchronization"])

class SyncPayload(BaseModel):
    last_synced_at: Optional[datetime] = None
    village_id: Optional[str] = None
    modified_members: Optional[List[Dict[str, Any]]] = []

@router.get("/status")
async def get_sync_status(
    current_user: AuthUser = Depends(get_current_user)
):
    now = datetime.utcnow()
    return {
        "success": True,
        "last_sync_time": now.isoformat(),
        "sync_type": "SUPABASE_ONLINE",
        "status": "ONLINE",
        "records_pulled": 0,
        "records_pushed": 0
    }

@router.post("")
@router.post("/quick")
async def quick_sync(
    body: SyncPayload,
    current_user: AuthUser = Depends(get_current_user)
):
    """Incremental sync from Supabase."""
    now = datetime.utcnow()
    res = SupabaseMemberService.get_members(
        village_id=body.village_id,
        page=1,
        limit=250
    )
    items = res.get("items", [])

    log_activity(
        user_id=current_user.id,
        action="SYNC_DATA",
        details=f"Quick sync pulled {len(items)} records from Supabase",
        username=current_user.username
    )

    return {
        "success": True,
        "sync_type": "QUICK",
        "pulled_count": len(items),
        "synced_at": now.isoformat(),
        "updated_members": items
    }

@router.post("/full")
async def full_sync(
    body: Optional[SyncPayload] = None,
    current_user: AuthUser = Depends(get_current_user)
):
    """Full sync from Supabase."""
    now = datetime.utcnow()
    v_id = body.village_id if body else None
    res = SupabaseMemberService.get_members(
        village_id=v_id,
        page=1,
        limit=2500
    )
    items = res.get("items", [])

    log_activity(
        user_id=current_user.id,
        action="SYNC_DATA",
        details=f"Full sync pulled {len(items)} records from Supabase",
        username=current_user.username
    )

    return {
        "success": True,
        "sync_type": "FULL",
        "pulled_count": len(items),
        "synced_at": now.isoformat(),
        "updated_members": items
    }
