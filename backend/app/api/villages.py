from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from pydantic import BaseModel

from app.database.mongodb import get_mongo_db
from app.auth.security import get_current_user, require_admin, AuthUser

router = APIRouter(prefix="/villages", tags=["Villages"])

class VillageCreatePayload(BaseModel):
    name: str
    nameMarathi: str
    taluka: Optional[str] = "Walwa"
    district: Optional[str] = "Sangli"
    pinCode: Optional[str] = "415414"

def format_village(v: dict) -> dict:
    vid = str(v["_id"])
    return {
        "id": vid,
        "name": v.get("name", ""),
        "name_en": v.get("name", ""),
        "nameMarathi": v.get("nameMarathi", ""),
        "name_mr": v.get("nameMarathi", ""),
        "taluka": v.get("taluka", ""),
        "district": v.get("district", ""),
        "pin_code": v.get("pinCode", ""),
        "total_voters": v.get("stats", {}).get("totalVoters", 0),
        "active_voters": v.get("stats", {}).get("activeMembers", 0),
        "deceased_voters": v.get("stats", {}).get("deceasedMembers", 0),
        "total_families": v.get("stats", {}).get("totalFamilies", 0)
    }

@router.get("")
async def get_villages(
    db = Depends(get_mongo_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """Retrieve all villages with live voter statistics from MongoDB."""
    cursor = db.villages.find({}).sort("nameMarathi", 1)
    villages = []
    async for v in cursor:
        vid = str(v["_id"])
        # Update live counts
        total = await db.members.count_documents({"village.id": vid})
        active = await db.members.count_documents({"village.id": vid, "status": "ACTIVE"})
        dead = await db.members.count_documents({"village.id": vid, "status": "DECEASED"})
        v["stats"] = {
            "totalVoters": total,
            "activeMembers": active,
            "deceasedMembers": dead,
            "totalFamilies": max(1, total // 3)
        }
        villages.append(format_village(v))

    return villages

@router.get("/{village_id}")
async def get_village_by_id(
    village_id: str,
    db = Depends(get_mongo_db),
    current_user: AuthUser = Depends(get_current_user)
):
    query = {"_id": ObjectId(village_id)} if ObjectId.is_valid(village_id) else {"_id": village_id}
    v = await db.villages.find_one(query)
    if not v:
        raise HTTPException(status_code=404, detail="Village not found")
    return {"success": True, "data": format_village(v)}

@router.post("")
async def create_village(
    payload: VillageCreatePayload,
    db = Depends(get_mongo_db),
    admin: AuthUser = Depends(require_admin)
):
    new_village = {
        "name": payload.name.strip(),
        "nameMarathi": payload.nameMarathi.strip(),
        "taluka": payload.taluka or "Walwa",
        "talukaMarathi": "वाळवा",
        "district": payload.district or "Sangli",
        "districtMarathi": "सांगली",
        "pinCode": payload.pinCode or "415414",
        "stats": {"totalVoters": 0, "activeMembers": 0, "deceasedMembers": 0, "totalFamilies": 0},
        "sourceFilesCount": 0
    }
    res = await db.villages.insert_one(new_village)
    new_village["_id"] = res.inserted_id
    return {"success": True, "data": format_village(new_village)}
