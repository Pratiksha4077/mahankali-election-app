from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.security import get_current_user, require_admin, AuthUser
from app.services.supabase_service import SupabaseVillageService

router = APIRouter(prefix="/villages", tags=["Villages"])

class VillageCreatePayload(BaseModel):
    name: str
    nameMarathi: str
    taluka: Optional[str] = "Walwa"
    district: Optional[str] = "Sangli"
    pinCode: Optional[str] = "415414"

@router.get("")
async def get_villages(
    current_user: AuthUser = Depends(get_current_user)
):
    """Retrieve all villages with instant response from Supabase."""
    return SupabaseVillageService.get_villages()

@router.get("/{village_id}")
async def get_village_by_id(
    village_id: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Fetch single village details from Supabase."""
    v = SupabaseVillageService.get_village_by_id(village_id)
    if not v:
        raise HTTPException(status_code=404, detail="गाव सापडले नाही (Village not found)")
    return v
