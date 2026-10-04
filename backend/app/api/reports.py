from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query

from app.auth.security import get_current_user, AuthUser
from app.services.mongo_report_service import MongoReportService

router = APIRouter(prefix="/reports", tags=["Factual Reports"])

@router.get("/alphabetical")
async def get_alphabetical_report(
    village_id: Optional[str] = Query(None),
    letter: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    data = await MongoReportService.get_alphabetical_report(village_id=village_id, letter=letter)
    return {"success": True, "data": data, "items": data, "total": len(data)}

@router.get("/membership")
async def get_membership_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    data = await MongoReportService.get_membership_report(village_id=village_id)
    return data

@router.get("/surname")
async def get_surname_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    data = await MongoReportService.get_surname_report(village_id=village_id)
    return data

@router.get("/village")
async def get_village_report(current_user: AuthUser = Depends(get_current_user)):
    data = await MongoReportService.get_village_report()
    return data

@router.get("/category")
@router.get("/color-rating")
async def get_category_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    data = await MongoReportService.get_category_report(village_id=village_id)
    return data

@router.get("/religion")
async def get_religion_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    data = await MongoReportService.get_religion_report(village_id=village_id)
    return data

@router.get("/caste")
async def get_caste_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    data = await MongoReportService.get_caste_report(village_id=village_id)
    return data

@router.get("/designation")
async def get_designation_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    data = await MongoReportService.get_designation_report(village_id=village_id)
    return data

@router.get("/profession")
async def get_profession_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    data = await MongoReportService.get_profession_report(village_id=village_id)
    return data

@router.get("/family")
async def get_family_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    data = await MongoReportService.get_family_report(village_id=village_id)
    return {"success": True, "families": data, "data": data}

@router.get("/deceased")
async def get_deceased_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    data = await MongoReportService.get_deceased_report(village_id=village_id)
    return {"success": True, "items": data, "data": data}

@router.get("/mobile-status")
async def get_mobile_status_report(
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    return await MongoReportService.get_mobile_status_report(village_id=village_id)

@router.get("/drilldown")
async def get_report_drilldown(
    report_type: str = Query(...),
    key: str = Query(...),
    village_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user)
):
    """Fetch members for a clicked group in any report (surname, family, category, etc.)."""
    members = await MongoReportService.get_drilldown_members(report_type, key, village_id=village_id)
    return {"success": True, "total": len(members), "items": members, "data": members}


