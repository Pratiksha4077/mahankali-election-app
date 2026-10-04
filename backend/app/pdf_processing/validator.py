from typing import Dict, Any, List, Set, Tuple, Optional
import re
from app.pdf_processing.marathi_normalizer import to_arabic_num

class RecordValidator:
    """
    Validates parsed voter records, detects format errors and field inconsistencies.
    """

    @staticmethod
    def validate_single(
        record: Dict[str, Any],
        seen_epics: Optional[Set[str]] = None
    ) -> Tuple[bool, List[str], bool]:
        """
        Validates one voter record.
        Returns (is_valid, error_list, is_duplicate).
        """
        errors = []
        is_duplicate = False

        # 1. Voter name is strictly required
        full_name = record.get("full_name_mr") or record.get("full_name_en") or record.get("first_name")
        if not full_name or len(str(full_name).strip()) < 2:
            errors.append("Voter Name is missing or too short")

        # 2. Age check (electoral boundary: 18-125)
        age = record.get("age")
        if age is not None and str(age).strip() != "":
            try:
                age_int = int(to_arabic_num(str(age)))
                if age_int < 18 or age_int > 125:
                    errors.append(f"Age {age_int} out of valid electoral range (18-125)")
            except (ValueError, TypeError):
                errors.append("Invalid age format")

        # 3. Mobile Number Check (if provided, must be valid 10-digit number)
        mobile = record.get("mobile_number")
        if mobile and str(mobile).strip() != "":
            clean_mob = re.sub(r'\D', '', str(mobile))
            if len(clean_mob) != 10:
                errors.append(f"Mobile number '{mobile}' must be 10 digits")

        # 4. EPIC / Membership duplicate check in current batch
        epic = record.get("epic_number") or record.get("membership_number")
        if epic and str(epic).strip():
            epic_clean = str(epic).strip()
            if seen_epics is not None:
                if epic_clean in seen_epics:
                    is_duplicate = True
                    errors.append(f"Duplicate identifier {epic_clean} within batch")
                else:
                    seen_epics.add(epic_clean)

        is_valid = len(errors) == 0 and not is_duplicate
        return is_valid, errors, is_duplicate

def validate_records(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Standard pipeline step: validates every record in the list.
    Adds 'is_valid', 'validation_errors', and 'validation_status' to each record.
    """
    seen_ids: Set[str] = set()
    validated = []

    for rec in records:
        r_copy = dict(rec)
        is_valid, errors, is_dup = RecordValidator.validate_single(r_copy, seen_ids)
        r_copy["is_valid"] = is_valid
        r_copy["validation_errors"] = errors
        r_copy["is_batch_duplicate"] = is_dup
        r_copy["validation_status"] = "VALID" if is_valid else ("DUPLICATE" if is_dup else "INVALID")
        validated.append(r_copy)

    return validated
