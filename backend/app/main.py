from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging

from app.config.config import settings
from app.services.supabase_service import get_supabase_conn, SupabaseActivityService

from app.api import (
    auth, admin_users, admin_dashboard, members, villages, categories,
    family_routes, reports, import_routes, export_routes, sync, audit
)

logger = logging.getLogger("election_app")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Connect and verify Supabase PostgreSQL connection
    try:
        conn = get_supabase_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.users;")
            u_count = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM public.villages;")
            v_count = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM public.voters;")
            vot_count = cur.fetchone()[0]
            logger.info(
                f"[Supabase] Connected successfully. Users: {u_count}, "
                f"Villages: {v_count}, Voters: {vot_count}"
            )
        conn.close()
    except Exception as e:
        logger.error(f"[Supabase] Connection warning on startup: {e}")

    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-grade Backend API for Election & Voter Management App with Supabase PostgreSQL, Cloudinary File Storage, and Dual Admin/User Panels.",
    lifespan=lifespan
)

# High-Performance GZip Compression for Large Payloads (> 1KB)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS Configuration for Mobile App & Web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static Files for Processed & Exported Excel Files
app.mount("/static/processed", StaticFiles(directory=str(settings.PROCESSED_DIR)), name="processed")
app.mount("/static/exports", StaticFiles(directory=str(settings.EXPORT_DIR)), name="exports")

# Include Routers with /api prefix
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(admin_users.router, prefix=settings.API_V1_STR)
app.include_router(admin_dashboard.router, prefix=settings.API_V1_STR)
app.include_router(members.router, prefix=settings.API_V1_STR)
app.include_router(villages.router, prefix=settings.API_V1_STR)
app.include_router(categories.router, prefix=settings.API_V1_STR)
app.include_router(family_routes.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(import_routes.router, prefix=settings.API_V1_STR)
app.include_router(export_routes.router, prefix=settings.API_V1_STR)
app.include_router(sync.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)

from app.api.admin_users import LogActivityRequest

@app.post(f"{settings.API_V1_STR}/activity")
async def log_activity_general(payload: LogActivityRequest, request: Request):
    user_id = "u-user"
    username = "field_worker"

    meta = payload.metadata or {}
    if meta.get("user_id"):
        user_id = str(meta["user_id"])
    if meta.get("username"):
        username = str(meta["username"])

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            import jwt
            token = auth_header.split(" ")[1]
            token_data = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            user_id = str(token_data.get("user_id") or meta.get("user_id") or token_data.get("sub") or user_id)
            username = str(token_data.get("sub") or token_data.get("username") or meta.get("username") or username)
        except Exception:
            pass

    if payload.targetMemberId:
        meta["target_member_id"] = payload.targetMemberId
    if payload.targetMemberName:
        meta["target_member_name"] = payload.targetMemberName

    SupabaseActivityService.log_activity_sync(
        user_id=user_id,
        username=username,
        action=payload.action,
        details=payload.details or "",
        entity_type="MEMBER" if payload.targetMemberId else "ACTIVITY",
        entity_id=payload.targetMemberId,
        metadata=meta
    )
    return {"success": True, "message": "Activity logged"}

@app.get("/")
def root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "database": "Supabase PostgreSQL (Primary)",
        "version": settings.VERSION,
        "docs_url": "/docs"
    }

@app.get(f"{settings.API_V1_STR}/health")
def api_health():
    db_status = "connected"
    db_error = None
    try:
        from app.services.supabase_service import get_supabase_conn
        conn = get_supabase_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
        conn.close()
    except Exception as e:
        db_status = "error"
        db_error = str(e)

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": f"Supabase PostgreSQL ({db_status})",
        "db_status": db_status,
        "db_error": db_error,
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
