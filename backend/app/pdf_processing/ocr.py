import os
from typing import List, Dict, Any, Union
from pathlib import Path
import fitz
from PIL import Image
import io

class OCRProcessor:
    """
    OCR processor for scanned electoral PDFs.
    Uses pytesseract with Marathi (mar) & English (eng) models if available.
    """

    @staticmethod
    def is_ocr_available() -> bool:
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    @staticmethod
    def ocr_page(page: fitz.Page) -> str:
        """Renders page as high-res pixmap and performs OCR."""
        try:
            import pytesseract
            pix = page.get_pixmap(dpi=200)
            img_bytes = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_bytes))
            text = pytesseract.image_to_string(image, lang="mar+eng")
            return text
        except Exception as e:
            return f"[OCR not configured on host: {str(e)}]"

    @staticmethod
    def process_scanned_pdf(file_path: Union[str, Path]) -> List[Dict[str, Any]]:
        path = Path(file_path)
        doc = fitz.open(str(path))
        results = []
        for pno, page in enumerate(doc):
            text = OCRProcessor.ocr_page(page)
            results.append({
                "page_number": pno + 1,
                "text": text,
                "blocks": [],
                "words": []
            })
        doc.close()
        return results

def extract_using_ocr(pdf_path: Union[str, Path]) -> Dict[str, Any]:
    """
    Pipeline step for scanned PDFs: performs OCR extraction across pages.
    """
    path = Path(pdf_path)
    ocr_available = OCRProcessor.is_ocr_available()
    
    if not ocr_available:
        return {
            "source_type": "SCANNED",
            "ocr_applied": False,
            "error": "OCR engine (Tesseract) is not installed or configured on the host system.",
            "pages": []
        }
    
    pages = OCRProcessor.process_scanned_pdf(path)
    return {
        "source_type": "SCANNED",
        "ocr_applied": True,
        "error": None,
        "pages": pages
    }
