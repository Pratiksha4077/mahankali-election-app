from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse

from app.database.mongodb import get_mongo_db
from app.auth.security import get_current_user, log_activity
from app.services.mongo_member_service import MongoMemberService
from app.excel_processing.exporter import DataExporter

router = APIRouter(prefix="/admin/export", tags=["Data Export"])

@router.get("/excel")
async def export_excel(
    village_id: Optional[str] = None,
    q: Optional[str] = None,
    category_id: Optional[str] = None,
    status: Optional[str] = None,
    db = Depends(get_mongo_db),
    current_user = Depends(get_current_user)
):
    """Exports voter records directly from primary MongoDB database."""
    res = await MongoMemberService.get_members(
        village_id=village_id,
        search_query=q,
        category_id=category_id,
        status=status,
        page=1,
        limit=20000
    )
    members = res.get("items", [])

    records = []
    for m in members:
        nm = m.get("nameMarathi") or {}
        v = m.get("village") or {}
        rel = m.get("relative") or {}
        records.append({
            "serial_number": m.get("serialNumber"),
            "epic_number": m.get("epicNumber"),
            "full_name_mr": nm.get("full") if isinstance(nm, dict) else m.get("full_name_mr", ""),
            "surname": nm.get("surname") if isinstance(nm, dict) else m.get("surname", ""),
            "first_name": nm.get("first") if isinstance(nm, dict) else m.get("first_name", ""),
            "relative_name_mr": rel.get("nameMarathi") if isinstance(rel, dict) else m.get("relative_name_mr", ""),
            "relation_type": rel.get("relationType", "Father") if isinstance(rel, dict) else m.get("relation_type", "Father"),
            "house_number": m.get("houseNumber", ""),
            "age": m.get("age"),
            "gender": m.get("gender", "Male"),
            "village_mr": v.get("nameMarathi", "साखराळे") if isinstance(v, dict) else m.get("village_name_mr", "साखराळे"),
            "booth_part_number": m.get("boothPartNumber", ""),
            "mobile_number": m.get("mobileNumber", ""),
            "status": m.get("status", "ACTIVE")
        })

    file_path = DataExporter.export_to_excel(records, filename_prefix="voters_list")
    log_activity(user_id=current_user.id, action="EXPORT_EXCEL", details=f"Exported {len(records)} records from MongoDB to Excel", username=current_user.username)
    return FileResponse(
        path=str(file_path),
        filename=file_path.name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@router.get("/csv")
async def export_csv(
    village_id: Optional[str] = None,
    q: Optional[str] = None,
    category_id: Optional[str] = None,
    status: Optional[str] = None,
    db = Depends(get_mongo_db),
    current_user = Depends(get_current_user)
):
    """Exports voter records directly from primary MongoDB database in CSV format."""
    res = await MongoMemberService.get_members(
        village_id=village_id,
        search_query=q,
        category_id=category_id,
        status=status,
        page=1,
        limit=20000
    )
    members = res.get("items", [])

    records = []
    for m in members:
        nm = m.get("nameMarathi") or {}
        v = m.get("village") or {}
        rel = m.get("relative") or {}
        records.append({
            "Sr No": m.get("serialNumber"),
            "EPIC": m.get("epicNumber"),
            "Name": nm.get("full") if isinstance(nm, dict) else m.get("full_name_mr", ""),
            "Relative": rel.get("nameMarathi") if isinstance(rel, dict) else m.get("relative_name_mr", ""),
            "House": m.get("houseNumber", ""),
            "Age": m.get("age"),
            "Gender": m.get("gender", "Male"),
            "Village": v.get("nameMarathi", "साखराळे") if isinstance(v, dict) else m.get("village_name_mr", "साखराळे"),
            "Mobile": m.get("mobileNumber", ""),
            "Status": m.get("status", "ACTIVE")
        })

    file_path = DataExporter.export_to_csv(records, filename_prefix="voters_list")
    log_activity(user_id=current_user.id, action="EXPORT_CSV", details=f"Exported {len(records)} records from MongoDB to CSV", username=current_user.username)
    return FileResponse(path=str(file_path), filename=file_path.name, media_type="text/csv")
