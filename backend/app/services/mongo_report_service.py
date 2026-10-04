from typing import Optional, Dict, Any, List
from app.database.mongodb import get_mongo_db

class MongoReportService:
    @staticmethod
    async def get_summary_report(village_id: Optional[str] = None) -> Dict[str, Any]:
        db = get_mongo_db()
        match_stage = {"village.id": village_id} if village_id else {}

        total = await db.members.count_documents(match_stage)
        match_active = dict(match_stage)
        match_active["status"] = "ACTIVE"
        active = await db.members.count_documents(match_active)

        match_dead = dict(match_stage)
        match_dead["status"] = "DECEASED"
        dead = await db.members.count_documents(match_dead)

        match_with_mobile = dict(match_stage)
        match_with_mobile["mobileNumber"] = {"$nin": ["", None]}
        with_mobile = await db.members.count_documents(match_with_mobile)

        return {
            "totalVoters": total,
            "activeMembers": active,
            "deceasedMembers": dead,
            "withMobile": with_mobile,
            "withoutMobile": total - with_mobile
        }

    @staticmethod
    async def get_alphabetical_report(village_id: Optional[str] = None, letter: Optional[str] = None) -> List[Dict[str, Any]]:
        db = get_mongo_db()
        filter_q: Dict[str, Any] = {"status": "ACTIVE"}
        if village_id:
            filter_q["village.id"] = village_id

        if letter:
            filter_q["nameMarathi.full"] = {"$regex": f"^{letter}"}
        else:
            filter_q["nameMarathi.full"] = {"$regex": "^[\u0900-\u097F]"}

        cursor = db.members.find(filter_q).sort("nameMarathi.full", 1).limit(2500)
        voters = []
        async for doc in cursor:
            voters.append({
                "id": str(doc.get("_id", "")),
                "full_name_mr": doc.get("nameMarathi", {}).get("full", "") or doc.get("fullName", ""),
                "full_name_en": doc.get("nameEnglish", {}).get("full", "") or doc.get("fullName", ""),
                "surname": doc.get("nameMarathi", {}).get("surname", "") or doc.get("surname", ""),
                "epic_number": doc.get("epicNumber", "") or f"voter_{doc.get('serialNumber', 0)}",
                "serial_number": doc.get("serialNumber", 0),
                "village_name_mr": doc.get("village", {}).get("nameMarathi", "साखराळे"),
                "mobile_number": doc.get("mobileNumber", ""),
                "status": doc.get("status", "ACTIVE")
            })
        return voters

    @staticmethod
    async def get_membership_report(village_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db = get_mongo_db()
        base_filter: Dict[str, Any] = {"status": "ACTIVE"}
        if village_id:
            base_filter["village.id"] = village_id

        ranges = [
            ("अ.क्र. 1 ते 250 (विभाग 1)", 1, 250),
            ("अ.क्र. 251 ते 500 (विभाग 2)", 251, 500),
            ("अ.क्र. 501 ते 750 (विभाग 3)", 501, 750),
            ("अ.क्र. 751 ते 1000 (विभाग 4)", 751, 1000),
            ("अ.क्र. 1001 ते 1250 (विभाग 5)", 1001, 1250),
            ("अ.क्र. 1251 ते 1500 (विभाग 6)", 1251, 1500),
            ("अ.क्र. 1501+ (इतर सभासद)", 1501, 999999),
        ]
        results = []
        for label, start, end in ranges:
            q = dict(base_filter)
            q["serialNumber"] = {"$gte": start, "$lte": end}
            cnt = await db.members.count_documents(q)
            if cnt > 0:
                results.append({"name": label, "count": cnt, "key": f"{start}-{end}"})
        return results

    @staticmethod
    async def get_surname_report(village_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db = get_mongo_db()
        match_stage = {"$match": {"village.id": village_id, "status": "ACTIVE", "nameMarathi.surname": {"$nin": ["", None, "-"]}}} if village_id else {"$match": {"status": "ACTIVE", "nameMarathi.surname": {"$nin": ["", None, "-"]}}}

        pipeline = [
            match_stage,
            {
                "$group": {
                    "_id": "$nameMarathi.surname",
                    "surname": {"$first": "$nameMarathi.surname"},
                    "name": {"$first": "$nameMarathi.surname"},
                    "key": {"$first": "$nameMarathi.surname"},
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"count": -1}},
            {"$limit": 100}
        ]

        cursor = db.members.aggregate(pipeline)
        return [doc async for doc in cursor]

    @staticmethod
    async def get_category_report(village_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db = get_mongo_db()
        match_stage = {"$match": {"village.id": village_id, "status": "ACTIVE"}} if village_id else {"$match": {"status": "ACTIVE"}}

        pipeline = [
            match_stage,
            {
                "$group": {
                    "_id": "$category.color",
                    "color": {"$first": "$category.color"},
                    "categoryName": {"$first": "$category.name"},
                    "nameMarathi": {"$first": "$category.nameMarathi"},
                    "name": {"$first": {"$ifNull": ["$category.nameMarathi", "$category.name"]}},
                    "key": {"$first": "$category.color"},
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"count": -1}}
        ]

        cursor = db.members.aggregate(pipeline)
        return [doc async for doc in cursor]

    @staticmethod
    async def get_village_report() -> List[Dict[str, Any]]:
        db = get_mongo_db()
        pipeline = [
            {
                "$group": {
                    "_id": "$village.id",
                    "villageName": {"$first": "$village.name"},
                    "villageMarathi": {"$first": "$village.nameMarathi"},
                    "name": {"$first": {"$ifNull": ["$village.nameMarathi", "$village.name"]}},
                    "key": {"$first": "$village.id"},
                    "totalVoters": {"$sum": 1},
                    "count": {"$sum": 1},
                    "activeCount": {
                        "$sum": {"$cond": [{"$eq": ["$status", "ACTIVE"]}, 1, 0]}
                    },
                    "deceasedCount": {
                        "$sum": {"$cond": [{"$eq": ["$status", "DECEASED"]}, 1, 0]}
                    }
                }
            },
            {"$sort": {"totalVoters": -1}}
        ]

        cursor = db.members.aggregate(pipeline)
        return [doc async for doc in cursor]

    @staticmethod
    async def get_religion_report(village_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db = get_mongo_db()
        match_stage = {"$match": {"status": "ACTIVE", "religion": {"$nin": ["", None, "Not Specified", "-"]}}}
        if village_id:
            match_stage["$match"]["village.id"] = village_id

        pipeline = [
            match_stage,
            {
                "$group": {
                    "_id": "$religion",
                    "religion": {"$first": "$religion"},
                    "name": {"$first": "$religion"},
                    "key": {"$first": "$religion"},
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"count": -1}}
        ]

        cursor = db.members.aggregate(pipeline)
        return [doc async for doc in cursor]

    @staticmethod
    async def get_caste_report(village_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db = get_mongo_db()
        match_stage = {"$match": {"status": "ACTIVE", "caste": {"$nin": ["", None, "Not Specified", "-"]}}}
        if village_id:
            match_stage["$match"]["village.id"] = village_id

        pipeline = [
            match_stage,
            {
                "$group": {
                    "_id": "$caste",
                    "caste": {"$first": "$caste"},
                    "name": {"$first": "$caste"},
                    "key": {"$first": "$caste"},
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"count": -1}}
        ]

        cursor = db.members.aggregate(pipeline)
        return [doc async for doc in cursor]

    @staticmethod
    async def get_family_report(village_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db = get_mongo_db()
        match_stage = {"$match": {"status": "ACTIVE", "nameMarathi.fatherName": {"$nin": ["", None, "-"]}}}
        if village_id:
            match_stage["$match"]["village.id"] = village_id

        # Aggregate real voter families by fatherName (household head / family name)
        pipeline = [
            match_stage,
            {
                "$group": {
                    "_id": "$nameMarathi.fatherName",
                    "count": {"$sum": 1},
                    "villageName": {"$first": "$village.nameMarathi"}
                }
            },
            {"$match": {"count": {"$gte": 2}}},
            {"$sort": {"count": -1}},
            {"$limit": 100}
        ]
        cursor = db.members.aggregate(pipeline)
        families = []
        async for doc in cursor:
            head = doc.get("_id", "").strip()
            families.append({
                "name": f"कुटुंब (प्रमुख: {head})",
                "count": doc.get("count", 0),
                "headName": head,
                "key": head
            })
        return families

    @staticmethod
    async def get_deceased_report(village_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db = get_mongo_db()
        filter_q = {"status": "DECEASED"}
        if village_id:
            filter_q["village.id"] = village_id

        cursor = db.members.find(filter_q).sort("deceasedDate", -1).limit(200)
        records = []
        async for doc in cursor:
            records.append({
                "id": str(doc.get("_id", "")),
                "full_name_mr": doc.get("nameMarathi", {}).get("full", "") or doc.get("fullName", ""),
                "full_name_en": doc.get("nameEnglish", {}).get("full", "") or doc.get("fullName", ""),
                "surname": doc.get("nameMarathi", {}).get("surname", "") or doc.get("surname", ""),
                "epic_number": doc.get("epicNumber", ""),
                "serial_number": doc.get("serialNumber", 0),
                "village_name_mr": doc.get("village", {}).get("nameMarathi", "साखराळे"),
                "mobile_number": doc.get("mobileNumber", ""),
                "status": "DECEASED"
            })
        return records

    @staticmethod
    async def get_profession_report(village_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db = get_mongo_db()
        match_stage = {"$match": {"status": "ACTIVE", "profession": {"$nin": ["", None, "Not Specified", "-"]}}}
        if village_id:
            match_stage["$match"]["village.id"] = village_id

        pipeline = [
            match_stage,
            {
                "$group": {
                    "_id": "$profession",
                    "profession": {"$first": "$profession"},
                    "name": {"$first": "$profession"},
                    "key": {"$first": "$profession"},
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"count": -1}}
        ]

        cursor = db.members.aggregate(pipeline)
        return [doc async for doc in cursor]

    @staticmethod
    async def get_designation_report(village_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db = get_mongo_db()
        match_stage = {"$match": {"status": "ACTIVE", "designation": {"$nin": ["", None, "General", "-"]}}}
        if village_id:
            match_stage["$match"]["village.id"] = village_id

        pipeline = [
            match_stage,
            {
                "$group": {
                    "_id": "$designation",
                    "designation": {"$first": "$designation"},
                    "name": {"$first": "$designation"},
                    "key": {"$first": "$designation"},
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"count": -1}}
        ]

        cursor = db.members.aggregate(pipeline)
        return [doc async for doc in cursor]

    @staticmethod
    async def get_mobile_status_report(village_id: Optional[str] = None) -> List[Dict[str, Any]]:
        summary = await MongoReportService.get_summary_report(village_id)
        return [
            {"name": "मोबाईल क्रमांक उपलब्ध (With Mobile)", "count": summary.get("withMobile", 0), "key": "with"},
            {"name": "मोबाईल क्रमांक उपलब्ध नाही (Without Mobile)", "count": summary.get("withoutMobile", 0), "key": "without"}
        ]

    @staticmethod
    async def get_drilldown_members(report_type: str, key: str, village_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db = get_mongo_db()
        filter_q: Dict[str, Any] = {"status": "ACTIVE"}
        if village_id:
            filter_q["village.id"] = village_id

        rtype = (report_type or "").lower().strip()
        k = (key or "").strip()

        if rtype == "surname":
            filter_q["nameMarathi.surname"] = k
        elif rtype == "family":
            # headName can be "कुटुंब (प्रमुख: X)" or "X"
            clean_head = k.replace("कुटुंब (प्रमुख:", "").replace(")", "").strip()
            filter_q["nameMarathi.fatherName"] = clean_head
        elif rtype == "membership":
            import re
            nums = [int(n) for n in re.findall(r'\d+', k)]
            if len(nums) >= 2:
                filter_q["serialNumber"] = {"$gte": nums[0], "$lte": nums[1]}
            elif len(nums) == 1:
                filter_q["serialNumber"] = {"$gte": nums[0]}
        elif rtype in ["category", "color-rating"]:
            filter_q["$or"] = [
                {"category.color": k},
                {"category.id": k},
                {"category.nameMarathi": k},
                {"category.name": k}
            ]
        elif rtype == "village":
            filter_q["$or"] = [
                {"village.id": k},
                {"village.nameMarathi": k},
                {"village.name": k}
            ]
        elif rtype == "mobile-status":
            if "उपलब्ध नाही" in k or "without" in k.lower():
                filter_q["$or"] = [{"mobileNumber": ""}, {"mobileNumber": None}]
            else:
                filter_q["mobileNumber"] = {"$nin": ["", None]}
        elif rtype == "religion":
            filter_q["religion"] = k
        elif rtype == "caste":
            filter_q["caste"] = k
        elif rtype == "profession":
            filter_q["profession"] = k
        elif rtype == "designation":
            filter_q["designation"] = k
        else:
            filter_q["$or"] = [
                {"nameMarathi.full": {"$regex": k}},
                {"nameMarathi.surname": {"$regex": k}}
            ]

        cursor = db.members.find(filter_q).sort("serialNumber", 1).limit(500)
        voters = []
        async for doc in cursor:
            voters.append({
                "id": str(doc.get("_id", "")),
                "full_name_mr": doc.get("nameMarathi", {}).get("full", "") or doc.get("fullName", ""),
                "full_name_en": doc.get("nameEnglish", {}).get("full", "") or doc.get("fullName", ""),
                "surname": doc.get("nameMarathi", {}).get("surname", "") or doc.get("surname", ""),
                "epic_number": doc.get("epicNumber", "") or f"voter_{doc.get('serialNumber', 0)}",
                "serial_number": doc.get("serialNumber", 0),
                "village_name_mr": doc.get("village", {}).get("nameMarathi", "साखराळे"),
                "mobile_number": doc.get("mobileNumber", ""),
                "status": doc.get("status", "ACTIVE")
            })
        return voters
