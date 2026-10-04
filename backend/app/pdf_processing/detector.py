import os
from pathlib import Path
from typing import Dict, Any, Union
import fitz  # PyMuPDF

def detect_pdf_type(pdf_path: Union[str, Path]) -> str:
    """
    Analyzes whether the PDF contains selectable digital text ('TEXT')
    or scanned raster page images ('SCANNED').
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found at: {path}")

    doc = fitz.open(str(path))
    total_pages = len(doc)
    if total_pages == 0:
        doc.close()
        return "SCANNED"

    total_text_chars = 0
    pages_to_check = min(total_pages, 5)

    for i in range(pages_to_check):
        page_text = doc[i].get_text().strip()
        total_text_chars += len(page_text)

    doc.close()

    avg_chars = total_text_chars / max(pages_to_check, 1)

    # If the PDF contains at least 30 characters on average per page, it's digital text
    if avg_chars >= 25:
        return "TEXT"
    return "SCANNED"

def inspect_pdf_metadata(pdf_path: Union[str, Path]) -> Dict[str, Any]:
    """
    Full metadata analysis of the PDF document.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found at: {path}")

    doc = fitz.open(str(path))
    total_pages = len(doc)
    total_chars = 0
    has_text = False

    pages_to_sample = min(total_pages, 5)
    for i in range(pages_to_sample):
        text = doc[i].get_text().strip()
        total_chars += len(text)
        if len(text) > 30:
            has_text = True

    doc.close()

    pdf_type = "TEXT" if has_text else "SCANNED"
    avg_chars = total_chars / max(pages_to_sample, 1)

    return {
        "file_name": path.name,
        "file_size": path.stat().st_size,
        "total_pages": total_pages,
        "pdf_type": pdf_type,
        "has_selectable_text": has_text,
        "is_scanned": not has_text,
        "avg_chars_per_page": round(avg_chars, 1)
    }
