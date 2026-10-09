from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import datetime

from app.auth.security import AuthUser, get_current_user, require_admin
from app.database.mongodb import get_mongo_db
from app.services.mongo_user_service import MongoUserService

router = APIRouter(prefix="/api/activity", tags=["User Activity & Location"])


@router.post("/location", response_model=dict, summary="Log user location check-in")
async def log_user_location(
    payload: dict,
    current_user: AuthUser = Depends(get_current_user),
):
    """Log a user's location check-in. 
    Client should send: latitude, longitude, accuracy, address, city, district, etc.
    This endpoint is for deliberate in-app location sharing only - no covert monitoring.
    """
    db = get_mongo_db()
    user_id = current_user.id
    username = current_user.username

    # Extract location data from payload
    latitude = payload.get("latitude")
    longitude = payload.get("longitude")
    accuracy = payload.get("accuracy", 0)
    address = payload.get("address", "")
    city = payload.get("city", "")
    district = payload.get("district", "")
    subregion = payload.get("subregion", "")
    postalCode = payload.get("postalCode", "")
    village = payload.get("village", "")
    timestamp = payload.get("timestamp", datetime.utcnow())

    if latitude is None or longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Latitude and longitude are required"
        )

    activity = await MongoUserService.log_activity(
        user_id=user_id,
        username=username,
        action="LOCATION_CHECKIN",
        details=f"Location check-in: {address or f'{latitude:.5f}, {longitude:.5f}'}",
        target_member_id=None,
        target_member_name=None,
        metadata={
            "latitude": latitude,
            "longitude": longitude,
            "accuracy": accuracy,
            "address": address,
            "city": city,
            "district": district,
            "subregion": subregion,
            "postalCode": postalCode,
            "village": village,
            "timestamp": timestamp,
        }
    )

    return {
        "success": True,
        "data": activity,
        "message": "Location check-in logged successfully"
    }


@router.get("/users/{userId}/location-history", response_model=dict, summary="Get user location history (Admin only)")
async def get_user_location_history(
    userId: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=500, description="Items per page"),
    current_user: AuthUser = Depends(require_admin),
):
    """Admin endpoint to retrieve location history for a specific user.
    Returns paginated location records with readable location names, coordinates, and timestamps.
    """
    db = get_mongo_db()

    # Find the user to verify existence and get username
    user_doc = await db.users.find_one({
        "$or": [
            {"username": userId},
            {"_id": {"$regex": f"^{userId}$"}},
            {"username": userId}
        ]
    })

    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    page_int = max(1, page)
    limit_int = min(max(1, limit), 500)
    skip = (page_int - 1) * limit_int

    # Query app_activities for LOCATION_CHECKIN actions
    cursor = db.app_activities.find({
        "$or": [
            {"userId": userId},
            {"user_id": userId},
            {"username": user_doc.get("username", "")},
            {"metadata.userId": userId},
            {"metadata.username": user_doc.get("username", "")}
        ],
        "action": "LOCATION_CHECKIN"
    }).sort("timestamp", -1).skip(skip).limit(limit_int)

    locations = []
    async for doc in cursor:
        doc["id"] = str(doc.get("_id", ""))
        if "_id" in doc:
            del doc["_id"]

        metadata = doc.get("metadata", {})
        lat = metadata.get("latitude")
        lon = metadata.get("longitude")
        accuracy = metadata.get("accuracy", 0)
        address = metadata.get("address", "")
        city = metadata.get("city", "")
        district = metadata.get("district", "")
        village = metadata.get("village", "")
        timestamp = doc.get("timestamp")

        # Build readable location name
        location_parts = [p for p in [village, district, city, address] if p]
        readable_location = ", ".join(location_parts) or "Location recorded"

        locations.append({
            "id": doc.get("id", ""),
            "action": doc.get("action"),
            "details": doc.get("details", ""),
            "latitude": lat,
            "longitude": lon,
            "accuracy": accuracy,
            "address": address,
            "city": city,
            "district": district,
            "village": village,
            "readable_location": readable_location,
            "timestamp": timestamp,
            "recorded_at": timestamp.isoformat() if hasattr(timestamp, 'isoformat') else str(timestamp) if timestamp else "",
        })

    # Count total records
    count_cursor = db.app_activities.count_documents({
        "$or": [
            {"userId": userId},
            {"user_id": userId},
            {"username": user_doc.get("username", "")},
            {"metadata.userId": userId},
            {"metadata.username": user_doc.get("username", "")}
        ],
        "action": "LOCATION_CHECKIN"
    })
    total = await count_cursor.fetch_length if hasattr(count_cursor, 'fetch_length') else 0
    # Better approach
    total = await db.app_activities.count_documents({
        "$or": [
            {"userId": userId},
            {"user_id": userId},
            {"username": user_doc.get("username", "")},
            {"metadata.userId": userId},
            {"metadata.username": user_doc.get("username", "")}
        ],
        "action": "LOCATION_CHECKIN"
    })

    return {
        "success": True,
        "data": {
            "userId": userId,
            "username": user_doc.get("username", ""),
            "locations": locations,
            "pagination": {
                "page": page_int,
                "limit": limit_int,
                "total": total,
                "pages": (total + limit_int - 1) // limit_int if limit_int > 0 else 0
            }
        },
        "message": f"Retrieved {len(locations)} location records for {user_doc.get('username', userId)}"
    }


@router.get("/users/{userId}/device-activity", response_model=dict, summary="Get user device activity (Admin only)")
async def get_user_device_activity(
    userId: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=500, description="Items per page"),
    current_user: AuthUser = Depends(require_admin),
):
    """Admin endpoint to retrieve device activity for a specific user.
    Includes CALL_INITIATED, SMS_INITIATED, LOCATION_CHECKIN, and other in-app actions.
    """
    db = get_mongo_db()

    # Find the user to verify existence and get username
    user_doc = await db.users.find_one({
        "$or": [
            {"username": userId},
            {"_id": {"$regex": f"^{userId}$"}},
            {"username": userId}
        ]
    })

    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    page_int = max(1, page)
    limit_int = min(max(1, limit), 500)
    skip = (page_int - 1) * limit_int

    # Query app_activities for the user
    cursor = db.app_activities.find({
        "$or": [
            {"userId": userId},
            {"user_id": userId},
            {"username": user_doc.get("username", "")},
        ]
    }).sort("timestamp", -1).skip(skip).limit(limit_int)

    activities = []
    async for doc in cursor:
        doc["id"] = str(doc.get("_id", ""))
        if "_id" in doc:
            del doc["_id"]

        metadata = doc.get("metadata", {})
        act = doc.get("action", "").upper()

        # Build readable details
        details = doc.get("details", "")
        target_member = metadata.get("targetMemberName") or metadata.get("voter") or ""

        activities.append({
            "id": doc.get("id", ""),
            "action": doc.get("action"),
            "action_keyword": act,
            "details": details,
            "timestamp": doc.get("timestamp"),
            "targetMemberName": target_member,
            "userId": doc.get("userId"),
            "username": doc.get("username"),
        })

    # Count total records
    total = await db.app_activities.count_documents({
        "$or": [
            {"userId": userId},
            {"user_id": userId},
            {"username": user_doc.get("username", "")}
        ]
    })

    return {
        "success": True,
        "data": {
            "userId": userId,
            "username": user_doc.get("username", ""),
            "activities": activities,
            "pagination": {
                "page": page_int,
                "limit": limit_int,
                "total": total,
                "pages": (total + limit_int - 1) // limit_int if limit_int > 0 else 0
            }
        },
        "message": f"Retrieved {len(activities)} activity records for {user_doc.get('username', userId)}"
    }