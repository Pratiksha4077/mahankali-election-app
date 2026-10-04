from typing import Dict, Any, List, Optional, Tuple
from app.database.mongodb import get_sync_mongo_db

class DuplicateDetector:
    """
    Configurable multi-tier duplicate detection engine for voter and member records.
    Provides candidate matching with Existing vs New comparison.
    """

    @staticmethod
    def detect_duplicates(
        incoming_records: List[Dict[str, Any]],
        village_id: str,
        rules: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Scans a batch of incoming parsed records against MongoDB.
        Returns a list of duplicate conflict descriptors with match reasons.
        """
        if rules is None:
            rules = ["EPIC", "MEMBERSHIP_VILLAGE", "NAME_RELATIVE_VILLAGE"]

        db = get_sync_mongo_db()
        conflicts: List[Dict[str, Any]] = []

        for idx, rec in enumerate(incoming_records):
            epic = rec.get("epicNumber") or rec.get("epic_number")
            mem_no = rec.get("membershipNumber") or rec.get("membership_number")
            name_mr = rec.get("nameMarathi", {}).get("full") if isinstance(rec.get("nameMarathi"), dict) else rec.get("nameMarathi") or rec.get("full_name_mr")
            rel_name = rec.get("relative", {}).get("nameMarathi") if isinstance(rec.get("relative"), dict) else rec.get("relative_name_mr")

            matched_doc = None
            match_rule = None

            # Rule 1: EPIC Match
            if "EPIC" in rules and epic:
                matched_doc = db.members.find_one({"epicNumber": epic})
                if matched_doc:
                    match_rule = f"Exact EPIC Number Match: {epic}"

            # Rule 2: Membership Number + Village
            if not matched_doc and "MEMBERSHIP_VILLAGE" in rules and mem_no and village_id:
                matched_doc = db.members.find_one({"membershipNumber": mem_no, "village.id": village_id})
                if matched_doc:
                    match_rule = f"Membership Number Match in same village: {mem_no}"

            # Rule 3: Name + Relative Name + Village
            if not matched_doc and "NAME_RELATIVE_VILLAGE" in rules and name_mr and rel_name and village_id:
                matched_doc = db.members.find_one({
                    "nameMarathi.full": name_mr,
                    "relative.nameMarathi": rel_name,
                    "village.id": village_id
                })
                if matched_doc:
                    match_rule = f"Full Name & Relative Match: {name_mr} ({rel_name})"

            if matched_doc:
                conflicts.append({
                    "recordIndex": idx,
                    "matchRule": match_rule,
                    "newRecord": rec,
                    "existingRecord": {
                        "id": str(matched_doc.get("_id")),
                        "membershipNumber": matched_doc.get("membershipNumber"),
                        "epicNumber": matched_doc.get("epicNumber"),
                        "nameMarathi": matched_doc.get("nameMarathi", {}).get("full", ""),
                        "village": matched_doc.get("village", {}).get("nameMarathi", ""),
                        "status": matched_doc.get("status", "ACTIVE")
                    },
                    "recommendedAction": "SKIP"
                })

        return conflicts
