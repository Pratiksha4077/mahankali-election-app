import re
from collections import defaultdict
from typing import List, Dict, Any, Optional, Union
from pathlib import Path

from app.pdf_processing.marathi_normalizer import (
    normalize_marathi_text,
    to_arabic_num,
    clean_mobile_number,
    clean_membership_number,
    parse_marathi_name
)

# Known Column Header Variations (English + Marathi transliterations and Devanagari)
HEADER_FIELD_PATTERNS = {
    "serial_number": [r"^sr\b", r"sr\s*no", r"अ\.?\s*क्र", r"अनुक्रमांक", r"क्रमांक", r"sl\s*no"],
    "full_name_mr": [r"full\s*name", r"पूर्ण\s*नाव", r"मतदाराचे\s*नाव", r"नाव\s*मराठी"],
    "surname": [r"surname", r"आडनाव", r"कुलनाव"],
    "first_name": [r"first\s*name", r"नाव", r"प्रथम\s*नाव"],
    "father_name": [r"father\s*name", r"husband\s*name", r"वडिलांचे\s*नाव", r"पतीचे\s*नाव", r"नातेवाईक"],
    "membership_number": [r"membership", r"सभासद\s*क्र", r"सभासद\s*नंबर", r"सभासद\s*क्रमांक", r"b-no", r"member\s*no"],
    "epic_number": [r"epic", r"voter\s*id", r"ओळखपत्र", r"कार्ड\s*क्रमांक"],
    "village_mr": [r"village", r"गाव", r"गावाचे\s*नाव"],
    "mobile_number": [r"mobile", r"phone", r"मोबाईल", r"मोबाईल\s*नंबर", r"दूरध्वनी"],
    "house_number": [r"house\s*no", r"घर\s*क्रमांक", r"घर\s*क्र"],
    "age": [r"age", r"वय"],
    "gender": [r"gender", r"sex", r"लिंग"]
}

class TableParser:
    """
    Multi-strategy parser for extraction of structured voter records from Marathi PDFs.
    Supports:
    - Tabular table layouts (Block-based & Word coordinate intervals)
    - Bordered tables from pdfplumber
    - ECI Electoral Roll voter card boxes (नाव, वय, लिंग, घर क्रमांक, ओळखपत्र)
    """

    @staticmethod
    def is_header_line(line: str) -> bool:
        """Determines if a text line contains typical table header labels."""
        line_clean = line.lower()
        matches = 0
        keywords = ["sr", "no", "name", "surname", "father", "membership", "village", "mobile",
                    "नाव", "आडनाव", "सभासद", "गाव", "मोबाईल", "अ.क्र", "क्रमांक", "ओळखपत्र"]
        for kw in keywords:
            if kw in line_clean:
                matches += 1
        return matches >= 2

    # ---------------- STRATEGY 1: Block-based Column Parsing ----------------
    @classmethod
    def parse_blocks_table(cls, pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        records = []
        for page in pages:
            blocks = page.get("blocks", [])
            header_columns = []
            
            for b in blocks:
                txt = b[4].strip() if len(b) > 4 else ""
                lines = [normalize_marathi_text(l) for l in txt.split("\n") if normalize_marathi_text(l)]
                if not lines:
                    continue

                # Header detection
                joined_block = " ".join(lines)
                if cls.is_header_line(joined_block) and len(lines) >= 3:
                    header_columns = lines
                    continue

                # Data row detection: starts with a digit/row counter
                sr_candidate = to_arabic_num(lines[0])
                if sr_candidate.isdigit() and len(lines) >= 4:
                    sr_no = int(sr_candidate)
                    
                    # Typical 8-column layout:
                    # [0: sr, 1: full_name, 2: surname, 3: first_name, 4: father_name, 5: membership_no, 6: village, 7: mobile]
                    full_name = lines[1] if len(lines) > 1 else ""
                    surname = lines[2] if len(lines) > 2 else ""
                    first_name = lines[3] if len(lines) > 3 else ""
                    father_name = lines[4] if len(lines) > 4 else ""
                    membership_no = lines[5] if len(lines) > 5 else ""
                    village = lines[6] if len(lines) > 6 else ""
                    mobile = lines[7] if len(lines) > 7 else ""

                    # Auto-derive names if needed
                    if not surname and not first_name and full_name:
                        s, f, fa = parse_marathi_name(full_name)
                        surname, first_name = s, f
                        if not father_name:
                            father_name = fa

                    record = {
                        "serial_number": sr_no,
                        "full_name_mr": full_name,
                        "surname": surname,
                        "first_name": first_name,
                        "father_name": father_name,
                        "relative_name_mr": father_name,
                        "relation_type": "Father",
                        "membership_number": clean_membership_number(membership_no),
                        "epic_number": clean_membership_number(membership_no),
                        "village_mr": village,
                        "mobile_number": clean_mobile_number(mobile),
                        "status": "ACTIVE"
                    }
                    records.append(record)

        return records

    # ---------------- STRATEGY 2: Word Coordinate Intervals ----------------
    @classmethod
    def parse_coordinate_table(cls, pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        records = []
        for page in pages:
            words = page.get("words", [])
            if not words or len(words) < 10:
                continue

            # Group words by approximate vertical line (6pt tolerance)
            lines_by_y = defaultdict(list)
            for w in words:
                y_key = round(w[1] / 6) * 6
                lines_by_y[y_key].append(w)

            sorted_y_keys = sorted(lines_by_y.keys())

            # Detect header row and determine column horizontal boundary intervals
            header_y = None
            header_words = []
            for y in sorted_y_keys:
                line_words = sorted(lines_by_y[y], key=lambda x: x[0])
                line_text = " ".join(w[4] for w in line_words)
                if cls.is_header_line(line_text):
                    header_y = y
                    header_words = line_words
                    break

            if header_y is None:
                continue

            # Identify column ranges from header or empirical column positions
            # Sakharele sample coordinates: 50(Sr), 100(Full), 240(Sur), 340(First), 430(Father), 540(Mem), 640(Vill), 720(Mob)
            col_bounds = [
                ("serial_number", 40, 90),
                ("full_name_mr", 90, 230),
                ("surname", 230, 330),
                ("first_name", 330, 420),
                ("father_name", 420, 530),
                ("membership_number", 530, 630),
                ("village_mr", 630, 710),
                ("mobile_number", 710, 850)
            ]

            # Parse each row below header_y
            for y in sorted_y_keys:
                if y <= header_y:
                    continue
                row_words = sorted(lines_by_y[y], key=lambda x: x[0])
                if not row_words:
                    continue

                row_dict = {}
                for col_name, x_min, x_max in col_bounds:
                    matching = [w[4] for w in row_words if x_min <= w[0] < x_max]
                    val = normalize_marathi_text(" ".join(matching))
                    row_dict[col_name] = val

                sr_val = to_arabic_num(row_dict.get("serial_number", ""))
                if sr_val.isdigit() and row_dict.get("full_name_mr"):
                    rec = {
                        "serial_number": int(sr_val),
                        "full_name_mr": row_dict.get("full_name_mr", ""),
                        "surname": row_dict.get("surname", ""),
                        "first_name": row_dict.get("first_name", ""),
                        "father_name": row_dict.get("father_name", ""),
                        "relative_name_mr": row_dict.get("father_name", ""),
                        "relation_type": "Father",
                        "membership_number": clean_membership_number(row_dict.get("membership_number", "")),
                        "epic_number": clean_membership_number(row_dict.get("membership_number", "")),
                        "village_mr": row_dict.get("village_mr", ""),
                        "mobile_number": clean_mobile_number(row_dict.get("mobile_number", "")),
                        "status": "ACTIVE"
                    }
                    records.append(rec)

        return records

    # ---------------- STRATEGY 3: pdfplumber 2D Tables ----------------
    @classmethod
    def parse_pdfplumber_tables(cls, tables: List[List[List[str]]]) -> List[Dict[str, Any]]:
        records = []
        for table in tables:
            if not table or len(table) < 2:
                continue

            header_idx = -1
            header_row = []
            for idx, row in enumerate(table):
                row_str = " ".join(str(c or "") for c in row)
                if cls.is_header_line(row_str):
                    header_idx = idx
                    header_row = [normalize_marathi_text(str(c or "")).lower() for c in row]
                    break

            if header_idx == -1:
                continue

            # Map column indices
            col_map = {}
            for col_idx, col_name in enumerate(header_row):
                for target_field, patterns in HEADER_FIELD_PATTERNS.items():
                    if any(re.search(p, col_name) for p in patterns):
                        col_map[col_idx] = target_field
                        break

            # Parse data rows
            for row in table[header_idx + 1:]:
                rec: Dict[str, Any] = {}
                for c_idx, val in enumerate(row):
                    if c_idx in col_map:
                        rec[col_map[c_idx]] = normalize_marathi_text(str(val or ""))

                # Check if row is valid
                sr_str = to_arabic_num(rec.get("serial_number", ""))
                name_val = rec.get("full_name_mr") or rec.get("first_name")
                if sr_str.isdigit() or name_val:
                    rec["serial_number"] = int(sr_str) if sr_str.isdigit() else len(records) + 1
                    if "membership_number" in rec:
                        rec["membership_number"] = clean_membership_number(rec["membership_number"])
                        if "epic_number" not in rec or not rec["epic_number"]:
                            rec["epic_number"] = rec["membership_number"]
                    if "mobile_number" in rec:
                        rec["mobile_number"] = clean_mobile_number(rec["mobile_number"])
                    if "father_name" in rec and "relative_name_mr" not in rec:
                        rec["relative_name_mr"] = rec["father_name"]
                        rec["relation_type"] = "Father"
                    records.append(rec)

        return records

    # ---------------- STRATEGY 4: Electoral Roll Voter Card Boxes (ECI Format) ----------------
    @classmethod
    def parse_electoral_roll_cards(cls, pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        voters = []
        for page in pages:
            page_text = page.get("text", "")
            if not page_text or len(page_text.strip()) < 20:
                continue

            # Header info
            village_match = re.search(r'(?:गाव|मूळ\s*नगर\s*किंवा\s*गाव)\s*[:\-]\s*([^\n\r,]+)', page_text)
            village_name = normalize_marathi_text(village_match.group(1)) if village_match else "साखराळे"

            # Split card blocks by EPIC or voter name markers
            card_blocks = re.split(r'(?=(?:[0-9०-९]{1,4}\s+[A-Z]{3}[0-9]{7})|(?:नाव\s*[:\-]))', page_text)
            for block in card_blocks:
                if "नाव" in block and ("वय" in block or "लिंग" in block or "घर क्रमांक" in block):
                    joined = normalize_marathi_text(block)
                    
                    # 1. EPIC
                    epic_match = re.search(r'([A-Z]{3}[0-9]{7}|[A-Z]{2}[0-9]{7,8}|[A-Z]{3}/[0-9]{6,8})', joined)
                    epic_number = epic_match.group(1) if epic_match else None

                    # 2. Serial Number
                    sr_match = re.search(r'(?:^|\n)\s*([0-9०-९]{1,4})\s*(?:\n|[A-Z]{3}|$)', joined)
                    serial_number = int(to_arabic_num(sr_match.group(1))) if sr_match else len(voters) + 1

                    # 3. Voter Name
                    name_match = re.search(r'नाव\s*[:\-]\s*([^\n\r]+)', joined)
                    full_name = normalize_marathi_text(name_match.group(1)) if name_match else ""
                    if not full_name:
                        continue

                    # 4. Relative
                    rel_match = re.search(r'(वडिलांचे|पतीचे|आईचे|इतर)\s*नाव\s*[:\-]\s*([^\n\r]+)', joined)
                    relative_name = normalize_marathi_text(rel_match.group(2)) if rel_match else ""
                    rel_type = "Father"
                    if rel_match:
                        lbl = rel_match.group(1)
                        if "पती" in lbl:
                            rel_type = "Husband"
                        elif "आई" in lbl:
                            rel_type = "Mother"

                    # 5. House No
                    house_match = re.search(r'घर\s*क्रमांक\s*[:\-]\s*([^\n\r]+)', joined)
                    house_no = to_arabic_num(house_match.group(1).strip()) if house_match else ""

                    # 6. Age
                    age_match = re.search(r'वय\s*[:\-]\s*([0-9०-९]+)', joined)
                    age_val = int(to_arabic_num(age_match.group(1))) if age_match else None

                    # 7. Gender
                    gender_match = re.search(r'लिंग\s*[:\-]\s*(महिला|पुरुष|स्त्री|तृतीय\s*पंथी)', joined)
                    gender = "Male"
                    if gender_match:
                        g_str = gender_match.group(1)
                        if "महिला" in g_str or "स्त्री" in g_str:
                            gender = "Female"
                        elif "तृतीय" in g_str:
                            gender = "Other"

                    s, f, fa = parse_marathi_name(full_name)

                    voters.append({
                        "serial_number": serial_number,
                        "epic_number": epic_number or f"M-{serial_number}",
                        "membership_number": epic_number or f"M-{serial_number}",
                        "full_name_mr": full_name,
                        "surname": s,
                        "first_name": f,
                        "father_name": fa or relative_name,
                        "relative_name_mr": relative_name or fa,
                        "relation_type": rel_type,
                        "house_number": house_no,
                        "age": age_val,
                        "gender": gender,
                        "village_mr": village_name,
                        "mobile_number": "",
                        "status": "ACTIVE"
                    })

        return voters

def parse_records(raw_data: Dict[str, Any], pdf_path: Optional[Union[str, Path]] = None) -> List[Dict[str, Any]]:
    """
    Main extraction interface. Tries strategies in descending order of precision:
    1. Block-based tabular parser (for voter lists with explicit row blocks)
    2. Coordinate-interval parser (for borderless aligned multi-column tables)
    3. pdfplumber 2D table parser (for grid tables)
    4. ECI Voter card boxes parser (for official 30-box electoral roll pages)
    """
    pages = raw_data.get("pages", [])
    tables = raw_data.get("tables", [])

    # Strategy 1: Block-based Tabular
    records = TableParser.parse_blocks_table(pages)
    if records:
        return records

    # Strategy 2: Coordinate-based Tabular
    records = TableParser.parse_coordinate_table(pages)
    if records:
        return records

    # Strategy 3: pdfplumber Tables
    if tables:
        records = TableParser.parse_pdfplumber_tables(tables)
        if records:
            return records

    # Strategy 4: Electoral Roll Card Boxes
    records = TableParser.parse_electoral_roll_cards(pages)
    if records:
        return records

    # If no records were extracted
    return []
