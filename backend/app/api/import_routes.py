import uuid
import re
import shutil
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from psycopg2.extras import RealDictCursor

from app.config.config import settings
from app.auth.security import require_admin, AuthUser, log_activity
from app.services.supabase_service import get_supabase_conn, SupabaseVoterImportService, SAKHARALE_VILLAGE_ID
from app.services.cloudinary_service import CloudinaryService
from app.services.cache_service import CacheService

logger = logging.getLogger("election_app.import")

router = APIRouter(prefix="/admin/import", tags=["Admin Import Pipeline"])

class DatabaseCleanupRequest(BaseModel):
    clear_voters: bool = True
    clear_import_history: bool = True
    clear_activity_logs: bool = False
    delete_cloudinary_files: bool = True

def format_job_row(j: Dict[str, Any]) -> Dict[str, Any]:
    tot = j.get("total_records") or 0
    val = j.get("valid_records") or 0
    imp = j.get("imported_records") or 0
    dup = j.get("duplicate_records") or 0
    inv = j.get("invalid_records") or 0
    created = j.get("created_at")
    created_str = created.isoformat() if created and hasattr(created, "isoformat") else str(created or "")
    
    return {
        "id": str(j.get("id")),
        "jobId": str(j.get("id")),
        "_id": str(j.get("id")),
        "fileName": j.get("file_name"),
        "fileType": j.get("file_type", "EXCEL"),
        "fileSize": j.get("file_size", 0),
        "status": j.get("status", "completed"),
        "progress": j.get("progress", 100),
        "currentStage": j.get("stage", "Completed"),
        "stage": j.get("stage", "Completed"),
        "totalRecords": tot,
        "validRecords": val,
        "importedRecords": imp,
        "duplicateRecords": dup,
        "invalidRecords": inv,
        "total_records": tot,
        "valid_records": val,
        "imported_records": imp,
        "duplicate_records": dup,
        "invalid_records": inv,
        "cloudinaryUrl": j.get("cloudinary_url") or "",
        "excel_file": None,
        "excelDownloadUrl": None,
        "createdAt": created_str,
        "metrics": {
            "totalRecords": tot,
            "validRecords": val,
            "importedRecords": imp,
            "duplicateRecords": dup,
            "invalidRecords": inv
        }
    }

# ==============================================================================
# DATABASE CLEANUP ENDPOINTS
# ==============================================================================

@router.post("/cleanup")
async def safe_database_cleanup(
    req: DatabaseCleanupRequest,
    admin: AuthUser = Depends(require_admin)
):
    """
    Authorized Admin safe database cleanup:
    - Wipes voters from Supabase PostgreSQL (leaf records first).
    - Wipes Cloudinary assets under folder 'election_app'.
    - Preserves all 4 users and Sakharale village master.
    - Verifies deletion and returns detailed metrics.
    """
    logger.info(f"Admin {admin.username} initiated database cleanup: {req}")
    res = SupabaseVoterImportService.cleanup_database(
        clear_voters=req.clear_voters,
        clear_import_history=req.clear_import_history,
        clear_activity_logs=req.clear_activity_logs,
        delete_cloudinary_files=req.delete_cloudinary_files
    )

    CacheService.invalidate_voter_cache()
    CacheService.invalidate_all_reports()

    log_activity(
        user_id=admin.id,
        action="DATABASE_CLEANUP",
        entity_type="SYSTEM",
        details=(
            f"Admin performed database cleanup. Supabase voters deleted: {res.get('voters_deleted', 0)}, "
            f"Cloudinary files deleted: {res.get('cloudinary_files_deleted', 0)}, Verified: {res.get('verified')}"
        ),
        username=admin.username
    )

    summary = {
        "mongo_voters_deleted": res.get("voters_deleted", 0),
        "mongo_voters_remaining": res.get("voters_remaining", 0),
        "supabase_voters_deleted": res.get("voters_deleted", 0),
        "supabase_voters_remaining": res.get("voters_remaining", 0),
        "jobs_deleted": res.get("jobs_deleted", 0),
        "files_deleted": res.get("files_deleted", 0),
        "activity_logs_deleted": res.get("logs_deleted", 0),
        "cloudinary_files_deleted": res.get("cloudinary_files_deleted", 0),
        "verified": res.get("verified", True),
        "supabase_status": "SUCCESS" if res.get("success") else "ERROR",
        "errors": [res["error"]] if res.get("error") else []
    }

    return {
        "success": res.get("success", True),
        "message": "डेटाबेस आणि Cloudinary फाईल्स यशस्वीरित्या स्वच्छ केल्या गेल्या आहेत.",
        "summary": summary,
        **summary
    }

@router.post("/clear-voters")
@router.post("/clear-all-voters")
async def clear_all_voters(
    admin: AuthUser = Depends(require_admin)
):
    """Admin clears all voter records, import history, and Cloudinary files to start fresh."""
    req = DatabaseCleanupRequest(
        clear_voters=True,
        clear_import_history=True,
        clear_activity_logs=False,
        delete_cloudinary_files=True
    )
    return await safe_database_cleanup(req, admin)

# ==============================================================================
# FILE UPLOAD & PROCESSING (EXCEL / CSV)
# ==============================================================================

def _process_import_in_background(
    file_path: Path,
    file_name: str,
    file_size: int,
    village_id: str,
    username: str,
    admin_id: str,
    job_uuid: str,
    file_uuid: str
):
    """Background worker task to import voters without blocking the HTTP request."""
    try:
        import_res = SupabaseVoterImportService.import_excel_file(
            file_path=file_path,
            file_name=file_name,
            file_size=file_size,
            village_id=village_id,
            uploaded_by=username,
            job_uuid=job_uuid,
            file_uuid=file_uuid
        )
        CacheService.invalidate_voter_cache()
        CacheService.invalidate_all_reports()
        log_activity(
            user_id=admin_id,
            action="IMPORT_EXCEL",
            entity_type="IMPORT_JOB",
            entity_id=job_uuid,
            details=f"Imported {import_res.get('imported_records', 0)} voters from {file_name} into Supabase",
            username=username
        )
        logger.info(f"[BackgroundImport] Successfully imported {file_name} (Job: {job_uuid})")
    except Exception as e:
        logger.error(f"[BackgroundImport] Error importing {file_name}: {e}")
        try:
            conn = get_supabase_conn()
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE public.import_jobs
                    SET status = 'failed', stage = %s, updated_at = NOW()
                    WHERE id = %s;
                """, (f"त्रुटी: {str(e)[:100]}", job_uuid))
                cur.execute("""
                    UPDATE public.uploaded_files
                    SET status = 'FAILED'
                    WHERE id = %s;
                """, (file_uuid,))
            conn.close()
        except Exception:
            pass

@router.post("/excel")
@router.post("/upload")
async def upload_and_process_excel(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    village_id: Optional[str] = Form(None),
    clear_previous: bool = Form(False),
    admin: AuthUser = Depends(require_admin)
):
    """
    Admin uploads Excel or CSV file.
    - Saves original file to disk immediately.
    - Creates import job in Supabase.
    - Dispatches ultra-fast background processing (zero HTTP timeouts).
    - Returns job ID within 150ms.
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in [".xlsx", ".xls", ".csv"]:
        raise HTTPException(status_code=400, detail="फक्त .xlsx, .xls किंवा .csv फाईल्स समर्थित आहेत.")

    if clear_previous:
        SupabaseVoterImportService.clear_all_voters()

    file_path = settings.UPLOAD_DIR / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = file_path.stat().st_size
    target_village_id = village_id or SAKHARALE_VILLAGE_ID
    job_uuid = str(uuid.uuid4())
    file_uuid = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix.upper().replace(".", "") or "EXCEL"

    # Pre-register job in Supabase so it shows immediately in past imports
    try:
        conn = get_supabase_conn()
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO public.uploaded_files (
                    id, file_name, file_type, file_size, cloudinary_url,
                    village_id, uploaded_by, total_records, imported_records, status, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, 0, 'PROCESSING', NOW());
            """, (file_uuid, file.filename, file_ext, file_size, f"local://{file.filename}", target_village_id, admin.username))

            cur.execute("""
                INSERT INTO public.import_jobs (
                    id, file_id, file_name, file_type, file_size, village_id, village_name,
                    status, progress, stage, total_records, valid_records, imported_records,
                    created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'processing', 20, 'मतदार डेटा आयात होत आहे...', 0, 0, 0, NOW(), NOW());
            """, (job_uuid, file_uuid, file.filename, file_ext, file_size, target_village_id, "साखराळे / Sakharale"))
        conn.close()
    except Exception as je:
        logger.warning(f"Note pre-registering job: {je}")

    # Queue background task to import voters
    background_tasks.add_task(
        _process_import_in_background,
        file_path,
        file.filename,
        file_size,
        target_village_id,
        admin.username,
        admin.id,
        job_uuid,
        file_uuid
    )

    return {
        "success": True,
        "job_id": job_uuid,
        "jobId": job_uuid,
        "file_id": file_uuid,
        "fileName": file.filename,
        "status": "PROCESSING",
        "message": f"'{file.filename}' फाईल यशस्वीरित्या स्वीकारली असून मतदार आयात प्रक्रिया पार्श्वभूमीत सुरू झाली आहे."
    }

@router.post("/pdf")
async def upload_pdf_deprecated():
    raise HTTPException(
        status_code=400,
        detail="PDF अपलोड बंद करण्यात आले आहे. कृपया एक्सेल (.xlsx) किंवा सीएसव्ही (.csv) फाईल वापरा."
    )

# ==============================================================================
# IMPORT JOBS & HISTORY
# ==============================================================================

@router.get("/jobs")
async def list_import_jobs(
    admin: AuthUser = Depends(require_admin)
):
    """List recent import jobs from Supabase public.import_jobs."""
    conn = get_supabase_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM public.import_jobs
                ORDER BY created_at DESC
                LIMIT 50;
            """)
            rows = cur.fetchall()
            jobs = [format_job_row(dict(r)) for r in rows]
            return {"success": True, "data": jobs}
    finally:
        conn.close()

@router.get("/jobs/{job_id}")
async def get_import_job_status(
    job_id: str,
    admin: AuthUser = Depends(require_admin)
):
    """Retrieve import job status from Supabase."""
    conn = get_supabase_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM public.import_jobs WHERE id::text = %s LIMIT 1;", (str(job_id),))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Import job not found")
            return {"success": True, "job": format_job_row(dict(row))}
    finally:
        conn.close()

@router.get("/jobs/{job_id}/preview")
async def get_import_job_preview(
    job_id: str,
    limit: int = Query(20, ge=1, le=100),
    admin: AuthUser = Depends(require_admin)
):
    """Preview records from the imported job in Supabase."""
    conn = get_supabase_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM public.voters
                WHERE source_file_id::text = %s OR id::text = %s
                ORDER BY serial_number ASC
                LIMIT %s;
            """, (str(job_id), str(job_id), limit))
            rows = cur.fetchall()
            return {"success": True, "sample_rows": [dict(r) for r in rows]}
    finally:
        conn.close()

@router.delete("/jobs/{job_id}")
async def delete_import_job(
    job_id: str,
    delete_voters: bool = Query(True, description="Also delete voter records created by this import job"),
    admin: AuthUser = Depends(require_admin)
):
    """Delete an import job, associated voter records, and Cloudinary asset."""
    conn = get_supabase_conn()
    conn.autocommit = True
    deleted_voters = 0
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM public.import_jobs WHERE id::text = %s LIMIT 1;", (str(job_id),))
            job = cur.fetchone()
            target_fname = job.get("file_name") if job else None
            f_id = job.get("file_id") if job else None

            if delete_voters:
                cur.execute("""
                    DELETE FROM public.voters
                    WHERE source_file_id::text = %s OR source_file_name = %s;
                """, (str(f_id or job_id), target_fname))
                deleted_voters = cur.rowcount

            # Delete job and file record
            cur.execute("DELETE FROM public.import_jobs WHERE id::text = %s;", (str(job_id),))
            if f_id:
                cur.execute("DELETE FROM public.uploaded_files WHERE id::text = %s;", (str(f_id),))

            # Delete from Cloudinary
            cld_public_id = None
            if f_id:
                try:
                    cur.execute("SELECT cloudinary_public_id FROM public.uploaded_files WHERE id::text = %s LIMIT 1;", (str(f_id),))
                    c_row = cur.fetchone()
                    if c_row and c_row.get("cloudinary_public_id"):
                        cld_public_id = c_row["cloudinary_public_id"]
                except Exception:
                    pass

            if cld_public_id:
                try:
                    CloudinaryService.delete_file(cld_public_id, resource_type="raw")
                except Exception as ce:
                    logger.warning(f"Cloudinary deletion error for {cld_public_id}: {ce}")

            if target_fname:
                try:
                    cld_id = f"election_app/voter_lists/{target_fname}"
                    CloudinaryService.delete_file(cld_id, resource_type="raw")
                except Exception as ce:
                    logger.warning(f"Cloudinary deletion note: {ce}")

            # Update village stats
            cur.execute("""
                UPDATE public.villages
                SET total_voters = (SELECT count(*) FROM public.voters WHERE village_id = public.villages.id AND is_deleted = false),
                    active_voters = (SELECT count(*) FROM public.voters WHERE village_id = public.villages.id AND status = 'ACTIVE' AND is_deleted = false),
                    deceased_voters = (SELECT count(*) FROM public.voters WHERE village_id = public.villages.id AND status = 'DECEASED' AND is_deleted = false),
                    updated_at = NOW()
                WHERE id = %s;
            """, (SAKHARALE_VILLAGE_ID,))

        CacheService.invalidate_voter_cache()
        CacheService.invalidate_all_reports()

        log_activity(
            user_id=admin.id,
            action="DELETE_IMPORT_JOB",
            entity_type="IMPORT_JOB",
            entity_id=job_id,
            details=f"Deleted import job {target_fname} and removed {deleted_voters} voters",
            username=admin.username
        )

        return {
            "success": True,
            "message": f"इम्पोर्ट जॉब यशस्वीरित्या हटवला गेला ({deleted_voters} मतदार नोंदी हटवल्या).",
            "deletedJobId": job_id,
            "deletedVotersCount": deleted_voters
        }
    finally:
        conn.close()
