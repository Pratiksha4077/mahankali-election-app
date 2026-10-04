import os
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional, Union
from bson import ObjectId

from app.config.config import settings
from app.database.mongodb import get_sync_mongo_db
from app.pdf_processing.detector import detect_pdf_type, inspect_pdf_metadata
from app.pdf_processing.extractor import extract_table_from_pdf
from app.pdf_processing.ocr import extract_using_ocr
from app.pdf_processing.table_parser import parse_records
from app.pdf_processing.mapper import map_columns
from app.pdf_processing.validator import validate_records, RecordValidator
from app.pdf_processing.duplicate_detector import DuplicateDetector
from app.pdf_processing.excel_generator import generate_excel

def update_mongo_job_stage(
    db,
    job_id: str,
    stage_name: str,
    progress: int,
    status: str = "PROCESSING",
    extra: Optional[Dict[str, Any]] = None
):
    set_fields = {
        "currentStage": stage_name,
        "progress": progress,
        "status": status,
        "updatedAt": datetime.utcnow()
    }
    if extra:
        set_fields.update(extra)

    query = {"_id": ObjectId(job_id)} if ObjectId.is_valid(job_id) else {"_id": job_id}
    db.import_jobs.update_one(query, {"$set": set_fields})

def save_to_mongodb(
    records: List[Dict[str, Any]],
    village_id: Optional[str] = None,
    uploaded_by: str = "admin"
) -> int:
    """
    Saves validated voter records directly into MongoDB members collection.
    """
    db = get_sync_mongo_db()
    if not records:
        return 0

    v_ref = {"id": village_id or "", "name": "Sakharele", "nameMarathi": "साखराळे"}
    if village_id:
        v_query = {"_id": ObjectId(village_id)} if ObjectId.is_valid(village_id) else {"_id": village_id}
        v_doc = db.villages.find_one(v_query)
        if v_doc:
            v_ref = {
                "id": str(v_doc.get("_id", village_id)),
                "name": v_doc.get("name", "Sakharele"),
                "nameMarathi": v_doc.get("nameMarathi", "साखराळे")
            }

    docs_to_insert = []
    for r in records:
        if r.get("validation_status") == "INVALID" or r.get("is_valid") is False:
            continue

        doc = {
            "epicNumber": r.get("epic_number") or r.get("membership_number"),
            "membershipNumber": r.get("membership_number") or f"M-{r.get('serial_number', 0)}",
            "serialNumber": r.get("serial_number"),
            "boothPartNumber": r.get("booth_part_number") or "62",
            "name": {
                "full": r.get("full_name_en") or r.get("full_name_mr", ""),
                "first": r.get("first_name", ""),
                "surname": r.get("surname", ""),
                "fatherName": r.get("father_name", "")
            },
            "nameMarathi": {
                "full": r.get("full_name_mr", ""),
                "first": r.get("first_name", ""),
                "surname": r.get("surname", ""),
                "fatherName": r.get("father_name", "")
            },
            "relative": {
                "relationType": r.get("relation_type", "Father"),
                "nameMarathi": r.get("relative_name_mr", ""),
                "nameEnglish": ""
            },
            "village": v_ref,
            "houseNumber": str(r.get("house_number", "")),
            "age": r.get("age"),
            "gender": r.get("gender", "Male"),
            "mobileNumber": r.get("mobile_number", ""),
            "address": r.get("address", ""),
            "status": "ACTIVE",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
            "updatedBy": uploaded_by
        }
        docs_to_insert.append(doc)

    if docs_to_insert:
        db.members.insert_many(docs_to_insert)
    return len(docs_to_insert)

def process_pdf(
    pdf_path: Union[str, Path],
    output_excel_path: Optional[Union[str, Path]] = None,
    village_id: Optional[str] = None,
    save_to_db: bool = False
) -> Dict[str, Any]:
    """
    Standard programmatic pipeline function:
    1. Detect PDF type (TEXT vs SCANNED)
    2. Extract raw table data (PyMuPDF or OCR)
    3. Parse records
    4. Map columns
    5. Validate records
    6. Generate non-empty Excel (.xlsx)
    7. Optionally save to MongoDB
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")

    # 1. Detect PDF type
    pdf_type = detect_pdf_type(path)

    # 2. Extract raw data
    if pdf_type == "TEXT":
        raw_data = extract_table_from_pdf(path)
    else:
        raw_data = extract_using_ocr(path)

    # 3. Parse records
    records = parse_records(raw_data, pdf_path=path)

    # 4. Map columns
    records = map_columns(records)

    # 5. Validate records
    records = validate_records(records)

    records_found = len(records)
    if records_found == 0:
        error_msg = (
            f"Extraction failed: 0 records found in PDF '{path.name}'. "
            + ("Scanned PDF without OCR text." if pdf_type == "SCANNED" else "No recognizable table columns or voter cards.")
        )
        raise ValueError(error_msg)

    # 6. Generate Excel
    if not output_excel_path:
        output_excel_path = settings.PROCESSED_DIR / f"extracted_{path.stem}.xlsx"
    excel_path = generate_excel(records, output_path=output_excel_path, title=f"Electoral Roll - {path.name}")

    # 7. Optionally save to MongoDB
    if save_to_db:
        save_to_mongodb(records, village_id=village_id)

    valid_count = sum(1 for r in records if r.get("validation_status") == "VALID" or r.get("is_valid") is True)
    invalid_count = sum(1 for r in records if r.get("validation_status") == "INVALID" or r.get("is_valid") is False)
    duplicate_count = sum(1 for r in records if r.get("is_batch_duplicate"))

    return {
        "status": "COMPLETED",
        "records_found": records_found,
        "valid_records": valid_count,
        "invalid_records": invalid_count,
        "duplicate_records": duplicate_count,
        "excel_file": str(excel_path),
        "records": records
    }

def process_pdf_import_job_mongo(
    job_id: str,
    village_id: str,
    uploaded_by: str = "admin",
    auto_commit_db: bool = False,
    custom_mappings: Optional[Dict[str, str]] = None
):
    """
    Background worker pipeline executing full 8-stage processing for an import job:
    Updates MongoDB job metrics, ensures non-empty Excel generation, and flags failure if records = 0.
    """
    db = get_sync_mongo_db()
    job_query = {"_id": ObjectId(job_id)} if ObjectId.is_valid(job_id) else {"_id": job_id}
    job = db.import_jobs.find_one(job_query)
    if not job:
        return

    try:
        # Resolve target Village
        v_query = {"_id": ObjectId(village_id)} if ObjectId.is_valid(village_id) else {"_id": village_id}
        village_doc = db.villages.find_one(v_query)
        target_village_name = village_doc.get("nameMarathi", "साखराळे") if village_doc else "साखराळे"
        target_village_id = str(village_doc.get("_id", village_id)) if village_doc else village_id

        # ---------------- STAGE 1: File uploaded ✓ ----------------
        update_mongo_job_stage(db, job_id, "1. File uploaded ✓", 12, "PROCESSING")

        file_path = settings.UPLOAD_DIR / job["fileName"]
        if not file_path.exists():
            error_msg = f"File not found: {job['fileName']}"
            update_mongo_job_stage(db, job_id, "Processing failed", 100, "FAILED", {
                "errorSummary": error_msg,
                "status": "FAILED",
                "records_found": 0
            })
            return

        # ---------------- STAGE 2: PDF analyzed ✓ ----------------
        update_mongo_job_stage(db, job_id, "2. PDF analyzed ✓", 25)
        pdf_meta = inspect_pdf_metadata(file_path)
        total_pages = pdf_meta["total_pages"]
        pdf_type = pdf_meta["pdf_type"]
        db.import_jobs.update_one(job_query, {"$set": {"totalPages": total_pages, "pdfType": pdf_type}})

        # ---------------- STAGE 3: Text / OCR extraction ----------------
        update_mongo_job_stage(db, job_id, "3. Text/OCR extraction", 38)
        if pdf_type == "TEXT":
            raw_data = extract_table_from_pdf(file_path)
        else:
            update_mongo_job_stage(db, job_id, "3. OCR Processing (Scanned PDF)", 42)
            raw_data = extract_using_ocr(file_path)
            if raw_data.get("error"):
                update_mongo_job_stage(db, job_id, "OCR Review Required", 100, "FAILED", {
                    "errorSummary": raw_data["error"],
                    "status": "FAILED",
                    "records_found": 0,
                    "valid_records": 0,
                    "invalid_records": 0,
                    "duplicate_records": 0,
                    "excel_file": None
                })
                return

        # ---------------- STAGE 4: Data parsing ----------------
        update_mongo_job_stage(db, job_id, "4. Records detected & parsed", 50)
        parsed_records = parse_records(raw_data, pdf_path=file_path)

        # ---------------- STAGE 5: Column Mapping ----------------
        mapped_records = map_columns(parsed_records, custom_mappings)
        for r in mapped_records:
            if not r.get("village_mr"):
                r["village_mr"] = target_village_name
            r["village_id"] = target_village_id

        total_records = len(mapped_records)

        # STRICT SPECIFICATION ENFORCEMENT:
        # If records_found = 0, status must be FAILED or EXTRACTION_REVIEW_REQUIRED.
        # Never generate an empty Excel file and report the job as successful.
        if total_records == 0:
            error_reason = (
                f"No records could be extracted from '{job['fileName']}'. "
                + ("The file is a scanned PDF and OCR is not configured." if pdf_type == "SCANNED"
                   else "Table columns and voter cards could not be recognized.")
            )
            update_mongo_job_stage(
                db, job_id,
                stage_name="Extraction Review Required",
                progress=100,
                status="FAILED",
                extra={
                    "errorSummary": error_reason,
                    "status": "FAILED",
                    "records_found": 0,
                    "valid_records": 0,
                    "invalid_records": 0,
                    "duplicate_records": 0,
                    "excel_file": None,
                    "excelDownloadUrl": None,
                    "metrics": {
                        "totalRecords": 0,
                        "validRecords": 0,
                        "invalidRecords": 0,
                        "duplicateRecords": 0,
                        "importedRecords": 0
                    }
                }
            )
            return

        db.import_jobs.update_one(job_query, {"$set": {"metrics.totalRecords": total_records}})

        # ---------------- STAGE 6: Validation & Duplicate Detection ----------------
        update_mongo_job_stage(db, job_id, "5. Validating records", 65)
        validated_records = validate_records(mapped_records)

        update_mongo_job_stage(db, job_id, "6. Duplicate checking", 75)
        duplicate_conflicts = DuplicateDetector.detect_duplicates(validated_records, village_id=target_village_id)
        duplicate_indices = {c["recordIndex"] for c in duplicate_conflicts}

        valid_count = 0
        invalid_count = 0
        duplicate_count = len(duplicate_conflicts)
        import_records_to_insert = []

        for idx, rec in enumerate(validated_records):
            is_dup = idx in duplicate_indices or rec.get("is_batch_duplicate", False)
            is_valid = rec.get("is_valid", False) and not is_dup
            rec_status = "DUPLICATE" if is_dup else ("VALID" if is_valid else "INVALID")
            rec["validation_status"] = rec_status

            if rec_status == "VALID":
                valid_count += 1
            elif rec_status == "INVALID":
                invalid_count += 1

            import_records_to_insert.append({
                "jobId": str(job["_id"]),
                "rowIndex": idx + 1,
                "parsedData": rec,
                "status": rec_status,
                "errors": rec.get("validation_errors", []),
                "isDuplicate": is_dup
            })

        if import_records_to_insert:
            db.import_records.insert_many(import_records_to_insert)

        db.import_jobs.update_one(job_query, {"$set": {
            "metrics.validRecords": valid_count,
            "metrics.invalidRecords": invalid_count,
            "metrics.duplicateRecords": duplicate_count
        }})

        # ---------------- STAGE 7: Excel Generation ----------------
        update_mongo_job_stage(db, job_id, "7. Generating Excel", 85)
        excel_filename = f"extracted_{Path(job['fileName']).stem}_{str(job['_id'])[:8]}.xlsx"
        excel_output_path = settings.PROCESSED_DIR / excel_filename

        generate_excel(
            records=validated_records,
            output_path=excel_output_path,
            title=f"Electoral Roll - {job['fileName']}"
        )

        excel_url = f"/static/processed/{excel_filename}"
        db.import_jobs.update_one(job_query, {"$set": {
            "excelDownloadUrl": excel_url,
            "excel_file": excel_url
        }})

        # ---------------- STAGE 8: Database import (if auto_commit requested) ----------------
        imported_count = 0
        if auto_commit_db and valid_count > 0:
            update_mongo_job_stage(db, job_id, "8. Importing into MongoDB", 95)
            imported_count = commit_mongo_job_records(str(job["_id"]), duplicate_strategy="SKIP")

        # ---------------- COMPLETE JOB WITH REQUIRED SCHEMA ----------------
        update_mongo_job_stage(
            db, job_id,
            stage_name="8. Completed ✓",
            progress=100,
            status="COMPLETED",
            extra={
                "job_id": str(job["_id"]),
                "status": "COMPLETED",
                "records_found": total_records,
                "valid_records": valid_count,
                "invalid_records": invalid_count,
                "duplicate_records": duplicate_count,
                "excel_file": excel_url,
                "completedAt": datetime.utcnow()
            }
        )

    except Exception as e:
        update_mongo_job_stage(
            db, job_id,
            stage_name="Processing failed",
            progress=100,
            status="FAILED",
            extra={
                "errorSummary": str(e),
                "status": "FAILED",
                "records_found": 0,
                "excel_file": None
            }
        )

def commit_mongo_job_records(job_id: str, duplicate_strategy: str = "SKIP") -> int:
    """
    Commits valid records from an import job into the MongoDB `members` collection.
    """
    db = get_sync_mongo_db()
    job_query = {"_id": ObjectId(job_id)} if ObjectId.is_valid(job_id) else {"_id": job_id}
    job = db.import_jobs.find_one(job_query)
    if not job:
        return 0

    records_cursor = db.import_records.find({"jobId": job_id})
    records_to_commit = []
    imported_count = 0

    village_id = job.get("villageId")
    v_query = {"_id": ObjectId(village_id)} if ObjectId.is_valid(village_id) else {"_id": village_id}
    village_doc = db.villages.find_one(v_query)

    v_ref = {
        "id": str(village_doc.get("_id", village_id)) if village_doc else village_id,
        "name": village_doc.get("name", "Sakharele") if village_doc else "Sakharele",
        "nameMarathi": village_doc.get("nameMarathi", "साखराळे") if village_doc else "साखराळे"
    }

    cat_green = db.categories.find_one({"code": "GREEN"})
    cat_ref = {
        "id": str(cat_green["_id"]),
        "name": cat_green["name"],
        "nameMarathi": cat_green["nameMarathi"],
        "color": cat_green["color"]
    } if cat_green else None

    for rec in records_cursor:
        status = rec.get("status")
        is_dup = rec.get("isDuplicate", False)

        if status == "INVALID":
            continue
        if is_dup and duplicate_strategy == "SKIP":
            continue

        data = rec.get("parsedData", {})

        member_doc = {
            "epicNumber": data.get("epic_number") or data.get("membership_number"),
            "membershipNumber": data.get("membership_number") or f"M-{data.get('serial_number') or 0}",
            "serialNumber": data.get("serial_number"),
            "boothPartNumber": data.get("booth_part_number") or "62",
            "name": {
                "full": data.get("full_name_en") or data.get("full_name_mr", ""),
                "first": data.get("first_name", ""),
                "surname": data.get("surname", ""),
                "fatherName": data.get("father_name", "")
            },
            "nameMarathi": {
                "full": data.get("full_name_mr", ""),
                "first": data.get("first_name", ""),
                "surname": data.get("surname", ""),
                "fatherName": data.get("father_name", "")
            },
            "relative": {
                "relationType": data.get("relation_type", "Father"),
                "nameMarathi": data.get("relative_name_mr", ""),
                "nameEnglish": ""
            },
            "village": v_ref,
            "houseNumber": str(data.get("house_number", "")),
            "age": data.get("age"),
            "gender": data.get("gender", "Male"),
            "mobileNumber": data.get("mobile_number", ""),
            "address": data.get("address", ""),
            "pinCode": data.get("pin_code", "415414"),
            "religion": data.get("religion", ""),
            "caste": data.get("caste", ""),
            "designation": data.get("designation", "Member"),
            "profession": data.get("profession", ""),
            "category": cat_ref,
            "status": "ACTIVE",
            "source": {
                "fileName": job.get("fileName", ""),
                "fileType": job.get("fileType", "PDF"),
                "importJobId": str(job["_id"]),
                "uploadDate": datetime.utcnow(),
                "uploadedBy": job.get("uploadedBy", "admin")
            },
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
            "updatedBy": job.get("uploadedBy", "admin")
        }

        # Normalize Marathi gender values to English
        raw_gender = member_doc.get("gender", "")
        if raw_gender in ("पुरुष", "पु", "M", "m", "Male"):
            member_doc["gender"] = "Male"
        elif raw_gender in ("महिला", "स्त्री", "स्त्री", "F", "f", "Female"):
            member_doc["gender"] = "Female"

        epic = member_doc.get("epicNumber")
        if duplicate_strategy == "UPDATE" and epic:
            # Upsert — update existing record or insert new one by EPIC
            db.members.update_one(
                {"epicNumber": epic},
                {"$set": member_doc},
                upsert=True
            )
            imported_count += 1
        elif is_dup and duplicate_strategy == "SKIP":
            pass  # skip duplicate
        else:
            records_to_commit.append(member_doc)

    if records_to_commit:
        db.members.insert_many(records_to_commit)
        imported_count += len(records_to_commit)

    # Recalculate village metrics
    total_v = db.members.count_documents({"village.id": v_ref["id"]})
    active_v = db.members.count_documents({"village.id": v_ref["id"], "status": "ACTIVE"})
    dead_v = db.members.count_documents({"village.id": v_ref["id"], "status": "DECEASED"})
    db.villages.update_one(
        v_query,
        {"$set": {
            "stats.totalVoters": total_v,
            "stats.activeMembers": active_v,
            "stats.deceasedMembers": dead_v,
            "stats.totalFamilies": max(1, total_v // 3)
        }}
    )

    db.import_jobs.update_one(job_query, {"$set": {"metrics.importedRecords": imported_count}})
    return imported_count
