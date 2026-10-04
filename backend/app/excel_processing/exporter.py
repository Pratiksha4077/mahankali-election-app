import pandas as pd
from typing import List, Dict, Any
from pathlib import Path
from datetime import datetime

from app.config.config import settings
from app.pdf_processing.excel_generator import ExcelGenerator

class DataExporter:
    """
    Exports voter query sets or report outputs to .xlsx or .csv.
    """

    @staticmethod
    def export_to_excel(records: List[Dict[str, Any]], filename_prefix: str = "voters_export") -> Path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{filename_prefix}_{timestamp}.xlsx"
        output_path = settings.EXPORT_DIR / filename
        return ExcelGenerator.generate_voter_excel(records, output_path, title=f"Export: {filename_prefix}")

    @staticmethod
    def export_to_csv(records: List[Dict[str, Any]], filename_prefix: str = "voters_export") -> Path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{filename_prefix}_{timestamp}.csv"
        output_path = settings.EXPORT_DIR / filename
        df = pd.DataFrame(records)
        df.to_csv(output_path, index=False, encoding="utf-8-sig") # utf-8-sig preserves Marathi characters in Excel
        return output_path
