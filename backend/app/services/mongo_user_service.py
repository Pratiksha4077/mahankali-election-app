import math
import re
from datetime import datetime
from typing import Optional, Dict, Any, List
from bson import ObjectId

from app.database.mongodb import get_mongo_db
from app.auth.security import get_password_hash

def format_user_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return None
    d = dict(doc)
    d["id"] = str(d.get("_id", ""))
    if "_id" in d:
        del d["_id"]
    if "hashedPassword" in d:
        del d["hashedPassword"]
    return d

class MongoUserService:
    @staticmethod
    async def get_users(
        status: Optional[str] = None,
        search_query: Optional[str] = None,
        page: int = 1,
        limit: int = 50
    ) -> Dict[str, Any]:
        db = get_mongo_db()
        filter_q: Dict[str, Any] = {}

        if status and status != "ALL":
            filter_q["accountStatus"] = status

        if search_query and search_query.strip():
            sq = search_query.strip()
            regex = re.compile(re.escape(sq), re.IGNORECASE)
            filter_q["$or"] = [
                {"username": {"$regex": regex}},
                {"fullName": {"$regex": regex}},
                {"mobileNumber": {"$regex": regex}}
            ]

        skip = max(0, (page - 1) * limit)
        total = await db.users.count_documents(filter_q)
        cursor = db.users.find(filter_q).sort("createdAt", -1).skip(skip).limit(limit)
        items = [format_user_doc(doc) async for doc in cursor]

        return {
            "items": items,
            "total": total,
            "page": page,
            "pages": math.ceil(total / limit) if limit > 0 else 1
        }

    @staticmethod
    async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
        db = get_mongo_db()
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}
        doc = await db.users.find_one(query)
        return format_user_doc(doc) if doc else None

    @staticmethod
    async def create_user(
        full_name: str,
        username: str,
        mobile_number: str,
        password: str,
        role: str = "USER",
        account_status: str = "ACTIVE",
        assigned_villages: List[str] = None,
        created_by: str = "admin"
    ) -> Dict[str, Any]:
        db = get_mongo_db()

        # Check existing username
        existing = await db.users.find_one({"username": username})
        if existing:
            raise ValueError(f"Username '{username}' already exists")

        new_user = {
            "username": username.strip(),
            "fullName": full_name.strip(),
            "mobileNumber": mobile_number.strip(),
            "hashedPassword": get_password_hash(password),
            "role": role.upper(),
            "accountStatus": account_status.upper(),
            "assignedVillages": assigned_villages or [],
            "createdAt": datetime.utcnow(),
            "lastLogin": None,
            "lastActivity": None,
            "createdBy": created_by
        }

        res = await db.users.insert_one(new_user)
        new_user["_id"] = res.inserted_id
        return format_user_doc(new_user)

    @staticmethod
    async def update_user(
        user_id: str,
        full_name: Optional[str] = None,
        mobile_number: Optional[str] = None,
        role: Optional[str] = None,
        assigned_villages: Optional[List[str]] = None,
        password: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        db = get_mongo_db()
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}

        set_fields: Dict[str, Any] = {"updatedAt": datetime.utcnow()}
        if full_name:
            set_fields["fullName"] = full_name.strip()
        if mobile_number:
            set_fields["mobileNumber"] = mobile_number.strip()
        if role:
            set_fields["role"] = role.upper()
        if assigned_villages is not None:
            set_fields["assignedVillages"] = assigned_villages
        if password and password.strip():
            set_fields["hashedPassword"] = get_password_hash(password.strip())

        res = await db.users.find_one_and_update(query, {"$set": set_fields}, return_document=True)
        return format_user_doc(res) if res else None

    @staticmethod
    async def set_user_status(user_id: str, status: str) -> Optional[Dict[str, Any]]:
        db = get_mongo_db()
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}
        res = await db.users.find_one_and_update(
            query,
            {"$set": {"accountStatus": status.upper(), "updatedAt": datetime.utcnow()}},
            return_document=True
        )
        return format_user_doc(res) if res else None

    @staticmethod
    async def set_user_permissions(user_id: str, permissions_granted: bool) -> Optional[Dict[str, Any]]:
        db = get_mongo_db()
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}
        res = await db.users.find_one_and_update(
            query,
            {"$set": {
                "permissions_granted": permissions_granted,
                "permissionsUpdatedAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }},
            return_document=True
        )
        return format_user_doc(res) if res else None

    @staticmethod
    async def delete_user(user_id: str) -> bool:
        db = get_mongo_db()
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}
        res = await db.users.delete_one(query)
        return res.deleted_count > 0

    @staticmethod
    async def log_activity(
        user_id: str,
        username: str,
        action: str,
        details: str = "",
        target_member_id: Optional[str] = None,
        target_member_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Logs deliberate in-app user interactions (CALL_INITIATED, SMS_INITIATED, LOCATION_CHECKIN, etc.)
        strictly without covert device monitoring.
        """
        db = get_mongo_db()
        activity = {
            "userId": user_id,
            "username": username,
            "action": action,
            "targetMemberId": target_member_id,
            "targetMemberName": target_member_name,
            "details": details,
            "metadata": metadata or {},
            "timestamp": datetime.utcnow()
        }
        res = await db.app_activities.insert_one(activity)
        activity["id"] = str(res.inserted_id)
        if "_id" in activity:
            del activity["_id"]
        return activity

    @staticmethod
    async def get_user_activity(user_id: str, limit: int = 200) -> Dict[str, Any]:
        """
        Retrieves in-app user activity timeline, categorized into Call History, SMS History,
        Location History, and general application activity.
        """
        db = get_mongo_db()
        user_doc = None
        if ObjectId.is_valid(user_id):
            user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            user_doc = await db.users.find_one({"$or": [{"_id": user_id}, {"username": user_id}]})

        possible_ids = [str(user_id)]
        possible_usernames = [str(user_id)]
        if user_doc:
            possible_ids.append(str(user_doc.get("_id", "")))
            if "username" in user_doc:
                possible_usernames.append(str(user_doc["username"]))

        match_q = {
            "$or": [
                {"userId": {"$in": possible_ids}},
                {"username": {"$in": possible_usernames}},
                {"metadata.user_id": {"$in": possible_ids}},
                {"metadata.username": {"$in": possible_usernames}}
            ]
        }
        cursor = db.app_activities.find(match_q).sort("timestamp", -1).limit(limit)

        timeline = []
        calls = []
        sms = []
        locations = []

        async for doc in cursor:
            doc["id"] = str(doc.get("_id", ""))
            if "_id" in doc:
                del doc["_id"]
            timeline.append(doc)

            act = doc.get("action", "").upper()
            if "CALL" in act:
                calls.append(doc)
            elif "SMS" in act or "WHATSAPP" in act:
                sms.append(doc)
            elif "LOCATION" in act or "VILLAGE" in act or "CHECKIN" in act or "BOOTH" in act:
                locations.append(doc)

        return {
            "timeline": timeline,
            "calls": calls,
            "sms": sms,
            "locations": locations,
            "call_count": len(calls),
            "sms_count": len(sms),
            "location_count": len(locations)
        }
