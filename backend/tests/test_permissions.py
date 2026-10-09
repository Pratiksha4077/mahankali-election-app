import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_admin_cannot_grant_device_permissions_remotely():
    """Verify Admin must NOT be able to grant device permissions remotely."""
    # 1. Login as admin
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Attempt to grant device permissions remotely
    patch_res = client.patch(
        "/api/admin/users/some_user_id/permissions",
        json={"permissions_granted": True},
        headers=headers
    )
    # Must be rejected with 400 Bad Request
    assert patch_res.status_code == 400
    assert "दूरस्थपणे" in patch_res.json()["detail"] or "remotely" in patch_res.json()["detail"].lower()

def test_user_self_permissions_update():
    """Verify User can report actual device permissions via self-permissions."""
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # User reports physical device permissions
    post_res = client.post(
        "/api/admin/users/self-permissions",
        json={
            "permissions_granted": False,
            "permissions": {
                "location": True,
                "callHistory": False,
                "sms": False
            }
        },
        headers=headers
    )
    assert post_res.status_code == 200
    assert post_res.json()["success"] is True

def test_telephony_sync_and_activity_reporting():
    """Verify Telephony sync stores calls and SMS metadata and reflects in Admin Activity endpoint."""
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    user_id = login_res.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Sync genuine device call log and SMS metadata
    sync_payload = {
        "callStatus": "GRANTED",
        "smsStatus": "GRANTED",
        "calls": [
            {
                "recordId": "call_101",
                "phoneNumber": "+919876543210",
                "name": "राम पाटील",
                "callType": "INCOMING",
                "duration": 45,
                "timestamp": 1728500000000
            }
        ],
        "sms": [
            {
                "recordId": "sms_201",
                "address": "+919876543210",
                "smsType": "SENT",
                "timestamp": 1728500005000
            }
        ]
    }
    sync_res = client.post(
        "/api/admin/users/activity/telephony-sync",
        json=sync_payload,
        headers=headers
    )
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert sync_data["success"] is True
    assert sync_data["data"]["saved_calls"] >= 1
    assert sync_data["data"]["saved_sms"] >= 1

    # 2. Query admin activity for user
    act_res = client.get(f"/api/admin/users/{user_id}/activity", headers=headers)
    assert act_res.status_code == 200
    act_data = act_res.json()["data"]
    assert act_data["call_count"] >= 1
    assert act_data["sms_count"] >= 1
    assert act_data["call_status"] == "GRANTED"
    assert act_data["sms_status"] == "GRANTED"
    assert any(c.get("metadata", {}).get("phone") == "+919876543210" for c in act_data["calls"])
    assert any(s.get("metadata", {}).get("address") == "+919876543210" for s in act_data["sms"])

