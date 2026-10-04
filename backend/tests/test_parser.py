import pytest
from app.pdf_processing.parser import ElectoralRollParser, to_arabic_num
from app.pdf_processing.mapper import FieldMapper
from app.pdf_processing.validator import RecordValidator

def test_to_arabic_num():
    assert to_arabic_num("१२३४५") == "12345"
    assert to_arabic_num("६७८९०") == "67890"
    assert to_arabic_num("123") == "123"

def test_parse_voter_card():
    card_sample = """
    1 XTX7477128
    नाव : सोनाली वनिता भंडारे
    वडिलांचे नाव: वनिता भंडारे
    घर क्रमांक: 12
    वय : 28 लिंग : महिला
    छायाचित्र उपलब्ध
    """
    parsed = ElectoralRollParser.parse_voter_card(card_sample)
    assert parsed is not None
    assert parsed["epic_number"] == "XTX7477128"
    assert parsed["full_name_mr"] == "सोनाली वनिता भंडारे"
    assert parsed["surname"] == "सोनाली"
    assert parsed["first_name"] == "वनिता"
    assert parsed["relative_name_mr"] == "वनिता भंडारे"
    assert parsed["relation_type"] == "Father"
    assert parsed["house_number"] == "12"
    assert parsed["age"] == 28
    assert parsed["gender"] == "Female"

def test_parse_husband_relation():
    card_sample = """
    3 XTX6650006
    नाव : लता अतुल दंडवते
    पतीचे नाव: अतुल दंडवते
    घर क्रमांक: 12
    वय : 47 लिंग : महिला
    छायाचित्र उपलब्ध
    """
    parsed = ElectoralRollParser.parse_voter_card(card_sample)
    assert parsed is not None
    assert parsed["relation_type"] == "Husband"
    assert parsed["gender"] == "Female"

def test_field_mapper():
    raw = {
        "मतदाराचे नाव": "अतुल दंडवते",
        "वय": "54",
        "लिंग": "पुरुष",
        "घर क्रमांक": "12",
        "ओळखपत्र": "XTX6650014"
    }
    mapper = FieldMapper()
    mapped = mapper.map_record(raw)
    assert mapped["full_name_mr"] == "अतुल दंडवते"
    assert mapped["age"] == "54"
    assert mapped["gender"] == "पुरुष"
    assert mapped["epic_number"] == "XTX6650014"

def test_record_validator():
    valid_rec = {
        "full_name_mr": "सचिन सूर्यवंशी",
        "age": 35,
        "epic_number": "XTX1234567"
    }
    seen = set()
    is_valid, errors, is_dup = RecordValidator.validate_single(valid_rec, seen)
    assert is_valid is True
    assert len(errors) == 0
    assert is_dup is False

    # Second time with same epic should detect duplicate
    is_valid_2, errors_2, is_dup_2 = RecordValidator.validate_single(valid_rec, seen)
    assert is_dup_2 is True
