from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.database.mongodb import get_mongo_db
from app.auth.security import get_current_user, AuthUser, log_activity
from app.api.members import enrich_member_document

router = APIRouter(prefix="/sync", tags=["Data Synchronization"])

class SyncPayload(BaseModel):
    last_synced_at: Optional[datetime] = None
    village_id: Optional[str] = None
    modified_members: Optional[List[Dict[str, Any]]] = []

@router.get("/status")
async def get_sync_status(
    current_user: AuthUser = Depends(get_current_user),
    db = Depends(get_mongo_db)
):
    last_sync = await db.sync_history.find_one(
        {"userId": current_user.id},
        sort=[("last_synced_at", -1)]
    )
    return {
        "success": True,
        "last_sync_time": last_sync.get("last_synced_at").isoformat() if last_sync and last_sync.get("last_synced_at") else None,
        "sync_type": last_sync.get("sync_type") if last_sync else None,
        "status": last_sync.get("status") if last_sync else "NEVER_SYNCED",
        "records_pulled": last_sync.get("records_pulled", 0) if last_sync else 0,
        "records_pushed": last_sync.get("records_pushed", 0) if last_sync else 0
    }

@router.post("")
@router.post("/quick")
async def quick_sync(
    body: SyncPayload,
    current_user: AuthUser = Depends(get_current_user),
    db = Depends(get_mongo_db)
):
    """Incremental delta sync: downloads records updated since last_synced_at."""
    now = datetime.utcnow()
    filter_q: Dict[str, Any] = {}

    if body.village_id:
        filter_q["village.id"] = body.village_id
    elif current_user.assignedVillages:
        filter_q["village.id"] = {"$in": current_user.assignedVillages}

    if body.last_synced_at:
        filter_q["updatedAt"] = {"$gte": body.last_synced_at}

    cursor = db.members.find(filter_q).limit(500)
    updated_members = [enrich_member_document(doc) async for doc in cursor]

    # Record sync history
    await db.sync_history.insert_one({
        "userId": current_user.id,
        "sync_type": "QUICK",
        "status": "SUCCESS",
        "records_pulled": len(updated_members),
        "records_pushed": len(body.modified_members or []),
        "last_synced_at": now
    })

    log_activity(
        user_id=current_user.id,
        action="SYNC_DATA",
        details=f"Quick sync pulled {len(updated_members)} records",
        username=current_user.username
    )

    return {
        "success": True,
        "sync_type": "QUICK",
        "pulled_count": len(updated_members),
        "synced_at": now.isoformat(),
        "updated_members": updated_members
    }

@router.post("/full")
async def full_sync(
    body: Optional[SyncPayload] = None,
    current_user: AuthUser = Depends(get_current_user),
    db = Depends(get_mongo_db)
):
    """Full sync: reconciles all authorized voter records for the client."""
    now = datetime.utcnow()
    filter_q: Dict[str, Any] = {}

    if body and body.village_id:
        filter_q["village.id"] = body.village_id
    elif current_user.assignedVillages:
        filter_q["village.id"] = {"$in": current_user.assignedVillages}

    cursor = db.members.find(filter_q).limit(2000)
    all_members = [enrich_member_document(doc) async for doc in cursor]

    await db.sync_history.insert_one({
        "userId": current_user.id,
        "sync_type": "FULL",
        "status": "SUCCESS",
        "records_pulled": len(all_members),
        "records_pushed": 0,
        "last_synced_at": now
    })

    log_activity(
        user_id=current_user.id,
        action="SYNC_DATA",
        details=f"Full sync pulled {len(all_members)} records",
        username=current_user.username
    )

    return {
        "success": True,
        "sync_type": "FULL",
        "pulled_count": len(all_members),
        "synced_at": now.isoformat(),
        "updated_members": all_members
    }
