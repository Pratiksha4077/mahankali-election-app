import fitz  # PyMuPDF
import pdfplumber
from typing import Dict, Any, List, Union, Optional
from pathlib import Path
from app.pdf_processing.detector import inspect_pdf_metadata, detect_pdf_type

class PDFExtractor:
    """
    Extracts text, blocks, words with coordinates, and tabular structures from digital PDFs.
    Uses PyMuPDF (fitz) for high performance and pdfplumber for advanced table analysis.
    """

    @staticmethod
    def inspect_pdf(file_path: Union[str, Path]) -> Dict[str, Any]:
        """Inspects page count, file size, and checks if pages have selectable text."""
        return inspect_pdf_metadata(file_path)

    @staticmethod
    def extract_pages_text(
        file_path: Union[str, Path],
        start_page: int = 0,
        end_page: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Extracts raw text, bounding blocks, and words from each page.
        """
        path = Path(file_path)
        doc = fitz.open(str(path))
        if end_page is None or end_page > len(doc):
            end_page = len(doc)

        extracted = []
        for pno in range(start_page, end_page):
            page = doc[pno]
            text = page.get_text("text")
            blocks = page.get_text("blocks")  # (x0, y0, x1, y1, text, block_no, block_type)
            words = page.get_text("words")    # (x0, y0, x1, y1, word, block_no, line_no, word_no)
            
            extracted.append({
                "page_number": pno + 1,
                "text": text,
                "blocks": blocks,
                "words": words,
                "rect": (page.rect.width, page.rect.height)
            })

        doc.close()
        return extracted

    @staticmethod
    def extract_tables_with_pdfplumber(file_path: Union[str, Path]) -> List[List[List[str]]]:
        """
        Attempts to extract grid tables using pdfplumber line and text heuristics.
        """
        path = Path(file_path)
        all_tables = []
        try:
            with pdfplumber.open(str(path)) as pdf:
                for page in pdf.pages:
                    # Strategy 1: standard lines
                    tabs = page.extract_tables()
                    if tabs:
                        all_tables.extend(tabs)
                    else:
                        # Strategy 2: text strategy
                        tabs_text = page.extract_tables({
                            "vertical_strategy": "text",
                            "horizontal_strategy": "text"
                        })
                        if tabs_text:
                            all_tables.extend(tabs_text)
        except Exception:
            pass
        return all_tables


def extract_table_from_pdf(pdf_path: Union[str, Path]) -> Dict[str, Any]:
    """
    Standard pipeline extractor for selectable text PDFs.
    Returns structured raw_data container containing page texts, blocks, words, and tables.
    """
    path = Path(pdf_path)
    metadata = inspect_pdf_metadata(path)
    pages = PDFExtractor.extract_pages_text(path)
    tables = PDFExtractor.extract_tables_with_pdfplumber(path)

    return {
        "source_type": "TEXT",
        "file_name": path.name,
        "metadata": metadata,
        "pages": pages,
        "tables": tables,
        "error": None
    }
