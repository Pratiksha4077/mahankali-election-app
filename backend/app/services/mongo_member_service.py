import re
import math
from datetime import datetime
from typing import Optional, Dict, Any, List
from bson import ObjectId
from app.database.mongodb import get_mongo_db

def to_object_id_query(id_str: str):
    try:
        return {"$in": [id_str, ObjectId(id_str)]}
    except Exception:
        return id_str

def format_member_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return None
    doc = dict(doc)
    doc["id"] = str(doc.get("_id", ""))
    if "_id" in doc:
        del doc["_id"]
    return doc

class MongoMemberService:
    @staticmethod
    async def get_members(
        village_id: Optional[str] = None,
        search_query: Optional[str] = None,
        category_id: Optional[str] = None,
        status: Optional[str] = "ACTIVE",
        assigned_user_id: Optional[str] = None,
        my_assigned_only: bool = False,
        page: int = 1,
        limit: int = 50
    ) -> Dict[str, Any]:
        db = get_mongo_db()
        and_conditions = []
        if village_id:
            vid_variants = [str(village_id)]
            if ObjectId.is_valid(str(village_id)):
                vid_variants.append(ObjectId(str(village_id)))
            and_conditions.append({"village.id": {"$in": vid_variants}})

        if status and status != "ALL":
            and_conditions.append({"status": status})

        if category_id:
            cid_variants = [str(category_id)]
            if ObjectId.is_valid(str(category_id)):
                cid_variants.append(ObjectId(str(category_id)))
            and_conditions.append({"category.id": {"$in": cid_variants}})

        if my_assigned_only and assigned_user_id:
            and_conditions.append({"assignedUserId": str(assigned_user_id)})

        # Text / Regex Search (Marathi & English)
        if search_query and search_query.strip():
            sq = search_query.strip()
            regex = re.compile(re.escape(sq), re.IGNORECASE)
            search_fields = [
                {"nameMarathi.full": {"$regex": regex}},
                {"name.full": {"$regex": regex}},
                {"nameMarathi.surname": {"$regex": regex}},
                {"nameMarathi.first": {"$regex": regex}},
                {"membershipNumber": {"$regex": regex}},
                {"epicNumber": {"$regex": regex}},
                {"mobileNumber": {"$regex": regex}},
                {"houseNumber": {"$regex": regex}},
                {"boothPartNumber": {"$regex": regex}}
            ]
            if sq.isdigit():
                search_fields.append({"serialNumber": int(sq)})
            and_conditions.append({"$or": search_fields})

        filter_q: Dict[str, Any] = {"$and": and_conditions} if and_conditions else {}

        skip = max(0, (page - 1) * limit)
        total = await db.members.count_documents(filter_q)
        
        cursor = db.members.find(filter_q).sort([("serialNumber", 1), ("membershipNumber", 1)]).skip(skip).limit(limit)
        items = [format_member_doc(doc) async for doc in cursor]

        pages = math.ceil(total / limit) if limit > 0 else 1

        return {
            "items": items,
            "total": total,
            "page": page,
            "pages": pages,
            "limit": limit
        }

    @staticmethod
    async def get_member_by_id(member_id: str) -> Optional[Dict[str, Any]]:
        db = get_mongo_db()
        doc = None
        try:
            doc = await db.members.find_one({"_id": ObjectId(member_id)})
        except Exception:
            pass
        if not doc:
            doc = await db.members.find_one({"_id": member_id})
        return format_member_doc(doc) if doc else None

    @staticmethod
    async def update_member(member_id: str, update_fields: Dict[str, Any], updated_by: str = "system") -> Optional[Dict[str, Any]]:
        db = get_mongo_db()
        set_data: Dict[str, Any] = {}

        # 1. Contact & Address
        mob = update_fields.get("mobileNumber") or update_fields.get("mobile_number")
        if mob is not None:
            set_data["mobileNumber"] = str(mob).strip()

        addr = update_fields.get("address")
        if addr is not None:
            set_data["address"] = str(addr).strip()

        pin = update_fields.get("pinCode") or update_fields.get("pin_code")
        if pin is not None:
            set_data["pinCode"] = str(pin).strip()

        house = update_fields.get("houseNumber") or update_fields.get("house_number")
        if house is not None:
            set_data["houseNumber"] = str(house).strip()

        # 2. Demographics (Age, Gender)
        raw_age = update_fields.get("age")
        if raw_age is not None and str(raw_age).strip() != "":
            try:
                set_data["age"] = int(float(str(raw_age).strip()))
            except Exception:
                set_data["age"] = str(raw_age).strip()

        raw_gender = update_fields.get("gender")
        if raw_gender is not None:
            g_str = str(raw_gender).strip()
            if g_str in ("पुरुष", "पु", "M", "m", "Male"):
                set_data["gender"] = "Male"
            elif g_str in ("महिला", "स्त्री", "F", "f", "Female"):
                set_data["gender"] = "Female"
            else:
                set_data["gender"] = g_str

        # 3. Voter Identifiers (Serial, EPIC, Booth)
        raw_serial = (
            update_fields.get("serialNumber") or 
            update_fields.get("serial_number") or 
            update_fields.get("voter_number")
        )
        if raw_serial is not None and str(raw_serial).strip() != "":
            try:
                set_data["serialNumber"] = int(str(raw_serial).strip())
            except Exception:
                set_data["serialNumber"] = str(raw_serial).strip()

        epic = update_fields.get("epicNumber") or update_fields.get("epic_number")
        if epic is not None:
            set_data["epicNumber"] = str(epic).strip()

        booth = update_fields.get("boothPartNumber") or update_fields.get("booth_part_number")
        if booth is not None:
            set_data["boothPartNumber"] = str(booth).strip()

        # 4. Marathi & English Names
        name_mr = update_fields.get("full_name_mr") or update_fields.get("nameMarathi")
        if isinstance(name_mr, dict):
            for sub_k, sub_v in name_mr.items():
                set_data[f"nameMarathi.{sub_k}"] = sub_v
        elif isinstance(name_mr, str) and name_mr.strip():
            nm_clean = name_mr.strip()
            set_data["nameMarathi.full"] = nm_clean
            tokens = nm_clean.split()
            if len(tokens) >= 3:
                set_data["nameMarathi.surname"] = tokens[0]
                set_data["nameMarathi.first"] = tokens[1]
                set_data["nameMarathi.fatherName"] = " ".join(tokens[2:])
            elif len(tokens) == 2:
                set_data["nameMarathi.surname"] = tokens[0]
                set_data["nameMarathi.first"] = tokens[1]
            elif len(tokens) == 1:
                set_data["nameMarathi.first"] = tokens[0]

            if not update_fields.get("full_name_en") and not update_fields.get("name"):
                set_data["name.full"] = nm_clean

        name_en = update_fields.get("full_name_en") or update_fields.get("name")
        if isinstance(name_en, dict):
            for sub_k, sub_v in name_en.items():
                set_data[f"name.{sub_k}"] = sub_v
        elif isinstance(name_en, str) and name_en.strip():
            set_data["name.full"] = name_en.strip()

        # 5. Status & Deceased
        if update_fields.get("is_deceased") is True or update_fields.get("status") == "DECEASED":
            set_data["status"] = "DECEASED"
            set_data["deceasedDate"] = datetime.utcnow()
            set_data["deceasedRecordedBy"] = updated_by
        elif update_fields.get("is_deceased") is False or update_fields.get("status") == "ACTIVE":
            set_data["status"] = "ACTIVE"

        # 6. Miscellaneous Info
        for extra in ["religion", "caste", "designation", "profession"]:
            if extra in update_fields and update_fields[extra] is not None:
                set_data[extra] = str(update_fields[extra]).strip()

        # 7. Category update if requested
        cat_id = update_fields.get("category_id") or update_fields.get("categoryId")
        if cat_id:
            cat_query = {"_id": ObjectId(cat_id)} if ObjectId.is_valid(cat_id) else {"_id": cat_id}
            cat_doc = await db.categories.find_one(cat_query)
            if cat_doc:
                set_data["category"] = {
                    "id": str(cat_doc["_id"]),
                    "name": cat_doc["name"],
                    "nameMarathi": cat_doc.get("nameMarathi", cat_doc["name"]),
                    "color": cat_doc["color"]
                }

        # 8. Village update if requested
        v_id = update_fields.get("village_id") or update_fields.get("villageId")
        if v_id:
            v_query = {"_id": ObjectId(v_id)} if ObjectId.is_valid(v_id) else {"_id": v_id}
            v_doc = await db.villages.find_one(v_query)
            if v_doc:
                set_data["village"] = {
                    "id": str(v_doc["_id"]),
                    "name": v_doc.get("name", ""),
                    "nameMarathi": v_doc.get("nameMarathi", "")
                }

        set_data["updatedAt"] = datetime.utcnow()
        set_data["updatedBy"] = updated_by

        query = {"_id": ObjectId(member_id)} if ObjectId.is_valid(member_id) else {"_id": member_id}
        result = await db.members.find_one_and_update(
            query,
            {"$set": set_data},
            return_document=True
        )

        # Update village active/deceased stats if status was touched
        if result and "status" in set_data and result.get("village", {}).get("id"):
            vid = result["village"]["id"]
            try:
                v_query = {"_id": ObjectId(vid)} if ObjectId.is_valid(vid) else {"_id": vid}
                total_active = await db.members.count_documents({"village.id": vid, "status": "ACTIVE"})
                total_dead = await db.members.count_documents({"village.id": vid, "status": "DECEASED"})
                await db.villages.update_one(v_query, {"$set": {
                    "stats.activeMembers": total_active,
                    "stats.deceasedMembers": total_dead
                }})
            except Exception:
                pass

        return format_member_doc(result) if result else None

    @staticmethod
    async def update_member_category(member_id: str, category_id: str, updated_by: str = "system") -> Optional[Dict[str, Any]]:
        db = get_mongo_db()
        cat_doc = None
        if ObjectId.is_valid(category_id):
            cat_doc = await db.categories.find_one({"_id": ObjectId(category_id)})
        if not cat_doc:
            cat_doc = await db.categories.find_one({"_id": category_id})
        if not cat_doc:
            cat_doc = await db.categories.find_one({"code": category_id.upper()})
        if not cat_doc:
            cat_doc = await db.categories.find_one({"color": category_id})
        if not cat_doc:
            # Fallback to first active category (GREEN)
            cat_doc = await db.categories.find_one({"isActive": {"$ne": False}})

        if not cat_doc:
            return None

        category_ref = {
            "id": str(cat_doc["_id"]),
            "name": cat_doc["name"],
            "nameMarathi": cat_doc.get("nameMarathi", cat_doc["name"]),
            "color": cat_doc["color"]
        }

        query = {"_id": ObjectId(member_id)} if ObjectId.is_valid(member_id) else {"_id": member_id}
        result = await db.members.find_one_and_update(
            query,
            {"$set": {
                "category": category_ref,
                "updatedAt": datetime.utcnow(),
                "updatedBy": updated_by
            }},
            return_document=True
        )
        return format_member_doc(result) if result else None

    @staticmethod
    async def mark_as_deceased(member_id: str, deceased_date: Optional[datetime], recorded_by: str = "system") -> Optional[Dict[str, Any]]:
        db = get_mongo_db()
        query = {"_id": ObjectId(member_id)} if ObjectId.is_valid(member_id) else {"_id": member_id}
        
        result = await db.members.find_one_and_update(
            query,
            {"$set": {
                "status": "DECEASED",
                "deceasedDate": deceased_date or datetime.utcnow(),
                "deceasedRecordedBy": recorded_by,
                "updatedAt": datetime.utcnow(),
                "updatedBy": recorded_by
            }},
            return_document=True
        )

        if result and result.get("village", {}).get("id"):
            vid = result["village"]["id"]
            # Update village stats in background
            v_query = {"_id": ObjectId(vid)} if ObjectId.is_valid(vid) else {"_id": vid}
            total_active = await db.members.count_documents({"village.id": vid, "status": "ACTIVE"})
            total_dead = await db.members.count_documents({"village.id": vid, "status": "DECEASED"})
            await db.villages.update_one(v_query, {"$set": {
                "stats.activeMembers": total_active,
                "stats.deceasedMembers": total_dead
            }})

        return format_member_doc(result) if result else None
