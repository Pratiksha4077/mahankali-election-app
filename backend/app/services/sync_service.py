from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.models import Member, SyncHistory, Village
from app.auth.security import log_activity

class SyncService:

    @staticmethod
    def quick_sync(db: Session, user_id: str, since_timestamp: Optional[datetime], modified_client_records: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        pushed_count = 0
        pulled_count = 0

        # 1. Apply any client offline modifications
        if modified_client_records:
            for rec in modified_client_records:
                m_id = rec.get("id")
                if m_id:
                    member = db.query(Member).filter(Member.id == m_id).first()
                    if member:
                        if "mobile_number" in rec:
                            member.mobile_number = rec["mobile_number"]
                        if "address" in rec:
                            member.address = rec["address"]
                        if "category_id" in rec:
                            member.category_id = rec["category_id"]
                        if "status" in rec:
                            member.status = rec["status"]
                        member.updated_at = datetime.utcnow()
                        pushed_count += 1
            db.commit()

        # 2. Pull server changes since timestamp
        q = db.query(Member)
        if since_timestamp:
            q = q.filter(Member.updated_at > since_timestamp)
        updated_members = q.limit(500).all()
        pulled_count = len(updated_members)

        # 3. Record SyncHistory
        now = datetime.utcnow()
        history = SyncHistory(
            user_id=user_id,
            sync_type="QUICK",
            status="SUCCESS",
            records_pulled=pulled_count,
            records_pushed=pushed_count,
            last_synced_at=now
        )
        db.add(history)
        db.commit()

        log_activity(
            db=db,
            user_id=user_id,
            action="QUICK_SYNC",
            details=f"Synced {pulled_count} records down, {pushed_count} up"
        )

        return {
            "synced_at": now,
            "pulled_count": pulled_count,
            "pushed_count": pushed_count,
            "updated_members": updated_members
        }

    @staticmethod
    def full_sync(db: Session, user_id: str) -> Dict[str, Any]:
        now = datetime.utcnow()
        # Fetch all active records (capped at 2000 for initial chunk, paginable)
        all_members = db.query(Member).filter(Member.status == "ACTIVE").limit(2000).all()

        history = SyncHistory(
            user_id=user_id,
            sync_type="FULL",
            status="SUCCESS",
            records_pulled=len(all_members),
            records_pushed=0,
            last_synced_at=now
        )
        db.add(history)
        db.commit()

        log_activity(
            db=db,
            user_id=user_id,
            action="FULL_RESYNC",
            details=f"Full re-downloaded {len(all_members)} voter records"
        )

        return {
            "synced_at": now,
            "pulled_count": len(all_members),
            "pushed_count": 0,
            "updated_members": all_members
        }

    @staticmethod
    def get_sync_status(db: Session, user_id: str) -> Optional[SyncHistory]:
        return db.query(SyncHistory).filter(SyncHistory.user_id == user_id).order_by(SyncHistory.last_synced_at.desc()).first()
