import openpyxl
from pathlib import Path
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
import pandas as pd

from app.config.config import settings
from app.models.models import Member, Village, Ward
from app.pdf_processing.mapper import FieldMapper
from app.pdf_processing.validator import RecordValidator

class ExcelImporter:
    """
    Validates, previews, and imports Excel files into the database.
    Can also generate an error Excel file containing rejected rows.
    """

    @staticmethod
    def process_raw_rows(raw_rows: List[Dict[str, Any]], db: Session) -> Dict[str, Any]:
        mapper = FieldMapper()
        seen_epics = set()
        
        # Check DB duplicates
        all_epics = []
        for r in raw_rows:
            mapped = mapper.map_record(r)
            epic = mapped.get("epic_number")
            if epic:
                all_epics.append(str(epic).strip())
        
        db_duplicates = RecordValidator.check_database_duplicates(db, all_epics)

        valid_records = []
        invalid_records = []
        duplicate_records = []

        for idx, raw_row in enumerate(raw_rows, start=1):
            mapped = mapper.map_record(raw_row)
            is_valid, errors, is_batch_dup = RecordValidator.validate_single(mapped, seen_epics)
            
            epic = mapped.get("epic_number")
            is_db_dup = epic in db_duplicates if epic else False
            is_dup = is_batch_dup or is_db_dup

            row_summary = {
                "row_index": idx,
                "raw_data": raw_row,
                "mapped_data": mapped,
                "errors": errors
            }

            if is_dup:
                if is_db_dup:
                    row_summary["errors"].append(f"EPIC {epic} already in database")
                duplicate_records.append(row_summary)
            elif not is_valid:
                invalid_records.append(row_summary)
            else:
                valid_records.append(row_summary)

        return {
            "total": len(raw_rows),
            "valid": valid_records,
            "invalid": invalid_records,
            "duplicates": duplicate_records
        }

    @staticmethod
    def generate_error_workbook(invalid_items: List[Dict[str, Any]], output_path: Path) -> Path:
        """Generates an Excel sheet containing invalid rows and their reason for rejection."""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Errors & Rejections"

        ws.append(["Row #", "Voter Name", "EPIC / ID", "Errors Encountered", "Raw Row Data"])

        for item in invalid_items:
            raw = item.get("raw_data", {})
            mapped = item.get("mapped_data", {})
            errors_str = "; ".join(item.get("errors", []))
            ws.append([
                item.get("row_index"),
                mapped.get("full_name_mr") or mapped.get("full_name_en") or "N/A",
                mapped.get("epic_number") or "N/A",
                errors_str,
                str(raw)
            ])

        output_path.parent.mkdir(parents=True, exist_ok=True)
        wb.save(str(output_path))
        return output_path
