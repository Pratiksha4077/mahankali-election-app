import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.models import User, Village, Ward, Category, Member, AuditLog
from app.auth.security import get_password_hash

logger = logging.getLogger("election_app.seed_data")

def seed_initial_data(db: Session):
    """SQLite initialization: Seeds ONLY Admin, Categories, and Base Villages. No dummy users or voters."""
    # 1. Admin only
    if not db.query(User).filter(User.username == "admin").first():
        admin = User(
            username="admin",
            mobile="9822011223",
            hashed_password=get_password_hash("admin123"),
            role="ADMIN",
            is_active=True,
            created_at=datetime.utcnow()
        )
        db.add(admin)
        db.commit()

    # 2. Seed Categories (5-color system)
    category_defs = [
        {"code": "CAT_GREEN", "label_en": "Strong Supporter", "label_mr": "पक्के समर्थक (हिरवा)", "color_hex": "#10B981"},
        {"code": "CAT_LIGHT_GREEN", "label_en": "Leaning Supporter", "label_mr": "अनुकूल मतदार (फिकट हिरवा)", "color_hex": "#84CC16"},
        {"code": "CAT_YELLOW", "label_en": "Neutral / Undecided", "label_mr": "तटस्थ / अनिर्णित (पिवळा)", "color_hex": "#F59E0B"},
        {"code": "CAT_ORANGE", "label_en": "Leaning Opposition", "label_mr": "प्रतिकूल झुकणारे (केशरी)", "color_hex": "#F97316"},
        {"code": "CAT_RED", "label_en": "Strong Opposition", "label_mr": "कडक विरोध (लाल)", "color_hex": "#EF4444"},
    ]
    for c_def in category_defs:
        if not db.query(Category).filter(Category.code == c_def["code"]).first():
            cat = Category(**c_def, is_active=True)
            db.add(cat)
    db.commit()

    # 3. Base Villages
    village_defs = [
        {"name_en": "Sakharele", "name_mr": "साखराळे", "taluka": "वाळवा", "district": "सांगली", "pin_code": "415414"},
        {"name_en": "Agran Dhulgaon", "name_mr": "अग्रण धुळगांव", "taluka": "कवठे महांकाळ", "district": "सांगली", "pin_code": "416405"},
        {"name_en": "Kavathe Mahankal", "name_mr": "कवठे महांकाळ", "taluka": "कवठे महांकाळ", "district": "सांगली", "pin_code": "416405"},
    ]
    for v_def in village_defs:
        v = db.query(Village).filter(Village.name_mr == v_def["name_mr"]).first()
        if not v:
            v = Village(**v_def)
            db.add(v)
    db.commit()
