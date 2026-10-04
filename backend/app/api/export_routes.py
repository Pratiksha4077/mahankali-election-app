from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.auth.security import get_current_user, log_activity
from app.services.member_service import MemberService
from app.excel_processing.exporter import DataExporter

router = APIRouter(prefix="/admin/export", tags=["Data Export"])

@router.get("/excel")
def export_excel(
    village_id: Optional[str] = None,
    q: Optional[str] = None,
    category_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    _, members = MemberService.get_members(
        db, query=q, village_id=village_id, category_id=category_id, status=status, page=1, limit=10000
    )

    records = []
    for m in members:
        records.append({
            "serial_number": m.serial_number,
            "epic_number": m.epic_number,
            "full_name_mr": m.full_name_mr,
            "surname": m.surname,
            "first_name": m.first_name,
            "relative_name_mr": m.relative_name_mr,
            "relation_type": m.relation_type,
            "house_number": m.house_number,
            "age": m.age,
            "gender": m.gender,
            "village_mr": m.village.name_mr if m.village else "",
            "booth_part_number": m.booth_part_number,
            "mobile_number": m.mobile_number,
            "status": m.status
        })

    file_path = DataExporter.export_to_excel(records, filename_prefix="voters_list")
    log_activity(db, user_id=current_user.id, action="EXPORT_EXCEL", details=f"Exported {len(records)} records to Excel")
    return FileResponse(
        path=str(file_path),
        filename=file_path.name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@router.get("/csv")
def export_csv(
    village_id: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    _, members = MemberService.get_members(db, query=q, village_id=village_id, page=1, limit=10000)

    records = [
        {
            "Sr No": m.serial_number,
            "EPIC": m.epic_number,
            "Name": m.full_name_mr,
            "Relative": m.relative_name_mr,
            "House": m.house_number,
            "Age": m.age,
            "Gender": m.gender,
            "Village": m.village.name_mr if m.village else "",
            "Mobile": m.mobile_number,
            "Status": m.status
        }
        for m in members
    ]

    file_path = DataExporter.export_to_csv(records, filename_prefix="voters_list")
    log_activity(db, user_id=current_user.id, action="EXPORT_CSV", details=f"Exported {len(records)} records to CSV")
    return FileResponse(path=str(file_path), filename=file_path.name, media_type="text/csv")
