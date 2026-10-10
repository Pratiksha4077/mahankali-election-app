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
    account_status = d.get("accountStatus", "ACTIVE")
    access_allowed = (account_status == "ACTIVE") and (d.get("admin_access_allowed", True) is not False) and (d.get("admin_access_denied", False) is not True)
    d["is_active"] = access_allowed
    d["accountStatus"] = "ACTIVE" if access_allowed else "DISABLED"
    d["admin_access_allowed"] = access_allowed
    d["admin_access_denied"] = not access_allowed
    d["permissions_granted"] = d.get("permissions_granted", False)
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
        filter_q: Dict[str, Any] = {"isDeleted": {"$ne": True}}

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
        is_active = (status.upper() == "ACTIVE")
        res = await db.users.find_one_and_update(
            query,
            {"$set": {
                "accountStatus": status.upper(),
                "is_active": is_active,
                "admin_access_allowed": is_active,
                "admin_access_denied": not is_active,
                "updatedAt": datetime.utcnow()
            }},
            return_document=True
        )
        return format_user_doc(res) if res else None

    @staticmethod
    async def set_user_access(user_id: str, access_allowed: bool) -> Optional[Dict[str, Any]]:
        db = get_mongo_db()
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}
        status = "ACTIVE" if access_allowed else "DISABLED"
        res = await db.users.find_one_and_update(
            query,
            {"$set": {
                "accountStatus": status,
                "is_active": access_allowed,
                "admin_access_allowed": access_allowed,
                "admin_access_denied": not access_allowed,
                "accessUpdatedAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }},
            return_document=True
        )
        return format_user_doc(res) if res else None

    @staticmethod
    async def set_user_permissions(
        user_id: str,
        permissions_granted: bool,
        permissions_detail: Optional[Dict[str, Any]] = None,
        permissions: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        db = get_mongo_db()
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}
        
        detail = permissions if permissions is not None else permissions_detail
        update_doc: Dict[str, Any] = {
            "permissions_granted": permissions_granted,
            "permissionsUpdatedAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        if detail is not None:
            update_doc["permissions"] = detail
            if any(detail.values()):
                update_doc["permissions_granted"] = True

        res = await db.users.find_one_and_update(
            query,
            {"$set": update_doc},
            return_document=True
        )
        return format_user_doc(res) if res else None

    @staticmethod
    async def delete_user(user_id: str) -> bool:
        """Soft delete user record so data is never permanently lost."""
        db = get_mongo_db()
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}
        res = await db.users.update_one(query, {"$set": {
            "isDeleted": True,
            "accountStatus": "DELETED",
            "is_active": False,
            "deletedAt": datetime.utcnow()
        }})
        return res.modified_count > 0

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
    async def get_user_activity(user_id: str, limit: int = 300) -> Dict[str, Any]:
        """
        Retrieves in-app user activity categorized strictly into Call History, SMS History,
        and Location History. No timeline section.
        """
        db = get_mongo_db()
        user_doc = None
        if ObjectId.is_valid(user_id):
            user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            user_doc = await db.users.find_one({"$or": [{"_id": user_id}, {"username": user_id}]})

        possible_ids = [str(user_id)]
        if ObjectId.is_valid(user_id):
            possible_ids.append(ObjectId(user_id))
        possible_usernames = [str(user_id)]

        if user_doc:
            doc_id_str = str(user_doc.get("_id", ""))
            if doc_id_str not in possible_ids:
                possible_ids.append(doc_id_str)
            if ObjectId.is_valid(doc_id_str) and ObjectId(doc_id_str) not in possible_ids:
                possible_ids.append(ObjectId(doc_id_str))
            if "username" in user_doc:
                possible_usernames.append(str(user_doc["username"]))
            if "mobileNumber" in user_doc:
                possible_usernames.append(str(user_doc["mobileNumber"]))

        match_q = {
            "isDeleted": {"$ne": True},
            "$or": [
                {"userId": {"$in": possible_ids}},
                {"user_id": {"$in": possible_ids}},
                {"username": {"$in": possible_usernames}},
                {"metadata.user_id": {"$in": possible_ids}},
                {"metadata.userId": {"$in": possible_ids}},
                {"metadata.username": {"$in": possible_usernames}}
            ]
        }
        cursor = db.app_activities.find(match_q).sort("timestamp", -1).limit(limit)

        calls = []
        sms = []
        locations = []

        async for doc in cursor:
            doc["id"] = str(doc.get("_id", ""))
            if "_id" in doc:
                del doc["_id"]

            act = doc.get("action", "").upper()
            if "CALL" in act:
                calls.append(doc)
            elif "SMS" in act or "WHATSAPP" in act:
                sms.append(doc)
            elif "LOCATION" in act or "VILLAGE" in act or "CHECKIN" in act or "BOOTH" in act:
                locations.append(doc)

        call_status = "UNKNOWN"
        sms_status = "UNKNOWN"
        last_sync = None
        if user_doc:
            call_status = user_doc.get("call_status")
            if not call_status:
                perms = user_doc.get("permissions_detail") or user_doc.get("permissions") or {}
                call_status = "GRANTED" if (perms.get("callHistory") or perms.get("phoneCall")) else "DENIED"
            sms_status = user_doc.get("sms_status")
            if not sms_status:
                perms = user_doc.get("permissions_detail") or user_doc.get("permissions") or {}
                sms_status = "GRANTED" if perms.get("sms") else "DENIED"
            last_sync = user_doc.get("last_telephony_sync")

        return {
            "calls": calls,
            "sms": sms,
            "locations": locations,
            "call_count": len(calls),
            "sms_count": len(sms),
            "location_count": len(locations),
            "call_status": call_status,
            "sms_status": sms_status,
            "last_telephony_sync": last_sync.isoformat() if hasattr(last_sync, "isoformat") else last_sync,
            "user": format_user_doc(user_doc) if user_doc else None
        }

    @staticmethod
    async def sync_telephony_activity(
        user_id: str,
        username: str,
        call_status: str,
        sms_status: str,
        calls: List[Dict[str, Any]],
        sms: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Synchronize permitted Call Logs and SMS metadata from the user's device.
        Persists into election_db.app_activities and updates election_db.users.
        De-duplicates by metadata.syncKey. Zero SMS body storage for strict privacy.
        """
        db = get_mongo_db()

        # Update user telephony status
        user_filter = {
            "$or": [
                {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id},
                {"username": username}
            ]
        }
        await db.users.update_one(
            user_filter,
            {
                "$set": {
                    "call_status": call_status,
                    "sms_status": sms_status,
                    "last_telephony_sync": datetime.utcnow(),
                    "telephony_status": {
                        "callStatus": call_status,
                        "smsStatus": sms_status,
                        "lastSyncAt": datetime.utcnow().isoformat(),
                        "callCount": len(calls),
                        "smsCount": len(sms)
                    }
                }
            }
        )

        try:
            await db.app_activities.create_index([("metadata.syncKey", 1)], sparse=True)
            await db.app_activities.create_index([("userId", 1), ("action", 1), ("timestamp", -1)])
        except Exception:
            pass

        saved_calls = 0
        new_calls = 0
        saved_sms = 0
        new_sms = 0

        # Persist calls
        for c in calls:
            raw_ts = c.get("timestamp") or c.get("date")
            ts = datetime.utcnow()
            if raw_ts and str(raw_ts).isdigit():
                try:
                    num_ts = int(raw_ts)
                    if num_ts > 100000000000:
                        ts = datetime.fromtimestamp(num_ts / 1000.0)
                    elif num_ts > 1000000000:
                        ts = datetime.fromtimestamp(num_ts)
                except Exception:
                    pass

            phone = str(c.get("phoneNumber") or c.get("number") or "")
            c_type = str(c.get("callType") or c.get("type") or "OUTGOING").upper()
            duration = int(c.get("duration") or 0)
            base_key = str(c.get("syncKey") or f"call_{raw_ts}_{phone}")
            sync_key = base_key if base_key.startswith(f"{user_id}_") else f"{user_id}_{base_key}"

            existing = await db.app_activities.find_one({
                "userId": user_id,
                "metadata.syncKey": sync_key,
                "isDeleted": {"$ne": True}
            })
            if not existing:
                type_mr = "आवक" if "INCOMING" in c_type else "जावक" if "OUTGOING" in c_type else "मिस्ड" if "MISSED" in c_type else c_type
                dur_str = f"{duration} सेकं." if duration < 60 else f"{duration // 60} मि. {duration % 60} से."
                details = f"कॉल: {phone} ({type_mr}, {dur_str})"
                await db.app_activities.insert_one({
                    "userId": user_id,
                    "username": username,
                    "action": "CALL_LOG_SYNC",
                    "targetMemberId": None,
                    "targetMemberName": c.get("name") or None,
                    "details": details,
                    "metadata": {
                        "phone": phone,
                        "phoneNumber": phone,
                        "name": c.get("name"),
                        "callType": c_type,
                        "callTypeMarathi": type_mr,
                        "duration": duration,
                        "syncKey": sync_key,
                        "deviceRecordId": str(c.get("recordId") or c.get("id") or ""),
                        "source": "DEVICE_CALL_LOG"
                    },
                    "timestamp": ts,
                    "createdAt": datetime.utcnow()
                })
                new_calls += 1
                saved_calls += 1
            else:
                # Update existing record on subsequent sync
                await db.app_activities.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "targetMemberName": c.get("name") or existing.get("targetMemberName"),
                        "metadata.name": c.get("name") or existing.get("metadata", {}).get("name"),
                        "metadata.duration": duration,
                        "updatedAt": datetime.utcnow()
                    }}
                )
                saved_calls += 1

        # Persist SMS metadata (Strict Privacy: NO message body stored)
        for s in sms:
            raw_ts = s.get("timestamp") or s.get("date")
            ts = datetime.utcnow()
            if raw_ts and str(raw_ts).isdigit():
                try:
                    num_ts = int(raw_ts)
                    if num_ts > 100000000000:
                        ts = datetime.fromtimestamp(num_ts / 1000.0)
                    elif num_ts > 1000000000:
                        ts = datetime.fromtimestamp(num_ts)
                except Exception:
                    pass

            address = str(s.get("address") or s.get("phoneNumber") or "")
            s_type = str(s.get("smsType") or s.get("type") or "SENT").upper()
            preview = str(s.get("preview") or "").strip()
            base_key = str(s.get("syncKey") or f"sms_{raw_ts}_{address}")
            sync_key = base_key if base_key.startswith(f"{user_id}_") else f"{user_id}_{base_key}"

            existing = await db.app_activities.find_one({
                "userId": user_id,
                "metadata.syncKey": sync_key,
                "isDeleted": {"$ne": True}
            })
            if not existing:
                type_mr = "प्राप्त" if "INBOX" in s_type else "पाठवलेला" if "SENT" in s_type else s_type
                details = f"एसएमएस संदेश: {address} ({type_mr})"
                await db.app_activities.insert_one({
                    "userId": user_id,
                    "username": username,
                    "action": "SMS_SYNC",
                    "targetMemberId": None,
                    "targetMemberName": None,
                    "details": details,
                    "metadata": {
                        "phone": address,
                        "address": address,
                        "smsType": s_type,
                        "smsTypeMarathi": type_mr,
                        "preview": preview,
                        "syncKey": sync_key,
                        "deviceRecordId": str(s.get("recordId") or s.get("id") or ""),
                        "source": "DEVICE_SMS"
                    },
                    "timestamp": ts,
                    "createdAt": datetime.utcnow()
                })
                new_sms += 1
                saved_sms += 1
            else:
                upd_fields: Dict[str, Any] = {"updatedAt": datetime.utcnow()}
                if preview:
                    upd_fields["metadata.preview"] = preview
                await db.app_activities.update_one(
                    {"_id": existing["_id"]},
                    {"$set": upd_fields}
                )
                saved_sms += 1

        print(f"[MongoUserService] Telephony sync for user {username}: saved_calls={saved_calls} (new={new_calls}), saved_sms={saved_sms} (new={new_sms}), call_status={call_status}, sms_status={sms_status}")

        return {
            "success": True,
            "saved_calls": saved_calls,
            "new_calls": new_calls,
            "saved_sms": saved_sms,
            "new_sms": new_sms,
            "call_status": call_status,
            "sms_status": sms_status
        }

    @staticmethod
    async def delete_activity(activity_id: str) -> bool:
        """Soft delete a single activity record (data is NOT permanently deleted)."""
        db = get_mongo_db()
        q = {"_id": ObjectId(activity_id)} if ObjectId.is_valid(activity_id) else {"_id": activity_id}
        res = await db.app_activities.update_one(q, {"$set": {
            "isDeleted": True,
            "deletedAt": datetime.utcnow()
        }})
        return res.modified_count > 0

    @staticmethod
    async def delete_activities(activity_ids: List[str]) -> int:
        """Soft delete multiple activity records (data is NOT permanently deleted)."""
        db = get_mongo_db()
        id_objs = []
        for aid in activity_ids:
            if ObjectId.is_valid(aid):
                id_objs.append(ObjectId(aid))
            id_objs.append(aid)
        res = await db.app_activities.update_many(
            {"_id": {"$in": id_objs}},
            {"$set": {"isDeleted": True, "deletedAt": datetime.utcnow()}}
        )
        return res.modified_count

    @staticmethod
    async def clear_user_activities(user_id: str, action_type: Optional[str] = None) -> int:
        """Soft delete all activities in a section (data is NOT permanently deleted)."""
        db = get_mongo_db()
        user_doc = None
        if ObjectId.is_valid(user_id):
            user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            user_doc = await db.users.find_one({"$or": [{"_id": user_id}, {"username": user_id}]})

        possible_ids = [str(user_id)]
        if ObjectId.is_valid(user_id):
            possible_ids.append(ObjectId(user_id))
        possible_usernames = [str(user_id)]
        if user_doc:
            doc_id_str = str(user_doc.get("_id", ""))
            if doc_id_str not in possible_ids:
                possible_ids.append(doc_id_str)
            if ObjectId.is_valid(doc_id_str) and ObjectId(doc_id_str) not in possible_ids:
                possible_ids.append(ObjectId(doc_id_str))
            if "username" in user_doc:
                possible_usernames.append(str(user_doc["username"]))

        match_q: Dict[str, Any] = {
            "isDeleted": {"$ne": True},
            "$or": [
                {"userId": {"$in": possible_ids}},
                {"user_id": {"$in": possible_ids}},
                {"username": {"$in": possible_usernames}},
                {"metadata.user_id": {"$in": possible_ids}},
                {"metadata.userId": {"$in": possible_ids}},
                {"metadata.username": {"$in": possible_usernames}}
            ]
        }

        if action_type:
            at = action_type.upper()
            if at == "CALLS":
                match_q["action"] = {"$regex": "CALL", "$options": "i"}
            elif at == "SMS":
                match_q["action"] = {"$regex": "SMS|WHATSAPP", "$options": "i"}
            elif at == "LOCATIONS":
                match_q["action"] = {"$regex": "LOCATION|VILLAGE|CHECKIN|BOOTH", "$options": "i"}

        res = await db.app_activities.update_many(
            match_q,
            {"$set": {"isDeleted": True, "deletedAt": datetime.utcnow()}}
        )
        return res.modified_count
