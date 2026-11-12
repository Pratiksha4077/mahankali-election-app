import pandas as pd
from typing import List, Dict, Any
from pathlib import Path
import logging

logger = logging.getLogger("election_app.excel_reader")

class ExcelReader:
    """
    Reads tabular data from .xlsx, .xls, and .csv files.
    Supports multi-sheet Google Sheets / Excel workbooks and selects the voter list sheet.
    """

    @staticmethod
    def read_file(file_path: Path) -> List[Dict[str, Any]]:
        ext = file_path.suffix.lower()
        if ext == ".csv":
            try:
                df = pd.read_csv(file_path, dtype=str, encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, dtype=str, encoding="cp1252")
        elif ext in [".xlsx", ".xls"]:
            # Load workbook and select the most appropriate sheet
            xl = pd.ExcelFile(file_path)
            sheet_names = xl.sheet_names

            target_sheet = sheet_names[0]
            if len(sheet_names) > 1:
                # Priority 1: Check for known voter sheet names in Marathi or English
                candidate_names = ["मतदार यादी", "मतदार", "voters", "voter list", "voter", "list", "यादी", "data"]
                found_candidate = False
                for c in candidate_names:
                    for s in sheet_names:
                        if c.lower() in s.lower():
                            target_sheet = s
                            found_candidate = True
                            break
                    if found_candidate:
                        break

                # Priority 2: If no obvious sheet name, find sheet with highest row count containing voter columns
                if not found_candidate:
                    best_sheet = sheet_names[0]
                    max_score = -1
                    voter_col_keywords = ["नाव", "name", "अनुक्रमांक", "epic", "sr", "वय", "age", "घर", "house"]
                    for s in sheet_names:
                        try:
                            s_df = xl.parse(s, nrows=10, dtype=str)
                            cols = [str(col).lower() for col in s_df.columns]
                            match_count = sum(1 for kw in voter_col_keywords if any(kw in c for c in cols))
                            if match_count > max_score:
                                max_score = match_count
                                best_sheet = s
                        except Exception:
                            continue
                    target_sheet = best_sheet

            logger.info(f"[ExcelReader] Reading sheet '{target_sheet}' from '{file_path.name}' (available sheets: {sheet_names})")
            df = xl.parse(target_sheet, dtype=str)
        else:
            raise ValueError(f"Unsupported spreadsheet format: {ext}")

        # Replace NaN with None
        df = df.where(pd.notnull(df), None)
        # Strip string whitespace
        records = df.to_dict(orient="records")
        cleaned_records = []
        for row in records:
            clean_row = {}
            for k, v in row.items():
                k_clean = str(k).strip()
                v_clean = str(v).strip() if v is not None else None
                clean_row[k_clean] = v_clean
            cleaned_records.append(clean_row)
        return cleaned_records
