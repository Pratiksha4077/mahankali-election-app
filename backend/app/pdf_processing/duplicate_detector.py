from typing import Dict, Any, List, Optional, Set
from app.services.duplicate_detector import DuplicateDetector as BaseDuplicateDetector

class DuplicateDetector:
    """
    Duplicate detector for PDF processing pipeline.
    Detects intra-batch duplicates and cross-database conflicts.
    """

    @staticmethod
    def detect_batch_duplicates(records: List[Dict[str, Any]]) -> Set[int]:
        """
        Detects duplicate records within the current batch.
        Returns indices of duplicate records.
        """
        duplicate_indices: Set[int] = set()
        seen_identifiers: Set[str] = set()
        seen_names: Set[str] = set()

        for idx, rec in enumerate(records):
            ident = rec.get("epic_number") or rec.get("membership_number")
            name = rec.get("full_name_mr", "")
            father = rec.get("father_name", "") or rec.get("relative_name_mr", "")

            # Check identifier
            if ident and str(ident).strip():
                clean_id = str(ident).strip().upper()
                if clean_id in seen_identifiers:
                    duplicate_indices.add(idx)
                else:
                    seen_identifiers.add(clean_id)

            # Check name + father
            if name and father:
                name_key = f"{name.strip()}|{father.strip()}"
                if name_key in seen_names:
                    duplicate_indices.add(idx)
                else:
                    seen_names.add(name_key)

        return duplicate_indices

    @staticmethod
    def detect_duplicates(
        incoming_records: List[Dict[str, Any]],
        village_id: Optional[str] = None,
        rules: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Scans incoming records against database and within batch.
        """
        conflicts: List[Dict[str, Any]] = []

        # 1. Check against DB if village_id is provided
        if village_id:
            try:
                db_conflicts = BaseDuplicateDetector.detect_duplicates(
                    incoming_records=incoming_records,
                    village_id=village_id,
                    rules=rules
                )
                conflicts.extend(db_conflicts)
            except Exception:
                pass

        # 2. Check within current batch
        batch_dup_indices = DuplicateDetector.detect_batch_duplicates(incoming_records)
        existing_indices = {c["recordIndex"] for c in conflicts}

        for idx in batch_dup_indices:
            if idx not in existing_indices:
                rec = incoming_records[idx]
                ident = rec.get("epic_number") or rec.get("membership_number") or ""
                conflicts.append({
                    "recordIndex": idx,
                    "matchRule": f"Duplicate record within uploaded batch: {ident}",
                    "newRecord": rec,
                    "recommendedAction": "SKIP"
                })

        return conflicts

def detect_duplicates(
    records: List[Dict[str, Any]],
    village_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Standard pipeline helper.
    """
    return DuplicateDetector.detect_duplicates(records, village_id=village_id)
