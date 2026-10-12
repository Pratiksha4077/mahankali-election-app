import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends
from app.auth.security import require_admin, AuthUser
from app.database.mongodb import get_mongo_db

router = APIRouter(prefix="/admin", tags=["Admin Dashboard & Analytics"])

@router.get("/dashboard")
async def get_admin_dashboard(admin: AuthUser = Depends(require_admin)):
    """Executive metrics cards for Admin Dashboard computed concurrently from MongoDB."""
    db = get_mongo_db()

    base_member_filter = {"isDeleted": {"$ne": True}}
    base_user_filter = {"isDeleted": {"$ne": True}}

    # Run all 11 count and aggregate operations in parallel for < 200ms response time
    (
        total_voters,
        active_members,
        dead_records,
        total_villages,
        total_families,
        app_users,
        active_users,
        disabled_users,
        pending_jobs,
        dup_res,
        latest_job
    ) = await asyncio.gather(
        db.members.count_documents(base_member_filter),
        db.members.count_documents({**base_member_filter, "status": "ACTIVE"}),
        db.members.count_documents({**base_member_filter, "status": "DECEASED"}),
        db.villages.count_documents({"isDeleted": {"$ne": True}}),
        db.families.count_documents({"isDeleted": {"$ne": True}}),
        db.users.count_documents(base_user_filter),
        db.users.count_documents({**base_user_filter, "accountStatus": "ACTIVE"}),
        db.users.count_documents({**base_user_filter, "accountStatus": "DISABLED"}),
        db.import_jobs.count_documents({"status": {"$in": ["QUEUED", "PROCESSING"]}}),
        db.import_jobs.aggregate([
            {"$group": {"_id": None, "totalDups": {"$sum": "$metrics.duplicateRecords"}, "totalImported": {"$sum": "$metrics.importedRecords"}}}
        ]).to_list(length=1),
        db.import_jobs.find_one({}, sort=[("createdAt", -1)])
    )

    total_dups = dup_res[0]["totalDups"] if dup_res else 0
    total_imported = dup_res[0]["totalImported"] if dup_res else total_voters
    last_update = latest_job["createdAt"].isoformat() if latest_job else datetime.utcnow().isoformat()

    stats_data = {
        "totalVoters": total_voters,
        "total_members": total_voters,
        "totalVillages": total_villages,
        "total_villages": total_villages,
        "activeMembers": active_members,
        "active_members": active_members,
        "deadRecords": dead_records,
        "deceased_members": dead_records,
        "appUsers": app_users,
        "total_users": app_users,
        "activeAppUsers": active_users,
        "active_users": active_users,
        "disabledAppUsers": disabled_users,
        "disabled_users": disabled_users,
        "totalFamilies": total_families if total_families > 0 else max(1, total_voters // 3),
        "importedRecords": total_imported,
        "duplicateRecords": total_dups,
        "pendingImportJobs": pending_jobs,
        "lastDataUpdate": last_update
    }

    return {
        "success": True,
        "data": stats_data,
        **stats_data
    }

@router.get("/analytics")
async def get_admin_analytics(admin: AuthUser = Depends(require_admin)):
    """Chart breakdown data for village and category color distributions."""
    db = get_mongo_db()

    v_coro = db.members.aggregate([
        {"$group": {
            "_id": "$village.nameMarathi",
            "name": {"$first": "$village.nameMarathi"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]).to_list(length=100)

    c_coro = db.members.aggregate([
        {"$match": {"status": "ACTIVE"}},
        {"$group": {
            "_id": "$category.color",
            "name": {"$first": "$category.nameMarathi"},
            "color": {"$first": "$category.color"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]).to_list(length=100)

    async def get_recent_jobs():
        cursor = db.import_jobs.find({}).sort("createdAt", -1).limit(5)
        jobs = []
        async for j in cursor:
            j["id"] = str(j["_id"])
            del j["_id"]
            jobs.append(j)
        return jobs

    villages, categories, recent_jobs = await asyncio.gather(
        v_coro,
        c_coro,
        get_recent_jobs()
    )

    return {
        "success": True,
        "data": {
            "villageDistribution": villages,
            "categoryDistribution": categories,
            "recentJobs": recent_jobs
        }
    }
