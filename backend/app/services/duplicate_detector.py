from typing import Dict, Any, List, Optional
from app.services.supabase_service import get_supabase_conn

class DuplicateDetector:
    """
    Duplicate detection engine checking incoming voter records against Supabase public.voters.
    """

    @staticmethod
    def detect_duplicates(
        incoming_records: List[Dict[str, Any]],
        village_id: str,
        rules: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        if rules is None:
            rules = ["EPIC", "MEMBERSHIP", "NAME_RELATIVE"]

        conflicts: List[Dict[str, Any]] = []
        try:
            conn = get_supabase_conn()
            with conn.cursor() as cur:
                for idx, rec in enumerate(incoming_records):
                    epic = rec.get("epicNumber") or rec.get("epic_number")
                    mem_no = rec.get("membershipNumber") or rec.get("membership_number")
                    name_mr = rec.get("full_name_mr") or rec.get("full_name_marathi") or ""

                    matched = False
                    match_reason = ""

                    if "EPIC" in rules and epic:
                        cur.execute("SELECT id FROM public.voters WHERE epic_number = %s LIMIT 1;", (str(epic),))
                        if cur.fetchone():
                            matched = True
                            match_reason = f"Exact EPIC match: {epic}"

                    if not matched and "MEMBERSHIP" in rules and mem_no:
                        cur.execute("SELECT id FROM public.voters WHERE membership_number = %s LIMIT 1;", (str(mem_no),))
                        if cur.fetchone():
                            matched = True
                            match_reason = f"Membership match: {mem_no}"

                    if matched:
                        conflicts.append({
                            "index": idx,
                            "reason": match_reason,
                            "epic": epic,
                            "name": name_mr
                        })
            conn.close()
        except Exception:
            pass

        return conflicts
