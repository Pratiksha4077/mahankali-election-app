import os
import shutil
from typing import List, Dict, Any, Union
from pathlib import Path
import fitz
from PIL import Image
import io
import logging

logger = logging.getLogger("election_app.ocr")

def _configure_tesseract():
    try:
        import pytesseract
        if not shutil.which("tesseract"):
            win_paths = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe")
            ]
            for p in win_paths:
                if os.path.exists(p):
                    pytesseract.pytesseract.tesseract_cmd = p
                    break
        return True
    except Exception:
        return False

class OCRProcessor:
    """
    OCR processor for scanned electoral PDFs.
    Uses pytesseract with Marathi (mar) & English (eng) models if available.
    """

    @staticmethod
    def is_ocr_available() -> bool:
        try:
            import pytesseract
            _configure_tesseract()
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    @staticmethod
    def ocr_page(page: fitz.Page) -> str:
        """Renders page as high-res pixmap and performs OCR."""
        try:
            import pytesseract
            _configure_tesseract()
            pix = page.get_pixmap(dpi=200)
            img_bytes = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_bytes))
            try:
                langs = pytesseract.get_languages()
                lang_param = "mar+eng" if "mar" in langs else "eng"
            except Exception:
                lang_param = "mar+eng"
            text = pytesseract.image_to_string(image, lang=lang_param)
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
