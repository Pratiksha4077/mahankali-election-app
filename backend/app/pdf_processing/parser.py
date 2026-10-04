import re
from typing import List, Dict, Any, Optional

MARATHI_DIGITS = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
}

def to_arabic_num(text: str) -> str:
    if not text:
        return ""
    res = ""
    for ch in str(text):
        res += MARATHI_DIGITS.get(ch, ch)
    return res

class ElectoralRollParser:
    """
    Parses Marathi electoral rolls (Maharashtra standard voter list format).
    Extracts village, booth part, ward, and individual voter cards.
    """

    @staticmethod
    def extract_header_info(raw_text: str) -> Dict[str, Any]:
        """Extracts assembly, booth part, village and ward info from header text."""
        info = {
            "assembly_info": None,
            "booth_part": "62",
            "village_mr": "साखराळे",
            "ward_name": None
        }

        # Assembly Constituency
        ac_match = re.search(r'विधानसभा\s*मतदारसंघा?चा?\s*क्रमांक[^:]*[:\-]\s*([0-9०-९]+[^\n\r]+)', raw_text)
        if ac_match:
            info["assembly_info"] = ac_match.group(1).strip()

        # Part number (यादी भाग क्रमांक)
        part_match = re.search(r'यादी\s*भाग\s*क्रमांक\s*[:\-]?\s*([0-9०-९]+)', raw_text)
        if part_match:
            info["booth_part"] = to_arabic_num(part_match.group(1).strip())

        # Village (गाव / मूळ नगर किंवा गाव)
        village_match = re.search(r'(?:गाव|मूळ\s*नगर\s*किंवा\s*गाव)\s*[:\-]\s*([^\n\r,]+)', raw_text)
        if village_match:
            info["village_mr"] = village_match.group(1).strip()

        # Ward / Section (विभाग क्रमांक आणि नाव)
        ward_match = re.search(r'विभाग\s*क्रमांक\s*आणि\s*नाव\s*[:\-]?\s*([^\n\r]+)', raw_text)
        if ward_match:
            info["ward_name"] = ward_match.group(1).strip()

        return info

    @staticmethod
    def parse_voter_card(card_text: str) -> Optional[Dict[str, Any]]:
        """
        Parses a single voter card text block.
        """
        if not card_text or len(card_text.strip()) < 10:
            return None

        # Clean text
        lines = [line.strip() for line in card_text.splitlines() if line.strip()]
        joined = "\n".join(lines)

        # 1. EPIC Number (e.g. XTX7477128, LBY1292978, etc.)
        epic_match = re.search(r'([A-Z]{3}[0-9]{7}|[A-Z]{2}[0-9]{7,8}|[A-Z]{3}/[0-9]{6,8})', joined)
        epic_number = epic_match.group(1) if epic_match else None

        # 2. Serial number (top-left or standalone leading number)
        serial_number = None
        sr_match = re.search(r'^\s*([0-9०-९]+)\s*$', lines[0] if lines else "")
        if not sr_match:
            sr_match = re.search(r'(?:^|\n)\s*([0-9०-९]{1,4})\s*(?:\n|[A-Z]{3}|$)', joined)
        if sr_match:
            try:
                serial_number = int(to_arabic_num(sr_match.group(1)))
            except ValueError:
                serial_number = None

        # 3. Voter Name (नाव : ...)
        full_name = None
        name_match = re.search(r'नाव\s*[:\-]\s*([^\n\r]+)', joined)
        if name_match:
            full_name = name_match.group(1).strip()

        # 4. Relative Name & Relation Type
        relative_name = None
        relation_type = "Father"

        rel_match = re.search(r'(वडिलांचे|पतीचे|आईचे|इतर)\s*नाव\s*[:\-]\s*([^\n\r]+)', joined)
        if rel_match:
            rel_label = rel_match.group(1)
            relative_name = rel_match.group(2).strip()
            if "पती" in rel_label:
                relation_type = "Husband"
            elif "आई" in rel_label:
                relation_type = "Mother"
            elif "इतर" in rel_label:
                relation_type = "Other"
            else:
                relation_type = "Father"

        # 5. House Number (घर क्रमांक : ...)
        house_number = None
        house_match = re.search(r'घर\s*क्रमांक\s*[:\-]\s*([^\n\r]+)', joined)
        if house_match:
            house_val = house_match.group(1).strip()
            if house_val and house_val != "-":
                house_number = to_arabic_num(house_val)

        # 6. Age (वय : ...)
        age = None
        age_match = re.search(r'वय\s*[:\-]\s*([0-9०-९]+)', joined)
        if age_match:
            try:
                age = int(to_arabic_num(age_match.group(1)))
            except ValueError:
                age = None

        # 7. Gender (लिंग : महिला / पुरुष / तृतीय पंथी)
        gender = "Male"
        gender_match = re.search(r'लिंग\s*[:\-]\s*(महिला|पुरुष|स्त्री|पुरुष|तृतीय\s*पंथी)', joined)
        if gender_match:
            g_str = gender_match.group(1).strip()
            if "महिला" in g_str or "स्त्री" in g_str:
                gender = "Female"
            elif "तृतीय" in g_str:
                gender = "Other"
            else:
                gender = "Male"

        # If no name was found, it is not a valid voter card
        if not full_name:
            return None

        # Extract surname / first name from full_name if standard Marathi order: [आडनाव / नाव / वडिलांचे नाव]
        # In Maharashtra rolls, "भोसले सुभाष शंकर" -> Surname: भोसले, First: सुभाष, Father: शंकर
        name_parts = full_name.split()
        surname = name_parts[0] if len(name_parts) >= 2 else None
        first_name = name_parts[1] if len(name_parts) >= 2 else full_name
        father_name = name_parts[2] if len(name_parts) >= 3 else relative_name

        return {
            "serial_number": serial_number,
            "epic_number": epic_number,
            "full_name_mr": full_name,
            "surname": surname,
            "first_name": first_name,
            "father_name": father_name,
            "relative_name_mr": relative_name,
            "relation_type": relation_type,
            "house_number": house_number,
            "age": age,
            "gender": gender,
        }

    @staticmethod
    def parse_page(page_text: str, current_header: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Splits a page into voter card chunks and parses each.
        Uses pattern matching on 'नाव :' to separate cards.
        """
        voters = []
        # Update header info if this page contains header metadata
        header = ElectoralRollParser.extract_header_info(page_text)
        if not current_header:
            current_header = header
        else:
            if header.get("ward_name"):
                current_header["ward_name"] = header["ward_name"]
            if header.get("village_mr"):
                current_header["village_mr"] = header["village_mr"]

        # Card separator regex: look for card markers (e.g. sequence of Serial No or नाव :)
        # Match each voter card: from card start to next card start or end of text
        card_blocks = re.split(r'(?=(?:[0-9०-९]{1,4}\s+[A-Z]{3}[0-9]{7})|(?:नाव\s*[:\-]))', page_text)

        for block in card_blocks:
            if "नाव" in block and ("वय" in block or "लिंग" in block or "घर क्रमांक" in block):
                parsed = ElectoralRollParser.parse_voter_card(block)
                if parsed and parsed.get("full_name_mr"):
                    parsed["village_mr"] = current_header.get("village_mr", "साखराळे")
                    parsed["booth_part_number"] = current_header.get("booth_part", "62")
                    parsed["ward_name"] = current_header.get("ward_name")
                    voters.append(parsed)

        return voters
