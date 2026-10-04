from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from pydantic import BaseModel

from app.database.mongodb import get_mongo_db
from app.auth.security import get_current_user, AuthUser, log_activity

router = APIRouter(prefix="", tags=["Family Management"])

class FamilyMemberCreate(BaseModel):
    nameMarathi: str
    relationType: str  # Wife, Son, Daughter, Brother, Mother, Father, Other
    membershipNumber: Optional[str] = None
    mobileNumber: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = "Male"

class FamilyUpdate(BaseModel):
    familyHeadName: Optional[str] = None
    houseNumber: Optional[str] = None
    notes: Optional[str] = None

@router.get("/members/{member_id}/family")
async def get_member_family(
    member_id: str,
    db = Depends(get_mongo_db),
    user: AuthUser = Depends(get_current_user)
):
    """Fetch family members connected to this member's family unit."""
    m_query = {"_id": ObjectId(member_id)} if ObjectId.is_valid(member_id) else {"_id": member_id}
    member = await db.members.find_one(m_query)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    family_id = member.get("familyId")
    if not family_id:
        # Do not automatically connect voters by house number.
        # Connected family members must be manually added by the user.
        return {
            "success": True,
            "data": {
                "familyId": None,
                "familyHeadName": member.get("nameMarathi", {}).get("full", ""),
                "members": []
            }
        }

    f_query = {"_id": ObjectId(family_id)} if ObjectId.is_valid(family_id) else {"_id": family_id}
    family = await db.families.find_one(f_query)

    # Exclude the member themself from the connected list
    cursor = db.members.find({
        "familyId": family_id,
        "_id": {"$ne": member["_id"]}
    })
    family_members = []
    async for m in cursor:
        m["id"] = str(m["_id"])
        del m["_id"]
        family_members.append(m)

    return {
        "success": True,
        "data": {
            "familyId": str(family.get("_id", "")) if family else family_id,
            "familyHeadName": family.get("familyHeadName", "") if family else "",
            "notes": family.get("notes", "") if family else "",
            "members": family_members
        }
    }

@router.post("/members/{member_id}/family")
async def add_family_member(
    member_id: str,
    payload: FamilyMemberCreate,
    db = Depends(get_mongo_db),
    user: AuthUser = Depends(get_current_user)
):
    """Add/link a new family member to the member's family unit."""
    m_query = {"_id": ObjectId(member_id)} if ObjectId.is_valid(member_id) else {"_id": member_id}
    primary_member = await db.members.find_one(m_query)
    if not primary_member:
        raise HTTPException(status_code=404, detail="Primary member not found")

    family_id = primary_member.get("familyId")
    if not family_id:
        # Create new Family unit
        new_family = {
            "villageId": primary_member.get("village", {}).get("id", ""),
            "familyHeadMemberId": str(primary_member["_id"]),
            "familyHeadName": primary_member.get("nameMarathi", {}).get("full", ""),
            "houseNumber": primary_member.get("houseNumber", ""),
            "memberIds": [str(primary_member["_id"])],
            "totalMembers": 1,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        f_res = await db.families.insert_one(new_family)
        family_id = str(f_res.inserted_id)
        await db.members.update_one(m_query, {"$set": {"familyId": family_id}})

    # Create new family member document in members collection
    new_member = {
        "membershipNumber": payload.membershipNumber,
        "serialNumber": None,
        "epicNumber": None,
        "name": {
            "full": payload.nameMarathi,
            "first": "",
            "surname": primary_member.get("nameMarathi", {}).get("surname", ""),
            "fatherName": ""
        },
        "nameMarathi": {
            "full": payload.nameMarathi,
            "first": "",
            "surname": primary_member.get("nameMarathi", {}).get("surname", ""),
            "fatherName": ""
        },
        "relative": {
            "relationType": payload.relationType,
            "nameMarathi": primary_member.get("nameMarathi", {}).get("full", ""),
            "nameEnglish": ""
        },
        "village": primary_member.get("village", {}),
        "ward": primary_member.get("ward"),
        "houseNumber": primary_member.get("houseNumber", ""),
        "age": payload.age,
        "gender": payload.gender or "Male",
        "mobileNumber": payload.mobileNumber or "",
        "address": primary_member.get("address", ""),
        "pinCode": primary_member.get("pinCode", "415414"),
        "religion": primary_member.get("religion", ""),
        "caste": primary_member.get("caste", ""),
        "familyId": family_id,
        "category": primary_member.get("category", {}),
        "status": "ACTIVE",
        "source": {
            "fileName": "Manual Entry (Family)",
            "fileType": "MANUAL",
            "uploadedBy": user.username,
            "uploadDate": datetime.utcnow()
        },
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "updatedBy": user.username
    }

    res = await db.members.insert_one(new_member)
    new_member_id = str(res.inserted_id)

    # Update family memberIds list
    f_query = {"_id": ObjectId(family_id)} if ObjectId.is_valid(family_id) else {"_id": family_id}
    await db.families.update_one(
        f_query,
        {
            "$addToSet": {"memberIds": new_member_id},
            "$inc": {"totalMembers": 1},
            "$set": {"updatedAt": datetime.utcnow()}
        }
    )

    log_activity(
        user_id=user.id,
        action="ADD_FAMILY_MEMBER",
        entity_type="MEMBER",
        entity_id=new_member_id,
        details=f"Added family member {payload.nameMarathi} ({payload.relationType})",
        username=user.username
    )

    return {
        "success": True,
        "message": "Family member added successfully",
        "data": {
            "id": new_member_id,
            "nameMarathi": payload.nameMarathi,
            "familyId": family_id
        }
    }

@router.put("/family/{family_id}")
async def update_family(
    family_id: str,
    payload: FamilyUpdate,
    db = Depends(get_mongo_db),
    user: AuthUser = Depends(get_current_user)
):
    f_query = {"_id": ObjectId(family_id)} if ObjectId.is_valid(family_id) else {"_id": family_id}
    set_fields: Dict[str, Any] = {"updatedAt": datetime.utcnow()}
    if payload.familyHeadName:
        set_fields["familyHeadName"] = payload.familyHeadName
    if payload.houseNumber:
        set_fields["houseNumber"] = payload.houseNumber
    if payload.notes is not None:
        set_fields["notes"] = payload.notes

    res = await db.families.find_one_and_update(f_query, {"$set": set_fields}, return_document=True)
    if not res:
        raise HTTPException(status_code=404, detail="Family not found")

    res["id"] = str(res["_id"])
    del res["_id"]
    return {"success": True, "data": res}

@router.delete("/family/{family_id}")
async def delete_family(
    family_id: str,
    db = Depends(get_mongo_db),
    user: AuthUser = Depends(get_current_user)
):
    f_query = {"_id": ObjectId(family_id)} if ObjectId.is_valid(family_id) else {"_id": family_id}
    await db.members.update_many({"familyId": family_id}, {"$set": {"familyId": None}})
    res = await db.families.delete_one(f_query)
    return {"success": True, "message": "Family unlinked successfully"}

@router.delete("/members/{member_id}/family/{target_member_id}")
async def delete_family_member(
    member_id: str,
    target_member_id: str,
    db = Depends(get_mongo_db),
    user: AuthUser = Depends(get_current_user)
):
    """Remove a family member connection."""
    t_query = {"_id": ObjectId(target_member_id)} if ObjectId.is_valid(target_member_id) else {"_id": target_member_id}
    target = await db.members.find_one(t_query)
    if not target:
        raise HTTPException(status_code=404, detail="Target family member not found")

    # If it was a manually added pseudo-member without serialNumber or epicNumber, delete document
    if not target.get("serialNumber") and not target.get("epicNumber"):
        await db.members.delete_one(t_query)
    else:
        # Otherwise just unlink from family
        await db.members.update_one(t_query, {"$set": {"familyId": None}})

    return {"success": True, "message": "Family member removed successfully"}

