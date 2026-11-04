from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from app.auth.security import get_current_user, AuthUser, log_activity
from app.services.supabase_service import SupabaseMemberService

router = APIRouter(prefix="/members", tags=["Members & Voters"])

class MemberUpdatePayload(BaseModel):
    model_config = {"extra": "allow"}

    mobileNumber: Optional[str] = None
    mobile_number: Optional[str] = None
    address: Optional[str] = None
    pinCode: Optional[str] = None
    pin_code: Optional[str] = None
    religion: Optional[str] = None
    caste: Optional[str] = None
    designation: Optional[str] = None
    profession: Optional[str] = None
    organization: Optional[str] = None
    org: Optional[str] = None
    father_name: Optional[str] = None
    fatherName: Optional[str] = None
    relative_name_mr: Optional[str] = None
    houseNumber: Optional[str] = None
    house_number: Optional[str] = None
    age: Optional[Any] = None
    gender: Optional[str] = None
    full_name_mr: Optional[str] = None
    full_name_en: Optional[str] = None
    nameMarathi: Optional[Any] = None
    name: Optional[Any] = None
    serialNumber: Optional[Any] = None
    serial_number: Optional[Any] = None
    voter_number: Optional[Any] = None
    epicNumber: Optional[str] = None
    epic_number: Optional[str] = None
    boothPartNumber: Optional[str] = None
    booth_part_number: Optional[str] = None
    status: Optional[str] = None
    is_deceased: Optional[bool] = None
    category_id: Optional[str] = None
    categoryId: Optional[str] = None
    village_id: Optional[str] = None
    villageId: Optional[str] = None

class MemberCategoryUpdatePayload(BaseModel):
    category_id: Optional[str] = None
    categoryId: Optional[str] = None

class MemberDeceasedPayload(BaseModel):
    is_deceased: Optional[bool] = None
    status: Optional[str] = None

@router.get("")
@router.get("/search")
async def get_members(
    q: Optional[str] = Query(None, description="Search term for name, membership/EPIC, village, mobile"),
    village_id: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    my_assigned_only: bool = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=250),
    current_user: AuthUser = Depends(get_current_user)
):
    """List and search members/voters directly from Supabase PostgreSQL."""
    user_id = current_user.id if my_assigned_only else None
    result = SupabaseMemberService.get_members(
        village_id=village_id,
        search_query=q,
        category_id=category_id,
        status=status or "ACTIVE",
        assigned_user_id=user_id,
        my_assigned_only=my_assigned_only,
        page=page,
        limit=limit
    )

    if q and q.strip():
        log_activity(
            user_id=current_user.id,
            action="SEARCH",
            details=f"Searched for '{q}'",
            username=current_user.username
        )

    return {
        "success": True,
        "total": result["total"],
        "page": result["page"],
        "limit": result["limit"],
        "total_pages": result["pages"],
        "items": result["items"]
    }

@router.get("/{member_id}")
async def get_member_detail(
    member_id: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Retrieve full voter profile from Supabase."""
    member = SupabaseMemberService.get_member_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="मतदार सापडला नाही (Member not found)")

    log_activity(
        user_id=current_user.id,
        action="VIEW_MEMBER",
        entity_type="MEMBER",
        entity_id=member_id,
        details=f"Viewed member {member.get('nameMarathi', {}).get('full', member_id)}",
        username=current_user.username
    )

    return {
        "success": True,
        "data": member,
        **member
    }

@router.put("/{member_id}")
@router.patch("/{member_id}")
async def update_member(
    member_id: str,
    payload: MemberUpdatePayload,
    current_user: AuthUser = Depends(get_current_user)
):
    """Update editable demographics and contact info in Supabase."""
    update_dict = payload.model_dump(exclude_unset=True)
    updated = SupabaseMemberService.update_member(
        member_id=member_id,
        update_fields=update_dict,
        updated_by=current_user.username
    )
    if not updated:
        raise HTTPException(status_code=404, detail="मतदार सापडला नाही (Member not found)")

    log_activity(
        user_id=current_user.id,
        action="UPDATE_MEMBER",
        entity_type="MEMBER",
        entity_id=member_id,
        details=f"Updated member details",
        username=current_user.username
    )
    return {
        "success": True,
        "message": "Member details updated",
        "data": updated,
        **updated
    }

@router.patch("/{member_id}/category")
async def update_category(
    member_id: str,
    payload: MemberCategoryUpdatePayload,
    current_user: AuthUser = Depends(get_current_user)
):
    """Assign/update category tag for voter in Supabase."""
    cat_id = payload.categoryId or payload.category_id
    if not cat_id:
        raise HTTPException(status_code=400, detail="Category ID is required")

    success = SupabaseMemberService.update_category(
        member_id=member_id,
        category_ident=cat_id,
        updated_by=current_user.username
    )
    if not success:
        raise HTTPException(status_code=404, detail="Member or category not found")

    member = SupabaseMemberService.get_member_by_id(member_id) or {}
    log_activity(
        user_id=current_user.id,
        action="CHANGE_CATEGORY",
        entity_type="MEMBER",
        entity_id=member_id,
        details=f"Changed category to {cat_id}",
        username=current_user.username
    )
    return {
        "success": True,
        "message": "Category updated",
        "data": member,
        **member
    }

@router.patch("/{member_id}/status")
@router.patch("/{member_id}/deceased")
async def toggle_deceased(
    member_id: str,
    payload: MemberDeceasedPayload,
    current_user: AuthUser = Depends(get_current_user)
):
    """Mark member as deceased or active in Supabase."""
    is_dec = payload.is_deceased if payload.is_deceased is not None else (payload.status == "DECEASED")
    
    success = SupabaseMemberService.toggle_deceased(
        member_id=member_id,
        is_deceased=is_dec,
        updated_by=current_user.username
    )
    if not success:
        raise HTTPException(status_code=404, detail="Member not found")

    member = SupabaseMemberService.get_member_by_id(member_id) or {}
    log_activity(
        user_id=current_user.id,
        action="MARK_DECEASED" if is_dec else "MARK_ACTIVE",
        entity_type="MEMBER",
        entity_id=member_id,
        details="Marked as deceased" if is_dec else "Restored to active",
        username=current_user.username
    )
    return {
        "success": True,
        "message": "Status updated successfully",
        "data": member,
        **member
    }
