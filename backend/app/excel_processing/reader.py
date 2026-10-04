import pandas as pd
from typing import List, Dict, Any
from pathlib import Path

class ExcelReader:
    """
    Reads tabular data from .xlsx, .xls, and .csv files.
    """

    @staticmethod
    def read_file(file_path: Path) -> List[Dict[str, Any]]:
        ext = file_path.suffix.lower()
        if ext == ".csv":
            df = pd.read_csv(file_path, dtype=str)
        elif ext in [".xlsx", ".xls"]:
            df = pd.read_excel(file_path, dtype=str)
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
