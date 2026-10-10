import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_family_voter_management_and_clean_demographics():
    # 1. Login as admin
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Fetch list of voters to get an active member
    voters_res = client.get("/api/members?limit=5", headers=headers)
    assert voters_res.status_code == 200
    voters_data = voters_res.json()
    items = voters_data.get("items") or voters_data.get("data") or []
    assert len(items) > 0, "No voters found in database"
    member_id = str(items[0]["id"])

    # 3. Add a voter family member with complete voter details
    family_payload = {
        "nameMarathi": "चाचणी कुटुंब मतदार",
        "relationType": "Son",
        "serialNumber": "9999",
        "epicNumber": "TEST9999999",
        "gender": "Male",
        "mobileNumber": "9876543210",
        "age": 28,
        "religion": "हिंदू",
        "caste": "मराठा",
        "profession": "नोकरी",
        "designation": "कार्यकर्ता"
    }
    add_res = client.post(f"/api/members/{member_id}/family", json=family_payload, headers=headers)
    assert add_res.status_code == 200, f"Add family member failed: {add_res.text}"
    add_data = add_res.json()
    assert add_data["success"] is True
    created_member_id = add_data["data"]["id"]

    # 4. Retrieve family members
    get_res = client.get(f"/api/members/{member_id}/family", headers=headers)
    assert get_res.status_code == 200
    family_info = get_res.json()["data"]
    members_list = family_info["members"]
    assert any(m["id"] == created_member_id for m in members_list), "Added family member not in family list"
    
    # Verify complete voter details in family response
    added_in_list = next(m for m in members_list if m["id"] == created_member_id)
    assert added_in_list["epicNumber"] == "TEST9999999"
    assert str(added_in_list["serialNumber"]) == "9999"
    assert added_in_list["mobileNumber"] == "9876543210"
    assert added_in_list["age"] == 28
    assert added_in_list["relationType"] == "Son"

    # 5. Verify direct member detail persistence
    member_res = client.get(f"/api/members/{created_member_id}", headers=headers)
    assert member_res.status_code == 200
    m_data = member_res.json()
    assert m_data.get("epic_number") == "TEST9999999" or m_data.get("epicNumber") == "TEST9999999"

    # 6. Clean up the test family member and verify deletion
    del_res = client.delete(f"/api/members/{member_id}/family/{created_member_id}", headers=headers)
    assert del_res.status_code == 200
    
    # 7. Check report endpoints have no fake Not Specified
    rel_res = client.get("/api/reports/religion", headers=headers)
    assert rel_res.status_code == 200
    raw_rel = rel_res.json()
    rel_items = raw_rel if isinstance(raw_rel, list) else raw_rel.get("data", [])
    assert not any(item.get("key") == "Not Specified" for item in rel_items), "Found fake Not Specified in religion report"

    caste_res = client.get("/api/reports/caste", headers=headers)
    assert caste_res.status_code == 200
    raw_caste = caste_res.json()
    caste_items = raw_caste if isinstance(raw_caste, list) else raw_caste.get("data", [])
    assert not any(item.get("key") == "Not Specified" for item in caste_items), "Found fake Not Specified in caste report"

    prof_res = client.get("/api/reports/profession", headers=headers)
    assert prof_res.status_code == 200
    raw_prof = prof_res.json()
    prof_items = raw_prof if isinstance(raw_prof, list) else raw_prof.get("data", [])
    assert not any(item.get("key") == "Not Specified" for item in prof_items), "Found fake Not Specified in profession report"

    print("Family & Reports test passed successfully!")
