import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from psycopg2.extras import RealDictCursor

from app.auth.security import get_current_user, AuthUser, log_activity
from app.services.supabase_service import get_supabase_conn, SupabaseMemberService, format_voter_as_member

router = APIRouter(prefix="", tags=["Family Management"])

class FamilyMemberCreate(BaseModel):
    nameMarathi: str
    relationType: str
    membershipNumber: Optional[str] = None
    serialNumber: Optional[Any] = None
    epicNumber: Optional[str] = None
    mobileNumber: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = "Male"
    existingMemberId: Optional[str] = None
    religion: Optional[str] = None
    caste: Optional[str] = None
    profession: Optional[str] = None
    designation: Optional[str] = None

class FamilyUpdate(BaseModel):
    familyHeadName: Optional[str] = None
    houseNumber: Optional[str] = None
    notes: Optional[str] = None

@router.get("/members/{member_id}/family")
async def get_member_family(
    member_id: str,
    user: AuthUser = Depends(get_current_user)
):
    """Fetch family members connected to this member's family unit from Supabase."""
    member = SupabaseMemberService.get_member_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    family_id = member.get("familyId")
    if not family_id:
        return {
            "success": True,
            "data": {
                "familyId": None,
                "familyHeadName": member.get("nameMarathi", {}).get("full", ""),
                "members": []
            }
        }

    conn = get_supabase_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM public.families WHERE id::text = %s LIMIT 1;", (str(family_id),))
            family = cur.fetchone()

            cur.execute("""
                SELECT * FROM public.voters
                WHERE family_id::text = %s AND id::text != %s AND is_deleted = false
                ORDER BY serial_number ASC NULLS LAST;
            """, (str(family_id), str(member["id"])))
            rows = cur.fetchall()

            family_members = []
            for r in rows:
                m = format_voter_as_member(r)
                family_members.append({
                    "id": m["id"],
                    "name": m["nameMarathi"]["full"],
                    "full_name_mr": m["nameMarathi"]["full"],
                    "nameMarathi": m["nameMarathi"],
                    "serialNumber": m["serialNumber"],
                    "serial_number": m["serialNumber"],
                    "epicNumber": m["epicNumber"],
                    "epic_number": m["epicNumber"],
                    "relationType": m["relationType"],
                    "relation_type": m["relationType"],
                    "age": m["age"],
                    "gender": m["gender"],
                    "mobileNumber": m["mobileNumber"],
                    "mobile_number": m["mobileNumber"],
                    "religion": m["religion"],
                    "caste": m["caste"],
                    "profession": m["profession"],
                    "designation": m["designation"]
                })

            return {
                "success": True,
                "data": {
                    "familyId": str(family["id"]) if family else family_id,
                    "familyHeadName": family["family_head_name"] if family else "",
                    "notes": family.get("notes", "") if family else "",
                    "members": family_members
                }
            }
    finally:
        conn.close()

@router.post("/members/{member_id}/family")
async def add_family_member(
    member_id: str,
    payload: FamilyMemberCreate,
    user: AuthUser = Depends(get_current_user)
):
    """Add or link a voter to the primary member's family in Supabase."""
    member = SupabaseMemberService.get_member_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Primary member not found")

    conn = get_supabase_conn()
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            family_id = member.get("familyId")
            if not family_id:
                new_fid = str(uuid.uuid4())
                head_name = member.get("nameMarathi", {}).get("full", "")
                house_no = member.get("houseNumber", "")
                v_id = member.get("village", {}).get("id")
                cur.execute("""
                    INSERT INTO public.families (id, village_id, family_head_name, house_number, total_members, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, 1, NOW(), NOW());
                """, (new_fid, v_id, head_name, house_no))
                cur.execute("UPDATE public.voters SET family_id = %s WHERE id::text = %s;", (new_fid, str(member["id"])))
                family_id = new_fid

            if payload.existingMemberId:
                cur.execute("""
                    UPDATE public.voters
                    SET family_id = %s, relation_type = %s, updated_at = NOW(), updated_by = %s
                    WHERE id::text = %s;
                """, (family_id, payload.relationType, user.username, str(payload.existingMemberId)))
                cur.execute("""
                    UPDATE public.families
                    SET total_members = (SELECT count(*) FROM public.voters WHERE family_id = public.families.id),
                        updated_at = NOW()
                    WHERE id::text = %s;
                """, (family_id,))
                return {
                    "success": True,
                    "message": "Existing voter linked to family successfully",
                    "data": {"id": str(payload.existingMemberId), "familyId": family_id}
                }

            # Create new voter
            new_id = str(uuid.uuid4())
            sr = None
            if payload.serialNumber:
                try:
                    sr = int(payload.serialNumber)
                except Exception:
                    pass

            cur.execute("""
                INSERT INTO public.voters (
                    id, full_name_marathi, full_name, relation_type,
                    relative_name_marathi, house_number, age, gender,
                    mobile_number, religion, caste, profession, designation,
                    family_id, village_id, village_name, village_name_marathi,
                    status, serial_number, epic_number, updated_by
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, 'Sakharale', 'साखराळे', 'ACTIVE', %s, %s, %s
                );
            """, (
                new_id, payload.nameMarathi, payload.nameMarathi, payload.relationType,
                member.get("nameMarathi", {}).get("full", ""), member.get("houseNumber", ""),
                payload.age, payload.gender or "Male", payload.mobileNumber or "",
                payload.religion or "", payload.caste or "", payload.profession or "",
                payload.designation or "", family_id, member.get("village", {}).get("id"),
                sr, payload.epicNumber or None, user.username
            ))

            cur.execute("""
                UPDATE public.families
                SET total_members = (SELECT count(*) FROM public.voters WHERE family_id = public.families.id),
                    updated_at = NOW()
                WHERE id::text = %s;
            """, (family_id,))

            log_activity(
                user_id=user.id,
                action="ADD_FAMILY_MEMBER",
                entity_type="MEMBER",
                entity_id=new_id,
                details=f"Added family member {payload.nameMarathi} ({payload.relationType})",
                username=user.username
            )

            return {
                "success": True,
                "message": "Family member added successfully",
                "data": {
                    "id": new_id,
                    "nameMarathi": payload.nameMarathi,
                    "serialNumber": sr,
                    "epicNumber": payload.epicNumber,
                    "familyId": family_id
                }
            }
    finally:
        conn.close()

@router.delete("/members/{member_id}/family/{target_member_id}")
async def delete_family_member(
    member_id: str,
    target_member_id: str,
    user: AuthUser = Depends(get_current_user)
):
    """Remove a family member connection in Supabase."""
    conn = get_supabase_conn()
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE public.voters SET family_id = NULL WHERE id::text = %s;", (str(target_member_id),))
            return {"success": True, "message": "Family member unlinked successfully"}
    finally:
        conn.close()
