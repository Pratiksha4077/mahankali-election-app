from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models.models import Member, Village, Category

class ReportService:

    @staticmethod
    def get_alphabetical_report(
        db: Session,
        village_id: Optional[str] = None,
        letter: Optional[str] = None,
        page: int = 1,
        limit: int = 50
    ) -> Dict[str, Any]:
        q = db.query(Member)
        if village_id:
            q = q.filter(Member.village_id == village_id)
        if letter and letter.strip():
            char = letter.strip()
            # Supports English A-Z or Marathi initial char
            q = q.filter(
                or_(
                    Member.full_name_mr.startswith(char),
                    Member.full_name_en.startswith(char),
                    Member.surname.startswith(char)
                )
            )

        total = q.count()
        items = q.order_by(Member.full_name_mr.asc()).offset((page - 1) * limit).limit(limit).all()
        return {"total": total, "items": items}

    @staticmethod
    def get_village_summary_report(db: Session) -> List[Dict[str, Any]]:
        villages = db.query(Village).all()
        results = []
        for v in villages:
            total = db.query(Member).filter(Member.village_id == v.id).count()
            active = db.query(Member).filter(Member.village_id == v.id, Member.status == "ACTIVE").count()
            deceased = db.query(Member).filter(Member.village_id == v.id, Member.status == "DECEASED").count()
            with_mobile = db.query(Member).filter(Member.village_id == v.id, Member.mobile_number != None, Member.mobile_number != "").count()
            results.append({
                "village_id": v.id,
                "name_mr": v.name_mr,
                "name_en": v.name_en,
                "total_voters": total,
                "active_voters": active,
                "deceased_voters": deceased,
                "with_mobile_voters": with_mobile
            })
        return results

    @staticmethod
    def get_grouped_report(
        db: Session,
        group_by_field: str,
        village_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Generic aggregator for Surname, Religion, Caste, Designation, Profession, Color Rating, Mobile Status.
        """
        col = getattr(Member, group_by_field, None)
        if not col:
            return []

        q = db.query(
            col.label("key"),
            func.count(Member.id).label("count")
        )
        if village_id:
            q = q.filter(Member.village_id == village_id)

        rows = q.group_by(col).order_by(func.count(Member.id).desc()).limit(limit).all()
        return [{"name": r.key or "Unspecified (अनिर्दिष्ट)", "count": r.count} for r in rows]

    @staticmethod
    def get_family_report(db: Session, village_id: Optional[str] = None, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        """Groups voters by house_number and village."""
        q = db.query(Member.house_number).filter(Member.house_number != None, Member.house_number != "-")
        if village_id:
            q = q.filter(Member.village_id == village_id)

        house_numbers = [r[0] for r in q.distinct().limit(limit).offset((page - 1) * limit).all()]

        families = []
        for h_no in house_numbers:
            fq = db.query(Member).filter(Member.house_number == h_no)
            if village_id:
                fq = fq.filter(Member.village_id == village_id)
            members = fq.all()
            families.append({
                "house_number": h_no,
                "member_count": len(members),
                "members": members
            })

        return {"total_families": len(families), "families": families}

    @staticmethod
    def get_deceased_report(db: Session, village_id: Optional[str] = None, page: int = 1, limit: int = 50) -> Dict[str, Any]:
        q = db.query(Member).filter(Member.status == "DECEASED")
        if village_id:
            q = q.filter(Member.village_id == village_id)
        total = q.count()
        items = q.order_by(Member.deceased_date.desc()).offset((page - 1) * limit).limit(limit).all()
        return {"total": total, "items": items}
