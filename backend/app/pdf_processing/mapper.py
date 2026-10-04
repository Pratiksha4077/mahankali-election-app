from typing import Dict, Any, List, Optional
from app.pdf_processing.marathi_normalizer import (
    normalize_marathi_text,
    to_arabic_num,
    clean_mobile_number,
    clean_membership_number,
    parse_marathi_name
)

DEFAULT_FIELD_MAPPINGS = {
    "serial_number": ["sr no", "sr_no", "sr", "अनुक्रमांक", "अ.क्र.", "अ.क्र", "क्रमांक", "sl no"],
    "full_name_mr": ["full name marathi", "full_name_mr", "full_name", "name", "मतदाराचे नाव", "पूर्ण नाव", "नाव", "full name", "मतदाराचे पूर्ण नाव"],
    "surname": ["surname marathi", "surname", "आडनाव", "कुलनाव"],
    "first_name": ["first name marathi", "first_name", "प्रथम नाव", "नाव"],
    "father_name": ["father name marathi", "father_name", "वडिलांचे नाव", "पतीचे नाव", "नातेवाईकाचे नाव", "relative_name",
                    "वडिलाचे / पतीचे नाव", "वडिलाचे/पतीचे नाव", "वडिलाचे नाव"],
    "membership_number": ["membership number", "membership_number", "membership_no", "membership", "सभासद क्र.", "सभासद नंबर", "सभासद क्रमांक", "सभासद"],
    "epic_number": ["epic", "epic_number", "voter_id", "ओळखपत्र", "कार्ड क्रमांक", "ओळखपत्र क्र.",
                    "मतदार ओळखपत्र क्र.", "मतदार ओळखपत्र क्र", "ओळखपत्र क्रमांक"],
    "village_mr": ["village marathi", "village", "village_name", "गाव", "गावाचे नाव",
                   "विभाग नाव"],
    "mobile_number": ["mobile number", "mobile", "mobile_number", "phone", "मोबाईल", "मोबाईल नंबर", "फोन"],
    "house_number": ["house_no", "house_number", "घर क्रमांक", "घर क्र.", "घर क्र"],
    "age": ["age", "वय"],
    "gender": ["gender", "sex", "लिंग"],
    "relative_name_mr": ["relative_name", "relative_name_mr", "नातेवाईकाचे नाव"],
    "relation_type": ["relation", "relation_type", "नाते"],
    "address": ["address", "पत्ता"],
    "ward_name": ["ward", "ward_name", "प्रभाग", "वॉर्ड", "विभाग"],
    "booth_part_number": ["booth", "booth_number", "part_number", "booth_part",
                          "भाग क्र.", "भाग क्रमांक", "भाग", "पृष्ठ क्रमांक"]
}

class FieldMapper:
    """
    Configurable mapping layer connecting arbitrary extracted or tabular fields
    to standard database columns.
    """

    def __init__(self, custom_mappings: Optional[Dict[str, str]] = None):
        self.mappings = custom_mappings or {}

    def map_record(self, raw_record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Maps a dictionary of raw keys to canonical database keys.
        """
        mapped: Dict[str, Any] = {}

        # 1. Apply custom mappings first
        for source_key, target_field in self.mappings.items():
            if source_key in raw_record:
                mapped[target_field] = raw_record[source_key]

        # 2. Then apply standard fuzzy matching for unmapped fields
        for target_field, aliases in DEFAULT_FIELD_MAPPINGS.items():
            if target_field not in mapped:
                for alias in aliases:
                    for r_key, r_val in raw_record.items():
                        if str(r_key).strip().lower() == alias.lower():
                            mapped[target_field] = r_val
                            break
                    if target_field in mapped:
                        break

        # 3. Copy over any already standard keys
        for std_key in [
            "serial_number", "epic_number", "membership_number", "full_name_mr", "full_name_en",
            "surname", "first_name", "father_name", "relative_name_mr",
            "relation_type", "house_number", "age", "gender", "village_mr",
            "booth_part_number", "ward_name", "mobile_number", "address",
            "religion", "caste", "designation", "profession", "status"
        ]:
            if std_key in raw_record and std_key not in mapped:
                mapped[std_key] = raw_record[std_key]

        # 4. Canonical normalizations
        if "serial_number" in mapped and mapped["serial_number"] is not None:
            sr_str = to_arabic_num(str(mapped["serial_number"]))
            if sr_str.isdigit():
                mapped["serial_number"] = int(sr_str)

        if "full_name_mr" in mapped and mapped["full_name_mr"]:
            mapped["full_name_mr"] = normalize_marathi_text(str(mapped["full_name_mr"]))
            if not mapped.get("surname") or not mapped.get("first_name"):
                s, f, fa = parse_marathi_name(mapped["full_name_mr"])
                if not mapped.get("surname") and s:
                    mapped["surname"] = s
                if not mapped.get("first_name") and f:
                    mapped["first_name"] = f
                if not mapped.get("father_name") and fa:
                    mapped["father_name"] = fa

        if "membership_number" in mapped and mapped["membership_number"]:
            mapped["membership_number"] = clean_membership_number(str(mapped["membership_number"]))
            if not mapped.get("epic_number"):
                mapped["epic_number"] = mapped["membership_number"]

        if "epic_number" in mapped and mapped["epic_number"]:
            mapped["epic_number"] = clean_membership_number(str(mapped["epic_number"]))

        if "mobile_number" in mapped and mapped["mobile_number"]:
            mapped["mobile_number"] = clean_mobile_number(str(mapped["mobile_number"]))

        if "father_name" in mapped and mapped["father_name"]:
            mapped["father_name"] = normalize_marathi_text(str(mapped["father_name"]))
            if not mapped.get("relative_name_mr"):
                mapped["relative_name_mr"] = mapped["father_name"]
                mapped["relation_type"] = "Father"

        if "village_mr" in mapped and mapped["village_mr"]:
            mapped["village_mr"] = normalize_marathi_text(str(mapped["village_mr"]))



        return mapped

def map_columns(
    records: List[Dict[str, Any]],
    custom_mappings: Optional[Dict[str, str]] = None
) -> List[Dict[str, Any]]:
    """
    Standard pipeline function: transforms raw extracted records into canonical data model.
    """
    mapper = FieldMapper(custom_mappings)
    return [mapper.map_record(rec) for rec in records]
