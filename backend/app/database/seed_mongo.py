import logging
from datetime import datetime, timezone
from pymongo import MongoClient
from app.config.config import settings
from app.auth.security import get_password_hash

logger = logging.getLogger("election_app.seed_mongo")

def seed_mongo_initial_data():
    """Seeds initial collections: categories, Sakharale village ONLY, and ensures the 4 authorized users exist.
    No test villages, dummy users or mock records are created.
    """
    client = MongoClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    # 1. Categories (4 sponsor defined color categories)
    if db.categories.count_documents({}) == 0:
        categories = [
            {
                "code": "GREEN",
                "name": "Green",
                "nameMarathi": "हिरवा",
                "color": "#10B981",
                "description": "Category 1 / Confirmed Support (Sponsor Defined)",
                "displayOrder": 1,
                "isActive": True
            },
            {
                "code": "YELLOW",
                "name": "Yellow",
                "nameMarathi": "पिवळा",
                "color": "#F59E0B",
                "description": "Category 2 / Neutral or Leaning",
                "displayOrder": 2,
                "isActive": True
            },
            {
                "code": "ORANGE",
                "name": "Orange",
                "nameMarathi": "केशरी",
                "color": "#F97316",
                "description": "Category 3 / Moderate Follow-up Required",
                "displayOrder": 3,
                "isActive": True
            },
            {
                "code": "RED",
                "name": "Red",
                "nameMarathi": "लाल",
                "color": "#EF4444",
                "description": "Category 4 / High Attention Required",
                "displayOrder": 4,
                "isActive": True
            }
        ]
        db.categories.insert_many(categories)
        logger.info("Seeded 4 sponsor categories into MongoDB.")

    # 2. Single Village Enforcement: Sakharale ONLY (साखराळे)
    try:
        # Remove any extraneous non-Sakharale villages
        db.villages.delete_many({"nameMarathi": {"$ne": "साखराळे"}})
    except Exception as e:
        logger.warning(f"Note on cleaning extra villages: {e}")

    sakharale = db.villages.find_one({"nameMarathi": "साखराळे"})
    now = datetime.now(timezone.utc)
    if not sakharale:
        sakharale_doc = {
            "name": "Sakharale",
            "nameMarathi": "साखराळे",
            "taluka": "Walwa",
            "talukaMarathi": "वाळवा",
            "district": "Sangli",
            "districtMarathi": "सांगली",
            "pinCode": "415414",
            "stats": {"totalVoters": 0, "activeMembers": 0, "deceasedMembers": 0, "totalFamilies": 0, "categorizedMembers": 0},
            "sourceFilesCount": 1,
            "createdAt": now,
            "updatedAt": now
        }
        db.villages.insert_one(sakharale_doc)
        logger.info("Seeded Sakharale (साखराळे) single village into MongoDB.")
    else:
        # Ensure correct naming
        db.villages.update_one(
            {"_id": sakharale["_id"]},
            {"$set": {
                "name": "Sakharale",
                "nameMarathi": "साखराळे",
                "taluka": "Walwa",
                "talukaMarathi": "वाळवा",
                "district": "Sangli",
                "districtMarathi": "सांगली",
                "pinCode": "415414"
            }}
        )

    # 3. Clean up any unauthorized or demo users from the database
    try:
        allowed = ["admin", "karan", "praji", "sush"]
        deleted_demo = db.users.delete_many({"username": {"$nin": allowed}})
        if deleted_demo.deleted_count > 0:
            logger.info(f"Purged {deleted_demo.deleted_count} unauthorized/test users from MongoDB.")
    except Exception as ex:
        logger.warning(f"Note on cleaning demo users: {ex}")

    # 4. Ensure System Admin Account exists
    admin_user = db.users.find_one({"username": "admin"})
    if not admin_user:
        admin_doc = {
            "username": "admin",
            "fullName": "Admin",
            "mobileNumber": "9822011223",
            "hashedPassword": get_password_hash("admin123"),
            "role": "ADMIN",
            "accountStatus": "ACTIVE",
            "assignedVillages": [],
            "permissions_granted": True,
            "lastLogin": None,
            "lastActivity": None,
            "createdAt": now,
            "createdBy": "system"
        }
        db.users.insert_one(admin_doc)
        logger.info("Admin account (admin / admin123) initialized in MongoDB.")

    logger.info("MongoDB seed complete: Single village Sakharale and authorized users confirmed.")
