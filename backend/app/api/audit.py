from typing import List, Optional
from fastapi import APIRouter, Depends, Query

from app.auth.security import require_admin, AuthUser
from app.services.supabase_service import SupabaseActivityService

router = APIRouter(prefix="/admin", tags=["Admin Dashboard & Audit Logs"])

@router.get("/audit-logs")
def get_audit_logs(
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(50, le=200),
    page: int = Query(1, ge=1),
    admin: AuthUser = Depends(require_admin)
):
    """Retrieve audit logs directly from Supabase public.activity_logs."""
    res = SupabaseActivityService.get_activities(
        user_id=user_id,
        action_pattern=action,
        page=page,
        limit=limit
    )
    return res.get("items", [])
