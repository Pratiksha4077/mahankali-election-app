from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config.database import get_db
from app.models.models import AuditLog, User, Member, Village, Category, ImportJob, SyncHistory
from app.schemas.schemas import AuditLogResponse, DashboardStats
from app.auth.security import require_admin

router = APIRouter(prefix="/admin", tags=["Admin Dashboard & Audit Logs"])

@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    disabled_users = total_users - active_users

    total_villages = db.query(Village).count()
    total_members = db.query(Member).count()
    active_members = db.query(Member).filter(Member.status == "ACTIVE").count()
    deceased_members = db.query(Member).filter(Member.status == "DECEASED").count()
    duplicate_records = db.query(ImportJob).with_entities(func.sum(ImportJob.duplicate_records)).scalar() or 0
    pending_imports = db.query(ImportJob).filter(ImportJob.status == "pending").count()

    last_sync_record = db.query(SyncHistory).order_by(SyncHistory.last_synced_at.desc()).first()
    last_sync = last_sync_record.last_synced_at if last_sync_record else None

    # Village breakdown
    villages = db.query(Village).all()
    v_stats = []
    for v in villages:
        c = db.query(Member).filter(Member.village_id == v.id).count()
        v_stats.append({"village_id": v.id, "name_mr": v.name_mr, "name_en": v.name_en, "count": c})

    # Category breakdown
    categories = db.query(Category).all()
    c_stats = []
    for cat in categories:
        c = db.query(Member).filter(Member.category_id == cat.id).count()
        c_stats.append({"category_id": cat.id, "label": cat.label_mr, "color": cat.color_hex, "count": c})

    # Recent activities
    recent_logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(8).all()
    activities = [
        {
            "id": l.id,
            "action": l.action,
            "details": l.details,
            "timestamp": l.timestamp.isoformat(),
            "username": l.user.username if l.user else "System"
        }
        for l in recent_logs
    ]

    return {
        "total_users": total_users,
        "active_users": active_users,
        "disabled_users": disabled_users,
        "total_villages": total_villages,
        "total_members": total_members,
        "active_members": active_members,
        "deceased_members": deceased_members,
        "duplicate_records": duplicate_records,
        "pending_imports": pending_imports,
        "last_sync": last_sync,
        "members_by_village": v_stats,
        "members_by_category": c_stats,
        "recent_activities": activities
    }

@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    logs = q.order_by(AuditLog.timestamp.desc()).limit(limit).all()

    enriched = []
    for l in logs:
        enriched.append({
            "id": l.id,
            "user_id": l.user_id,
            "username": l.user.username if l.user else "System",
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "details": l.details,
            "old_values": l.old_values,
            "new_values": l.new_values,
            "ip_address": l.ip_address,
            "timestamp": l.timestamp
        })
    return enriched
