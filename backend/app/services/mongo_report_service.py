from typing import Optional, Dict, Any, List
from bson import ObjectId
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
        base_match: Dict[str, Any] = {"status": "ACTIVE"}
        if village_id:
            base_match["village.id"] = str(village_id)

        match_stage = dict(base_match)
        match_stage["religion"] = {"$nin": ["", None, "Not Specified", "-"]}

        pipeline = [
            {"$match": match_stage},
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
        base_match: Dict[str, Any] = {"status": "ACTIVE"}
        if village_id:
            base_match["village.id"] = str(village_id)

        match_stage = dict(base_match)
        match_stage["caste"] = {"$nin": ["", None, "Not Specified", "-"]}

        pipeline = [
            {"$match": match_stage},
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
        families: List[Dict[str, Any]] = []
        seen_keys = set()

        # 1. User-created families from db.families (manual family additions)
        fam_query: Dict[str, Any] = {}
        if village_id:
            fam_query["villageId"] = str(village_id)
        try:
            fam_cursor = db.families.find(fam_query).sort("updatedAt", -1).limit(200)
            async for fdoc in fam_cursor:
                fid = str(fdoc["_id"])
                head = (fdoc.get("familyHeadName") or "कुटुंब").strip()
                count = await db.members.count_documents({
                    "$or": [
                        {"familyId": fid},
                        {"familyId": fdoc["_id"]},
                        {"_id": {"$in": [ObjectId(m) for m in fdoc.get("memberIds", []) if ObjectId.is_valid(m)]}}
                    ]
                })
                if count == 0:
                    count = fdoc.get("totalMembers") or len(fdoc.get("memberIds", [])) or 1

                families.append({
                    "name": f"कुटुंब (प्रमुख: {head})",
                    "count": count,
                    "headName": head,
                    "key": f"fam_{fid}",
                    "familyId": fid
                })
                seen_keys.add(f"fam_{fid}")
                seen_keys.add(head)
        except Exception:
            pass

        # 2. Check members with familyId
        try:
            fam_m_pipe = [
                {"$match": {"status": "ACTIVE", "familyId": {"$nin": ["", None]}}},
                {"$group": {"_id": "$familyId", "count": {"$sum": 1}, "sample": {"$first": "$nameMarathi.full"}}}
            ]
            if village_id:
                fam_m_pipe[0]["$match"]["village.id"] = str(village_id)
            async for doc in db.members.aggregate(fam_m_pipe):
                fid = str(doc["_id"])
                if f"fam_{fid}" not in seen_keys:
                    head = (doc.get("sample") or "कुटुंब").strip()
                    families.append({
                        "name": f"कुटुंब (प्रमुख: {head})",
                        "count": doc.get("count", 1),
                        "headName": head,
                        "key": f"fam_{fid}",
                        "familyId": fid
                    })
                    seen_keys.add(f"fam_{fid}")
                    seen_keys.add(head)
        except Exception:
            pass

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
        base_match: Dict[str, Any] = {"status": "ACTIVE"}
        if village_id:
            base_match["village.id"] = str(village_id)

        match_stage = dict(base_match)
        match_stage["profession"] = {"$nin": ["", None, "Not Specified", "-"]}

        pipeline = [
            {"$match": match_stage},
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
        base_match: Dict[str, Any] = {"status": "ACTIVE"}
        if village_id:
            base_match["village.id"] = str(village_id)

        match_stage = dict(base_match)
        match_stage["designation"] = {"$nin": ["", None, "-"]}

        pipeline = [
            {"$match": match_stage},
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
        results = [doc async for doc in cursor]

        unspec_match = dict(base_match)
        unspec_match["$or"] = [
            {"designation": {"$in": ["", None, "-"]}},
            {"designation": {"$exists": False}}
        ]
        unspec_count = await db.members.count_documents(unspec_match)
        if unspec_count > 0:
            results.append({
                "designation": "General",
                "name": "सामान्य मतदार (General)",
                "key": "General",
                "count": unspec_count
            })

        return results

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
            if k.startswith("fam_"):
                real_fid = k[4:]
                f_variants = [real_fid]
                if ObjectId.is_valid(real_fid):
                    f_variants.append(ObjectId(real_fid))
                fdoc = None
                try:
                    fdoc = await db.families.find_one({"_id": ObjectId(real_fid)}) if ObjectId.is_valid(real_fid) else None
                except Exception:
                    pass
                id_list = []
                if fdoc and fdoc.get("memberIds"):
                    for mid in fdoc["memberIds"]:
                        if ObjectId.is_valid(str(mid)):
                            id_list.append(ObjectId(str(mid)))
                        id_list.append(str(mid))
                or_conds = [{"familyId": {"$in": f_variants}}]
                if id_list:
                    or_conds.append({"_id": {"$in": id_list}})
                filter_q["$or"] = or_conds
            else:
                clean_head = k.replace("कुटुंब (प्रमुख:", "").replace(")", "").strip()
                filter_q["$or"] = [
                    {"nameMarathi.fatherName": clean_head},
                    {"familyId": k},
                    {"nameMarathi.full": clean_head}
                ]
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
            if k in ["Not Specified", "अनिर्दिष्ट / इतर", "None", "-"]:
                filter_q["$or"] = [{"religion": {"$in": ["", None, "Not Specified", "-"]}}, {"religion": {"$exists": False}}]
            else:
                filter_q["religion"] = k
        elif rtype == "caste":
            if k in ["Not Specified", "अनिर्दिष्ट / इतर", "None", "-"]:
                filter_q["$or"] = [{"caste": {"$in": ["", None, "Not Specified", "-"]}}, {"caste": {"$exists": False}}]
            else:
                filter_q["caste"] = k
        elif rtype == "profession":
            if k in ["Not Specified", "अनिर्दिष्ट / इतर", "None", "-"]:
                filter_q["$or"] = [{"profession": {"$in": ["", None, "Not Specified", "-"]}}, {"profession": {"$exists": False}}]
            else:
                filter_q["profession"] = k
        elif rtype == "designation":
            if k in ["General", "सामान्य मतदार", "None", "-"]:
                filter_q["$or"] = [{"designation": {"$in": ["", None, "General", "-"]}}, {"designation": {"$exists": False}}]
            else:
                filter_q["designation"] = k
        else:
            filter_q["$or"] = [
                {"nameMarathi.full": {"$regex": k}},
                {"nameMarathi.surname": {"$regex": k}}
            ]

        cursor = db.members.find(filter_q, {
            "_id": 1, "nameMarathi": 1, "nameEnglish": 1, "fullName": 1,
            "epicNumber": 1, "serialNumber": 1, "village": 1, "mobileNumber": 1, "status": 1
        }).sort("serialNumber", 1).limit(500)

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
