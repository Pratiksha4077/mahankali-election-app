from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging

from app.config.config import settings
from app.config.database import Base, engine, SessionLocal
from app.utils.seed_data import seed_initial_data
from app.database.mongodb import connect_to_mongo, close_mongo_connection
from app.database.seed_mongo import seed_mongo_initial_data

from app.api import (
    auth, admin_users, admin_dashboard, members, villages, categories,
    family_routes, reports, import_routes, export_routes, sync, audit, users, activity
)

logger = logging.getLogger("election_app")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Connect to MongoDB (Primary Production Database)
    try:
        await connect_to_mongo()
        seed_mongo_initial_data()
    except Exception as e:
        logger.error(f"MongoDB startup warning: {e}")

    # 2. SQLite / SQLAlchemy compatibility fallback
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        seed_initial_data(db)
        db.close()
    except Exception as e:
        logger.warning(f"SQLAlchemy startup note: {e}")

    yield

    # 3. Shutdown
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-grade Backend API for Election & Voter Management App with MongoDB, Marathi Electoral Roll PDF Extraction, Excel Processing, and Dual Admin/User Panels.",
    lifespan=lifespan
)

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
app.include_router(activity.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)

from app.api.admin_users import LogActivityRequest
from app.services.mongo_user_service import MongoUserService

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

    act = await MongoUserService.log_activity(
        user_id=user_id,
        username=username,
        action=payload.action,
        details=payload.details,
        target_member_id=payload.targetMemberId,
        target_member_name=payload.targetMemberName,
        metadata=meta
    )
    return {"success": True, "data": act}

@app.get("/")
def root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "database": "MongoDB 8.x (Primary)",
        "version": settings.VERSION,
        "docs_url": "/docs"
    }

@app.get(f"{settings.API_V1_STR}/health")
def api_health():
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

