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
