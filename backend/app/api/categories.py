from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.security import get_current_user, require_admin, AuthUser
from app.services.supabase_service import SupabaseCategoryService

router = APIRouter(prefix="/categories", tags=["Categories & Tagging"])

class CategoryCreatePayload(BaseModel):
    code: str
    name: str
    nameMarathi: str
    color: str
    description: Optional[str] = ""

@router.get("")
async def get_categories(
    current_user: AuthUser = Depends(get_current_user)
):
    """List active sponsor-defined categories from Supabase."""
    return SupabaseCategoryService.get_categories()
