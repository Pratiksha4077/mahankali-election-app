from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from pydantic import BaseModel

from app.database.mongodb import get_mongo_db
from app.auth.security import get_current_user, require_admin, AuthUser

router = APIRouter(prefix="/categories", tags=["Categories & Tagging"])

class CategoryCreatePayload(BaseModel):
    code: str
    name: str
    nameMarathi: str
    color: str
    description: Optional[str] = ""

def format_category(c: dict) -> dict:
    cid = str(c["_id"])
    return {
        "id": cid,
        "code": c.get("code", ""),
        "name": c.get("name", ""),
        "label_en": c.get("name", ""),
        "nameMarathi": c.get("nameMarathi", c.get("name", "")),
        "label_mr": c.get("nameMarathi", c.get("name", "")),
        "color": c.get("color", "#6B7280"),
        "color_hex": c.get("color", "#6B7280"),
        "description": c.get("description", ""),
        "is_active": c.get("isActive", True)
    }

@router.get("")
async def get_categories(
    db = Depends(get_mongo_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """List active sponsor-defined categories from MongoDB."""
    cursor = db.categories.find({"isActive": {"$ne": False}}).sort("displayOrder", 1)
    cats = []
    async for c in cursor:
        cats.append(format_category(c))
    return cats

@router.post("")
async def create_category(
    payload: CategoryCreatePayload,
    db = Depends(get_mongo_db),
    admin: AuthUser = Depends(require_admin)
):
    new_cat = {
        "code": payload.code.upper(),
        "name": payload.name,
        "nameMarathi": payload.nameMarathi,
        "color": payload.color,
        "description": payload.description,
        "isActive": True,
        "displayOrder": 1
    }
    res = await db.categories.insert_one(new_cat)
    new_cat["_id"] = res.inserted_id
    return {"success": True, "data": format_category(new_cat)}
