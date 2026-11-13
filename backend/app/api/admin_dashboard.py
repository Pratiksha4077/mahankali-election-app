from fastapi import APIRouter, Depends
from app.auth.security import require_admin, AuthUser
from app.services.supabase_service import SupabaseDashboardService

router = APIRouter(prefix="/admin", tags=["Admin Dashboard & Analytics"])

@router.get("/dashboard")
async def get_admin_dashboard(force_refresh: bool = False, admin: AuthUser = Depends(require_admin)):
    """Executive metrics cards for Admin Dashboard computed directly from Supabase."""
    stats_data = SupabaseDashboardService.get_admin_dashboard(force_refresh=force_refresh)
    return {
        "success": True,
        "data": stats_data,
        **stats_data
    }

@router.get("/analytics")
async def get_admin_analytics(force_refresh: bool = False, admin: AuthUser = Depends(require_admin)):
    """Chart breakdown data for village and category color distributions from Supabase."""
    analytics = SupabaseDashboardService.get_admin_analytics(force_refresh=force_refresh)
    return {
        "success": True,
        "data": analytics,
        **analytics
    }
