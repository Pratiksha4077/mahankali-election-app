from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, asc

from app.models.models import Member, Village, Category, AuditLog, Family
from app.schemas.schemas import MemberCreate, MemberUpdate
from app.auth.security import log_activity

class MemberService:

    @staticmethod
    def get_members(
        db: Session,
        query: Optional[str] = None,
        village_id: Optional[str] = None,
        category_id: Optional[str] = None,
        status: Optional[str] = None,
        assigned_user_id: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
        sort_by: str = "serial_number",
        sort_order: str = "asc"
    ) -> Tuple[int, List[Member]]:
        q = db.query(Member)

        if village_id:
            q = q.filter(Member.village_id == village_id)

        if category_id:
            q = q.filter(Member.category_id == category_id)

        if status:
            q = q.filter(Member.status == status)

        if assigned_user_id:
            q = q.filter(Member.assigned_user_id == assigned_user_id)

        if query and query.strip():
            term = f"%{query.strip()}%"
            q = q.filter(
                or_(
                    Member.full_name_mr.ilike(term),
                    Member.full_name_en.ilike(term),
                    Member.epic_number.ilike(term),
                    Member.mobile_number.ilike(term),
                    Member.relative_name_mr.ilike(term),
                    Member.house_number.ilike(term)
                )
            )

        # Sorting
        sort_col = getattr(Member, sort_by, Member.serial_number)
        if sort_order.lower() == "desc":
            q = q.order_by(desc(sort_col))
        else:
            q = q.order_by(asc(sort_col))

        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()
        return total, items

    @staticmethod
    def get_member_by_id(db: Session, member_id: str) -> Optional[Member]:
        return db.query(Member).filter(Member.id == member_id).first()

    @staticmethod
    def get_member_family(db: Session, member: Member) -> List[Member]:
        """Finds related family members by family_id or same house_number and village."""
        if member.family_id:
            return db.query(Member).filter(Member.family_id == member.family_id, Member.id != member.id).all()
        elif member.house_number and member.village_id:
            return db.query(Member).filter(
                Member.village_id == member.village_id,
                Member.house_number == member.house_number,
                Member.id != member.id
            ).all()
        return []

    @staticmethod
    def update_member(db: Session, member_id: str, update_data: MemberUpdate, current_user_id: str = None) -> Optional[Member]:
        member = db.query(Member).filter(Member.id == member_id).first()
        if not member:
            return None

        old_values = {
            "mobile_number": member.mobile_number,
            "address": member.address,
            "religion": member.religion,
            "caste": member.caste,
            "designation": member.designation,
            "profession": member.profession,
            "category_id": member.category_id,
            "status": member.status
        }

        update_dict = update_data.model_dump(exclude_unset=True)
        for key, val in update_dict.items():
            setattr(member, key, val)

        member.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(member)

        # Log audit trail
        log_activity(
            db=db,
            user_id=current_user_id,
            action="UPDATE_MEMBER",
            entity_type="MEMBER",
            entity_id=member.id,
            details=f"Updated details for member {member.full_name_mr}",
            old_values=old_values,
            new_values=update_dict
        )

        return member

    @staticmethod
    def toggle_deceased(db: Session, member_id: str, is_deceased: bool, current_user_id: str = None) -> Optional[Member]:
        member = db.query(Member).filter(Member.id == member_id).first()
        if not member:
            return None

        old_status = member.status
        if is_deceased:
            member.status = "DECEASED"
            member.deceased_date = datetime.utcnow()
            member.deceased_recorded_by = current_user_id
        else:
            member.status = "ACTIVE"
            member.deceased_date = None
            member.deceased_recorded_by = None

        member.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(member)

        # Update village count
        if member.village_id:
            village = db.query(Village).filter(Village.id == member.village_id).first()
            if village:
                village.active_voters = db.query(Member).filter(Member.village_id == village.id, Member.status == "ACTIVE").count()
                village.deceased_voters = db.query(Member).filter(Member.village_id == village.id, Member.status == "DECEASED").count()
                db.commit()

        log_activity(
            db=db,
            user_id=current_user_id,
            action="MARK_DECEASED" if is_deceased else "UNMARK_DECEASED",
            entity_type="MEMBER",
            entity_id=member.id,
            details=f"Status changed from {old_status} to {member.status}",
            old_values={"status": old_status},
            new_values={"status": member.status}
        )

        return member

    @staticmethod
    def set_category(db: Session, member_id: str, category_id: Optional[str], current_user_id: str = None) -> Optional[Member]:
        member = db.query(Member).filter(Member.id == member_id).first()
        if not member:
            return None

        old_cat = member.category_id
        member.category_id = category_id
        member.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(member)

        log_activity(
            db=db,
            user_id=current_user_id,
            action="CHANGE_CATEGORY",
            entity_type="MEMBER",
            entity_id=member.id,
            details=f"Category changed to {category_id}",
            old_values={"category_id": old_cat},
            new_values={"category_id": category_id}
        )

        return member
