import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form, Query
from fastapi.responses import FileResponse
from bson import ObjectId
from pydantic import BaseModel

from app.config.config import settings
from app.database.mongodb import get_mongo_db
from app.auth.security import require_admin, AuthUser, log_activity
from app.pdf_processing.pipeline import process_pdf_import_job_mongo, commit_mongo_job_records
from app.pdf_processing.mapper import FieldMapper
from app.excel_processing.reader import ExcelReader
from app.excel_processing.importer import ExcelImporter
from app.excel_processing.exporter import DataExporter

router = APIRouter(prefix="/admin/import", tags=["Admin Import Pipeline"])

async def _clear_all_voters_internal(db, admin_username: str = "admin") -> int:
    """Wipes all voter records, families, and import jobs/records across MongoDB and SQLite."""
    res_m = await db.members.delete_many({})
    await db.families.delete_many({})
    await db.import_records.delete_many({})
    await db.import_jobs.delete_many({})
    
    # Reset village counters
    await db.villages.update_many({}, {
        "$set": {
            "stats.totalVoters": 0,
            "stats.activeMembers": 0,
            "stats.deceasedMembers": 0,
            "stats.totalFamilies": 0
        }
    })

    # Clear SQLite members & families
    try:
        from app.config.database import SessionLocal
        from app.models.models import Member as SqlMember, Family as SqlFamily
        with SessionLocal() as s_db:
            s_db.query(SqlMember).delete()
            s_db.query(SqlFamily).delete()
            s_db.commit()
    except Exception:
        pass

    return res_m.deleted_count

@router.post("/clear-voters")
async def clear_all_voters(
    db = Depends(get_mongo_db),
    admin: AuthUser = Depends(require_admin)
):
    """Admin clears all voter records and import history to start fresh with real data."""
    deleted_count = await _clear_all_voters_internal(db, admin.username)
    log_activity(
        user_id=admin.id,
        action="CLEAR_ALL_VOTERS",
        details=f"Admin cleared {deleted_count} voter records from database",
        username=admin.username
    )
    return {
        "success": True,
        "message": f"सर्व मतदार डेटा यशस्वीरित्या साफ केला गेला ({deleted_count} नोंदी हटवल्या).",
        "deletedCount": deleted_count
    }

class ConfirmImportPayload(BaseModel):
    duplicateStrategy: Optional[str] = "SKIP"  # "SKIP", "UPDATE", "KEEP_BOTH"

def format_job(job: dict) -> dict:
    if not job:
        return {}
    j = dict(job)
    job_id = str(j.get("_id", ""))
    j["id"] = job_id
    j["job_id"] = job_id
    j["jobId"] = job_id
    metrics = j.get("metrics", {})
    j["records_found"] = j.get("records_found", metrics.get("totalRecords", 0))
    j["valid_records"] = j.get("valid_records", metrics.get("validRecords", 0))
    j["invalid_records"] = j.get("invalid_records", metrics.get("invalidRecords", 0))
    j["duplicate_records"] = j.get("duplicate_records", metrics.get("duplicateRecords", 0))
    j["imported_records"] = j.get("imported_records", metrics.get("importedRecords", 0))
    j["excel_file"] = j.get("excel_file") or j.get("excelDownloadUrl")
    j["excelDownloadUrl"] = j["excel_file"]
    if "_id" in j:
        del j["_id"]
    return j

@router.post("/pdf")
async def upload_and_process_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    village_id: str = Form(..., description="Target village ID for imported voter records"),
    auto_commit: bool = Form(True),
    clear_previous: bool = Form(False),
    db = Depends(get_mongo_db),
    admin: AuthUser = Depends(require_admin)
):
    """
    Admin uploads one or multiple PDF electoral rolls bound to a pre-selected village.
    Returns job_id immediately and starts 8-stage processing in background.
    """
    raise HTTPException(
        status_code=400,
        detail="PDF upload is disabled. Please upload voter data using Excel (.xlsx, .xls) or CSV (.csv) files."
    )

    # Resolve Village
    v_query = {"_id": ObjectId(village_id)} if ObjectId.is_valid(village_id) else {"_id": village_id}
    village = await db.villages.find_one(v_query)
    village_name = village.get("nameMarathi", "साखराळे") if village else "साखराळे"

    # Save uploaded file to staging
    file_path = settings.UPLOAD_DIR / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = file_path.stat().st_size

    # Create job in MongoDB
    job_doc = {
        "villageId": village_id,
        "villageName": village_name,
        "fileName": file.filename,
        "fileType": "PDF",
        "fileSize": file_size,
        "totalPages": 0,
        "status": "QUEUED",
        "progress": 0,
        "currentStage": "File uploaded",
        "stages": [
            {"name": "File uploaded", "completed": True},
            {"name": "PDF analyzed", "completed": False},
            {"name": "Text extracted", "completed": False},
            {"name": "Records detected", "completed": False},
            {"name": "Validating", "completed": False},
            {"name": "Duplicate checking", "completed": False},
            {"name": "Generating Excel", "completed": False},
            {"name": "Importing database", "completed": False}
        ],
        "metrics": {
            "totalRecords": 0,
            "validRecords": 0,
            "invalidRecords": 0,
            "duplicateRecords": 0,
            "importedRecords": 0
        },
        "excelDownloadUrl": None,
        "errorReportUrl": None,
        "uploadedBy": admin.username,
        "createdAt": datetime.utcnow()
    }

    res = await db.import_jobs.insert_one(job_doc)
    job_id = str(res.inserted_id)

    log_activity(
        user_id=admin.id,
        action="UPLOAD_PDF",
        entity_type="IMPORT_JOB",
        entity_id=job_id,
        details=f"Uploaded {file.filename} for village {village_name}",
        username=admin.username
    )

    # Launch background task
    background_tasks.add_task(
        process_pdf_import_job_mongo,
        job_id=job_id,
        village_id=village_id,
        uploaded_by=admin.username,
        auto_commit_db=auto_commit
    )

    return {
        "success": True,
        "job_id": job_id,
        "jobId": job_id,
        "status": "QUEUED",
        "fileName": file.filename,
        "villageId": village_id,
        "villageName": village_name,
        "fileSize": file_size,
        "message": "PDF import job created. Processing initiated in background."
    }

@router.post("/excel")
async def upload_and_process_excel(
    file: UploadFile = File(...),
    village_id: str = Form(...),
    clear_previous: bool = Form(False),
    db = Depends(get_mongo_db),
    admin: AuthUser = Depends(require_admin)
):
    """Admin uploads Excel or CSV for a village with automatic record commitment.
    The filename number (e.g., 61.xlsx) is used as the matdan kendra (polling booth) number.
    Required Marathi fields: मतदार ओळखपत्र क्र., मतदाराचे पूर्ण नाव, वडिलाचे / पतीचे नाव, घर क्रमांक, वय, लिंग.
    """
    import re as _re
    ext = Path(file.filename).suffix.lower()
    if ext not in [".xlsx", ".xls", ".csv"]:
        raise HTTPException(status_code=400, detail="Only .xlsx, .xls, and .csv files are supported")

    if clear_previous:
        await _clear_all_voters_internal(db, admin.username)

    file_path = settings.UPLOAD_DIR / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = file_path.stat().st_size
    raw_rows = ExcelReader.read_file(file_path)

    # Extract booth/part number from filename (e.g., "61.xlsx" => "61", "booth_62.csv" => "62")
    stem = Path(file.filename).stem
    booth_match = _re.search(r'\d+', stem)
    booth_number_from_filename = booth_match.group(0) if booth_match else stem

    v_query = {"_id": ObjectId(village_id)} if ObjectId.is_valid(village_id) else {"_id": village_id}
    village = await db.villages.find_one(v_query)
    village_name = village.get("nameMarathi", "साखराळे") if village else "साखराळे"
    village_name_en = village.get("name", "Sakharele") if village else "Sakharele"

    # Create job in MongoDB
    job_doc = {
        "villageId": village_id,
        "villageName": village_name,
        "fileName": file.filename,
        "boothPartNumber": booth_number_from_filename,
        "fileType": "EXCEL" if ext != ".csv" else "CSV",
        "fileSize": file_size,
        "totalPages": 1,
        "status": "PROCESSING",
        "progress": 50,
        "currentStage": "Processing records",
        "metrics": {
            "totalRecords": len(raw_rows),
            "validRecords": 0,
            "invalidRecords": 0,
            "duplicateRecords": 0,
            "importedRecords": 0
        },
        "excelDownloadUrl": None,
        "uploadedBy": admin.username,
        "createdAt": datetime.utcnow()
    }
    res = await db.import_jobs.insert_one(job_doc)
    job_id = str(res.inserted_id)

    # Insert mapped intermediate records with booth number from filename
    mapper = FieldMapper()
    import_records = []
    valid_count = 0
    invalid_count = 0

    for idx, row in enumerate(raw_rows):
        mapped = mapper.map_record(row)

        # Inject booth number from filename if not already set from Excel
        if not mapped.get("booth_part_number"):
            mapped["booth_part_number"] = booth_number_from_filename

        # Mark the village name from db if not in Excel
        if not mapped.get("village_mr"):
            mapped["village_mr"] = village_name

        # A record is valid if it has EPIC number OR full name
        is_valid = bool(mapped.get("epic_number") or mapped.get("full_name_mr") or mapped.get("full_name_en"))
        if is_valid:
            valid_count += 1
        else:
            invalid_count += 1

        import_records.append({
            "jobId": job_id,
            "rowIndex": idx + 1,
            "parsedData": mapped,
            "rawData": row,
            "status": "VALID" if is_valid else "INVALID",
            "isDuplicate": False
        })

    if import_records:
        await db.import_records.insert_many(import_records)

    # Update job metrics
    await db.import_jobs.update_one(
        {"_id": res.inserted_id},
        {"$set": {
            "metrics.validRecords": valid_count,
            "metrics.invalidRecords": invalid_count,
        }}
    )

    # Auto-commit to members collection so voters are immediately live
    imported_count = commit_mongo_job_records(job_id, duplicate_strategy="UPDATE")

    # Final job status update
    await db.import_jobs.update_one(
        {"_id": res.inserted_id},
        {"$set": {
            "status": "COMPLETED",
            "progress": 100,
            "currentStage": "Completed",
            "metrics.importedRecords": imported_count
        }}
    )

    # Update village stats
    try:
        total_v = await db.members.count_documents({"village.id": village_id})
        active_v = await db.members.count_documents({"village.id": village_id, "status": "ACTIVE"})
        oid_q = {"_id": ObjectId(village_id)} if ObjectId.is_valid(village_id) else {"_id": village_id}
        await db.villages.update_one(
            oid_q,
            {"$set": {
                "stats.totalVoters": total_v,
                "stats.activeMembers": active_v,
                "updatedAt": datetime.utcnow()
            }}
        )
    except Exception:
        pass

    log_activity(
        user_id=admin.id,
        action="UPLOAD_EXCEL",
        entity_type="IMPORT_JOB",
        entity_id=job_id,
        details=f"Uploaded {file.filename} (Booth: {booth_number_from_filename}) with {imported_count} live records for {village_name}",
        username=admin.username
    )

    return {
        "success": True,
        "job_id": job_id,
        "jobId": job_id,
        "total": len(raw_rows),
        "valid": valid_count,
        "invalid": invalid_count,
        "importedCount": imported_count,
        "boothPartNumber": booth_number_from_filename,
        "villageName": village_name,
        "status": "COMPLETED",
        "message": f"Excel parsed and {imported_count} real voter records added to database (Booth: {booth_number_from_filename})."
    }


@router.get("/jobs")
async def list_import_jobs(
    db = Depends(get_mongo_db),
    admin: AuthUser = Depends(require_admin)
):
    """List recent import jobs for Admin."""
    cursor = db.import_jobs.find({}).sort("createdAt", -1).limit(50)
    jobs = []
    async for j in cursor:
        jobs.append(format_job(j))
    return {"success": True, "data": jobs}

@router.get("/jobs/{job_id}")
async def get_import_job_status(
    job_id: str,
    db = Depends(get_mongo_db),
    admin: AuthUser = Depends(require_admin)
):
    """Poll live progress and stage of an import job."""
    query = {"_id": ObjectId(job_id)} if ObjectId.is_valid(job_id) else {"_id": job_id}
    job = await db.import_jobs.find_one(query)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    return {"success": True, "data": format_job(job), **format_job(job)}

@router.get("/jobs/{job_id}/preview")
async def get_import_job_preview(
    job_id: str,
    limit: int = 50,
    db = Depends(get_mongo_db),
    admin: AuthUser = Depends(require_admin)
):
    """Preview parsed rows and metrics before committing to MongoDB."""
    query = {"_id": ObjectId(job_id)} if ObjectId.is_valid(job_id) else {"_id": job_id}
    job = await db.import_jobs.find_one(query)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")

    cursor = db.import_records.find({"jobId": job_id}).limit(limit)
    rows = []
    async for r in cursor:
        pdata = r.get("parsedData", {})
        pdata["status"] = r.get("status", "VALID")
        pdata["errors"] = r.get("errors", [])
        pdata["row_index"] = r.get("rowIndex", 0)
        pdata["full_name"] = pdata.get("full_name_mr") or pdata.get("full_name_en", "")
        rows.append(pdata)

    metrics = job.get("metrics", {})
    records_found = job.get("records_found", metrics.get("totalRecords", len(rows)))
    valid_records = job.get("valid_records", metrics.get("validRecords", len(rows)))

    return {
        "success": True,
        "job_id": job_id,
        "status": job.get("status"),
        "records_found": records_found,
        "valid_records": valid_records,
        "invalid_records": job.get("invalid_records", metrics.get("invalidRecords", 0)),
        "duplicate_records": job.get("duplicate_records", metrics.get("duplicateRecords", 0)),
        "excel_file": job.get("excel_file") or job.get("excelDownloadUrl"),
        "metrics": metrics,
        "sample_rows": rows,
        "preview_rows": rows
    }

@router.get("/jobs/{job_id}/excel")
async def download_job_excel(
    job_id: str,
    db = Depends(get_mongo_db),
    admin: AuthUser = Depends(require_admin)
):
    """Download the generated bilingual Excel workbook produced from the PDF."""
    query = {"_id": ObjectId(job_id)} if ObjectId.is_valid(job_id) else {"_id": job_id}
    job = await db.import_jobs.find_one(query)
    excel_url = job.get("excel_file") or job.get("excelDownloadUrl") if job else None
    if not job or not excel_url:
        raise HTTPException(status_code=404, detail="Excel file not yet generated or job not found")

    rel_path = excel_url.replace("/static/processed/", "")
    file_path = settings.PROCESSED_DIR / rel_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Generated Excel file not found on disk")

    return FileResponse(
        path=str(file_path),
        filename=rel_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@router.post("/jobs/{job_id}/commit")
@router.post("/jobs/{job_id}/confirm")
async def confirm_job_import(
    job_id: str,
    payload: Optional[ConfirmImportPayload] = None,
    db = Depends(get_mongo_db),
    admin: AuthUser = Depends(require_admin)
):
    """Commit verified records from import job into MongoDB `members`."""
    strategy = payload.duplicateStrategy if payload else "SKIP"
    imported = commit_mongo_job_records(job_id, duplicate_strategy=strategy)

    log_activity(
        user_id=admin.id,
        action="IMPORT_DATA",
        entity_type="IMPORT_JOB",
        entity_id=job_id,
        details=f"Committed {imported} voter records into database with duplicate strategy {strategy}",
        username=admin.username
    )

    return {
        "success": True,
        "message": f"Successfully imported {imported} voter records into MongoDB",
        "importedCount": imported,
        "imported_records": imported
    }

@router.delete("/jobs/{job_id}")
async def delete_import_job(
    job_id: str,
    delete_voters: bool = Query(True, description="Also delete voter records created by this import job"),
    db = Depends(get_mongo_db),
    admin: AuthUser = Depends(require_admin)
):
    """Delete an import job record and its associated import_records from history,
    and remove the imported voter records so the database stays clean.
    """
    query = {"_id": ObjectId(job_id)} if ObjectId.is_valid(job_id) else {"_id": job_id}
    job = await db.import_jobs.find_one(query)
    if not job:
        job = await db.import_jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")

    real_id_str = str(job.get("_id", job_id))

    # 1. Delete the import job document
    await db.import_jobs.delete_one({"_id": job["_id"]})

    # 2. Delete associated import records (preview data)
    await db.import_records.delete_many({"$or": [{"jobId": job_id}, {"jobId": real_id_str}]})

    deleted_voters = 0
    if delete_voters:
        # 3. Delete members created by this specific job
        res_m = await db.members.delete_many({
            "$or": [
                {"source.importJobId": job_id},
                {"source.importJobId": real_id_str},
                {"source.fileName": job.get("fileName")}
            ]
        })
        deleted_voters = res_m.deleted_count

        # 4. Update village stats
        village_id = job.get("villageId")
        if village_id:
            try:
                tot = await db.members.count_documents({"village.id": village_id})
                act = await db.members.count_documents({"village.id": village_id, "status": "ACTIVE"})
                v_q = {"_id": ObjectId(village_id)} if ObjectId.is_valid(village_id) else {"_id": village_id}
                await db.villages.update_one(v_q, {"$set": {"stats.totalVoters": tot, "stats.activeMembers": act}})
            except Exception:
                pass

    log_activity(
        user_id=admin.id,
        action="DELETE_IMPORT_JOB",
        entity_type="IMPORT_JOB",
        entity_id=job_id,
        details=f"Deleted import job {job.get('fileName', 'unknown')} and removed {deleted_voters} voter records",
        username=admin.username
    )

    return {
        "success": True,
        "message": f"इम्पोर्ट जॉब यशस्वीरित्या हटवला गेला ({deleted_voters} मतदार नोंदी हटवल्या).",
        "deletedJobId": job_id,
        "deletedVotersCount": deleted_voters
    }

