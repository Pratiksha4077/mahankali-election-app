import re
import unicodedata
from typing import Tuple, Optional

# Marathi Devanagari digits to standard Arabic digits
MARATHI_DIGITS = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
}

# Arabic digits to Marathi Devanagari digits
ARABIC_TO_MARATHI_DIGITS = {v: k for k, v in MARATHI_DIGITS.items()}

# Unicode dashes/hyphens to ASCII hyphen-minus
UNICODE_DASHES = [
    '\u2010',  # hyphen
    '\u2011',  # non-breaking hyphen
    '\u2012',  # figure dash
    '\u2013',  # en dash
    '\u2014',  # em dash
    '\u2015',  # horizontal bar
    '\u2212',  # minus sign
    '\ufe58',  # small em dash
    '\ufe63',  # small hyphen-minus
    '\uff0d',  # fullwidth hyphen-minus
]

def to_arabic_num(text: Optional[str]) -> str:
    """Converts Devanagari/Marathi numerals to standard Arabic digits (0-9)."""
    if not text:
        return ""
    res = []
    for ch in str(text):
        res.append(MARATHI_DIGITS.get(ch, ch))
    return "".join(res)

def to_marathi_num(text: Optional[str]) -> str:
    """Converts standard Arabic digits (0-9) to Devanagari/Marathi numerals."""
    if not text:
        return ""
    res = []
    for ch in str(text):
        res.append(ARABIC_TO_MARATHI_DIGITS.get(ch, ch))
    return "".join(res)

def normalize_marathi_text(text: Optional[str]) -> str:
    """
    Cleans and normalizes Marathi Devanagari Unicode text.
    - Canonical Unicode normalization (NFC)
    - Replaces non-breaking space (\\xa0) and thin spaces
    - Standardizes Unicode hyphens to ASCII '-'
    - Collapses multiple whitespace characters
    - Preserves Marathi matras, conjuncts, and Devanagari codepoints
    """
    if not text:
        return ""
    
    # 1. NFC normalization ensures combined glyphs are canonically composed
    normalized = unicodedata.normalize('NFC', str(text))
    
    # 2. Replace non-breaking and special spaces
    normalized = normalized.replace('\xa0', ' ').replace('\u202f', ' ').replace('\u2007', ' ')
    
    # 3. Normalize Unicode dashes
    for dash in UNICODE_DASHES:
        normalized = normalized.replace(dash, '-')
        
    # 4. Remove stray soft hyphens or BOM
    normalized = normalized.replace('\xad', '').replace('\ufeff', '')
    
    # 5. Collapse excessive whitespace
    normalized = re.sub(r'[ \t\r\f\v]+', ' ', normalized)
    
    return normalized.strip()

def clean_mobile_number(text: Optional[str]) -> str:
    """
    Extracts and standardizes 10-digit Indian mobile numbers.
    Converts Marathi digits, strips +91 country prefix if present.
    """
    if not text:
        return ""
    
    # First convert any Marathi digits
    raw = to_arabic_num(str(text))
    
    # Keep only digits
    digits_only = re.sub(r'\D', '', raw)
    
    # Handle country prefix: e.g. 919172474077 -> 9172474077
    if len(digits_only) == 12 and digits_only.startswith('91'):
        digits_only = digits_only[2:]
    elif len(digits_only) == 11 and digits_only.startswith('0'):
        digits_only = digits_only[1:]
        
    return digits_only

def clean_membership_number(text: Optional[str]) -> str:
    """
    Standardizes membership / booth / EPIC identifiers.
    e.g. 'B‐1' (Unicode hyphen) -> 'B-1'
    """
    if not text:
        return ""
    norm = normalize_marathi_text(str(text))
    # Replace any Devanagari numerals in membership codes (e.g. B-१ -> B-1)
    norm = to_arabic_num(norm)
    return norm.strip()

def parse_marathi_name(full_name: Optional[str]) -> Tuple[str, str, str]:
    """
    Splits Marathi full name into (surname, first_name, father_name).
    In Maharashtra voter lists:
    Format: 'पाटील सचिन आनंदराव' -> Surname='पाटील', First='सचिन', Father='आनंदराव'
    If only 2 words: 'पाटील सचिन' -> Surname='पाटील', First='सचिन', Father=''
    If 1 word: 'सचिन' -> Surname='', First='सचिन', Father=''
    """
    if not full_name:
        return "", "", ""
    
    cleaned = normalize_marathi_text(full_name)
    parts = cleaned.split()
    
    if len(parts) >= 3:
        surname = parts[0]
        first_name = parts[1]
        father_name = " ".join(parts[2:])
    elif len(parts) == 2:
        surname = parts[0]
        first_name = parts[1]
        father_name = ""
    elif len(parts) == 1:
        surname = ""
        first_name = parts[0]
        father_name = ""
    else:
        surname = ""
        first_name = ""
        father_name = ""
        
    return surname, first_name, father_name
