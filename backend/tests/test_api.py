import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_login_admin():
    response = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ADMIN"
    return data["access_token"]

def test_login_user():
    response = client.post("/api/auth/login", json={"username": "rupesh_sir", "password": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["username"] == "rupesh_sir"

def test_get_villages():
    token = test_login_admin()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/villages", headers=headers)
    assert response.status_code == 200
    villages = response.json()
    assert len(villages) >= 3
    names = [v["name_mr"] for v in villages]
    assert "साखराळे" in names
    assert "अग्रण धुळगांव" in names

def test_get_members_search():
    token = test_login_admin()
    headers = {"Authorization": f"Bearer {token}"}
    # Search for reference voter from sample PDF
    response = client.get("/api/members?q=पोक्षे", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert "पोक्षे" in data["items"][0]["full_name_mr"]

def test_reports_village():
    token = test_login_admin()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/reports/village", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_admin_dashboard_stats():
    token = test_login_admin()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/admin/dashboard", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_users"] >= 2
    assert data["total_members"] >= 10

def test_admin_user_management():
    token = test_login_admin()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/admin/users", headers=headers)
    assert response.status_code == 200
    users_data = response.json()["data"]["items"]
    assert len(users_data) >= 2

def test_family_routes():
    token = test_login_admin()
    headers = {"Authorization": f"Bearer {token}"}
    # Get any member id
    mem_res = client.get("/api/members?limit=1", headers=headers)
    assert mem_res.status_code == 200
    items = mem_res.json()["items"]
    if items:
        mid = items[0]["id"]
        fam_res = client.get(f"/api/members/{mid}/family", headers=headers)
        assert fam_res.status_code == 200
        assert fam_res.json()["success"] is True
