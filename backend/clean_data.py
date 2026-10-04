import os
import sys
from datetime import datetime
from pymongo import MongoClient

# Ensure app can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config.config import settings
from app.auth.security import get_password_hash

def clean_database():
    print("Connecting to MongoDB:", settings.MONGODB_URL, settings.MONGODB_DB_NAME)
    client = MongoClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    # 1. Delete all non-admin users
    del_users = db.users.delete_many({"username": {"$ne": "admin"}})
    print(f"MongoDB non-admin users deleted: {del_users.deleted_count}")

    # Ensure admin user exists with active credentials
    admin_doc = {
        "username": "admin",
        "fullName": "System Administrator",
        "mobileNumber": "9822011223",
        "hashedPassword": get_password_hash("admin123"),
        "role": "ADMIN",
        "accountStatus": "ACTIVE",
        "assignedVillages": [],
        "permissions_granted": True,
        "createdAt": datetime.utcnow(),
        "createdBy": "system"
    }
    db.users.update_one({"username": "admin"}, {"$set": admin_doc}, upsert=True)
    print("Admin user verified: username='admin', password='admin123', role='ADMIN'")

    # 2. Delete all members / voters
    res_mem = db.members.delete_many({})
    print(f"MongoDB members deleted: {res_mem.deleted_count}")

    # 3. Delete families, import jobs, import records, app activities, audit logs
    res_fam = db.families.delete_many({})
    res_jobs = db.import_jobs.delete_many({})
    res_rec = db.import_records.delete_many({})
    res_act = db.app_activities.delete_many({})
    res_audit = db.audit_logs.delete_many({})
    print(f"Deleted families: {res_fam.deleted_count}, import_jobs: {res_jobs.deleted_count}, activities: {res_act.deleted_count}, audit: {res_audit.deleted_count}")

    # 4. Reset village stats
    db.villages.update_many({}, {
        "$set": {
            "stats.totalVoters": 0,
            "stats.activeMembers": 0,
            "stats.deceasedMembers": 0,
            "stats.totalFamilies": 0,
            "stats.categorizedMembers": 0,
            "sourceFilesCount": 0
        }
    })
    print("Village statistics reset to 0.")

    # 5. Clean SQLite database
    import sqlite3
    db_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "election_app.db")
    if os.path.exists(db_file):
        conn = sqlite3.connect(db_file)
        cur = conn.cursor()
        cur.execute("DELETE FROM users WHERE username != 'admin'")
        cur.execute("UPDATE users SET hashed_password = ? WHERE username = 'admin'", (get_password_hash("admin123"),))
        cur.execute("DELETE FROM members")
        cur.execute("DELETE FROM families")
        cur.execute("DELETE FROM import_jobs")
        cur.execute("DELETE FROM import_records")
        cur.execute("DELETE FROM audit_logs")
        cur.execute("DELETE FROM sync_history")
        conn.commit()
        conn.close()
        print("SQLite election_app.db cleaned.")

    print("\nSUCCESS: All dummy data cleared! Only admin authentication remains.")
    print("Remaining users in MongoDB:")
    for u in db.users.find({}, {"username": 1, "role": 1, "accountStatus": 1}):
        print(" -", u)

if __name__ == "__main__":
    clean_database()
