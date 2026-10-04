import logging
from datetime import datetime
from pymongo import MongoClient
from app.config.config import settings
from app.auth.security import get_password_hash

logger = logging.getLogger("election_app.seed_mongo")

def seed_mongo_initial_data():
    """Seeds initial collections: categories, base villages, and ONLY the Admin user into MongoDB.
    No dummy users or dummy voter records are created.
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

    # 2. Base Villages (clean, 0 stats)
    if db.villages.count_documents({}) == 0:
        villages = [
            {
                "name": "Sakharele",
                "nameMarathi": "साखराळे",
                "taluka": "Walwa",
                "talukaMarathi": "वाळवा",
                "district": "Sangli",
                "districtMarathi": "सांगली",
                "pinCode": "415414",
                "stats": {"totalVoters": 0, "activeMembers": 0, "deceasedMembers": 0, "totalFamilies": 0, "categorizedMembers": 0},
                "sourceFilesCount": 0,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "name": "Kavthe Mahankal",
                "nameMarathi": "कवठेमहांकाळ",
                "taluka": "Kavthe Mahankal",
                "talukaMarathi": "कवठे महांकाळ",
                "district": "Sangli",
                "districtMarathi": "सांगली",
                "pinCode": "416405",
                "stats": {"totalVoters": 0, "activeMembers": 0, "deceasedMembers": 0, "totalFamilies": 0, "categorizedMembers": 0},
                "sourceFilesCount": 0,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "name": "Agran Dhulgaon",
                "nameMarathi": "अग्रण धुळगांव",
                "taluka": "Kavthe Mahankal",
                "talukaMarathi": "कवठे महांकाळ",
                "district": "Sangli",
                "districtMarathi": "सांगली",
                "pinCode": "416405",
                "stats": {"totalVoters": 0, "activeMembers": 0, "deceasedMembers": 0, "totalFamilies": 0, "categorizedMembers": 0},
                "sourceFilesCount": 0,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }
        ]
        res = db.villages.insert_many(villages)
        logger.info(f"Seeded {len(res.inserted_ids)} base villages into MongoDB.")

    # 3. Admin & User Accounts
    admin_user = db.users.find_one({"username": "admin"})
    if not admin_user:
        admin_doc = {
            "username": "admin",
            "fullName": "System Administrator",
            "mobileNumber": "9822011223",
            "hashedPassword": get_password_hash("admin123"),
            "role": "ADMIN",
            "accountStatus": "ACTIVE",
            "assignedVillages": [],
            "permissions_granted": True,
            "lastLogin": None,
            "lastActivity": None,
            "createdAt": datetime.utcnow(),
            "createdBy": "system"
        }
        db.users.insert_one(admin_doc)
        logger.info("Admin account (admin / admin123) verified in MongoDB.")
    else:
        db.users.update_one(
            {"username": "admin"},
            {"$set": {
                "accountStatus": "ACTIVE",
                "role": "ADMIN",
                "permissions_granted": True,
                "hashedPassword": get_password_hash("admin123")
            }}
        )

    # 4. Standard Field Worker / User Accounts
    # User 'pratiksha'
    pratiksha_user = db.users.find_one({"username": "pratiksha"})
    if not pratiksha_user:
        pratiksha_doc = {
            "username": "pratiksha",
            "fullName": "Pratiksha",
            "mobileNumber": "9172474077",
            "hashedPassword": get_password_hash("user123"),
            "role": "USER",
            "accountStatus": "ACTIVE",
            "assignedVillages": [],
            "permissions_granted": False,
            "lastLogin": None,
            "lastActivity": None,
            "createdAt": datetime.utcnow(),
            "createdBy": "system"
        }
        db.users.insert_one(pratiksha_doc)
    else:
        db.users.update_one(
            {"username": "pratiksha"},
            {"$set": {
                "accountStatus": "ACTIVE",
                "role": "USER",
                "hashedPassword": get_password_hash("user123")
            }}
        )

    # User 'user' (Generic field worker)
    generic_user = db.users.find_one({"username": "user"})
    if not generic_user:
        user_doc = {
            "username": "user",
            "fullName": "Field Worker",
            "mobileNumber": "9822000000",
            "hashedPassword": get_password_hash("user123"),
            "role": "USER",
            "accountStatus": "ACTIVE",
            "assignedVillages": [],
            "permissions_granted": False,
            "lastLogin": None,
            "lastActivity": None,
            "createdAt": datetime.utcnow(),
            "createdBy": "system"
        }
        db.users.insert_one(user_doc)
    else:
        db.users.update_one(
            {"username": "user"},
            {"$set": {
                "accountStatus": "ACTIVE",
                "role": "USER",
                "hashedPassword": get_password_hash("user123")
            }}
        )

    logger.info("MongoDB initial setup complete: Admin and User accounts ready.")
