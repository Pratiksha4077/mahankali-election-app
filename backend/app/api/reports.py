from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query

from app.auth.security import get_current_user, AuthUser
from app.services.supabase_service import SupabaseReportService

router = APIRouter(prefix="/reports", tags=["Factual Reports"])

@router.get("/alphabetical")
async def get_alphabetical_report(
    village_id: Optional[str] = Query(None),
    letter: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    data = SupabaseReportService.get_alphabetical_report(village_id=village_id, letter=letter)
    return {"success": True, "data": data, "items": data, "total": len(data)}

@router.get("/membership")
async def get_membership_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    return SupabaseReportService.get_membership_report(village_id=village_id)

@router.get("/surname")
async def get_surname_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    """Surname-wise voter breakdown computed in < 10ms directly from Supabase."""
    return SupabaseReportService.get_surname_report(village_id=village_id)

@router.get("/village")
async def get_village_report(current_user: AuthUser = Depends(get_current_user)):
    return SupabaseReportService.get_village_report()

@router.get("/category")
@router.get("/color-rating")
async def get_category_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    return SupabaseReportService.get_category_report(village_id=village_id)

@router.get("/religion")
async def get_religion_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    return SupabaseReportService.get_religion_report(village_id=village_id)

@router.get("/caste")
async def get_caste_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    return SupabaseReportService.get_caste_report(village_id=village_id)

@router.get("/designation")
async def get_designation_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    return SupabaseReportService.get_designation_report(village_id=village_id)

@router.get("/profession")
async def get_profession_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    return SupabaseReportService.get_profession_report(village_id=village_id)

@router.get("/family")
async def get_family_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    data = SupabaseReportService.get_family_report(village_id=village_id)
    return {"success": True, "families": data, "data": data}

@router.get("/deceased")
async def get_deceased_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    data = SupabaseReportService.get_deceased_report(village_id=village_id)
    return {"success": True, "items": data, "data": data}

@router.get("/mobile-status")
async def get_mobile_status_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    return SupabaseReportService.get_mobile_status_report(village_id=village_id)

@router.get("/drilldown")
async def get_report_drilldown(
    report_type: str = Query(...),
    key: str = Query(...),
    village_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    q: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    """Fetch members for a clicked group in any report (surname, category, etc.) with pagination from Supabase."""
    search_term = search or q
    res = SupabaseReportService.get_drilldown_members(
        report_type=report_type,
        key=key,
        village_id=village_id,
        page=page,
        limit=limit,
        search=search_term
    )
    return {
        "success": True,
        "total": res.get("total", 0),
        "items": res.get("items", []),
        "data": res.get("data", []),
        "page": res.get("page", page),
        "pages": res.get("pages", 1),
        "hasMore": res.get("hasMore", False)
    }
