import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, JSON, Float
from sqlalchemy.orm import relationship
from app.config.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, index=True, nullable=False)
    mobile = Column(String(20), index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="USER", nullable=False) # "ADMIN" or "USER"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)

    # Relationships
    assigned_members = relationship("Member", back_populates="assigned_user", foreign_keys="Member.assigned_user_id")
    audit_logs = relationship("AuditLog", back_populates="user")
    sync_histories = relationship("SyncHistory", back_populates="user")

class Village(Base):
    __tablename__ = "villages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name_en = Column(String(150), index=True, nullable=False)
    name_mr = Column(String(150), index=True, nullable=False)
    taluka = Column(String(100), default="Walwa / इस्लामपूर")
    district = Column(String(100), default="Sangli / सांगली")
    pin_code = Column(String(10), default="415414")
    total_voters = Column(Integer, default=0)
    active_voters = Column(Integer, default=0)
    deceased_voters = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    wards = relationship("Ward", back_populates="village", cascade="all, delete-orphan")
    members = relationship("Member", back_populates="village")

class Ward(Base):
    __tablename__ = "wards"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    village_id = Column(String(36), ForeignKey("villages.id"), nullable=False)
    ward_number = Column(Integer, nullable=False)
    name = Column(String(200), nullable=False)

    village = relationship("Village", back_populates="wards")
    members = relationship("Member", back_populates="ward")

class Category(Base):
    __tablename__ = "categories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    code = Column(String(50), unique=True, nullable=False)
    label_en = Column(String(100), nullable=False)
    label_mr = Column(String(100), nullable=False)
    color_hex = Column(String(20), nullable=False)
    description = Column(String(255), default="")
    is_active = Column(Boolean, default=True)

    members = relationship("Member", back_populates="category")

class Family(Base):
    __tablename__ = "families"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    village_id = Column(String(36), ForeignKey("villages.id"), nullable=True)
    house_number = Column(String(50), index=True, nullable=True)
    family_head_name = Column(String(150), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("Member", back_populates="family")

class Member(Base):
    __tablename__ = "members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    epic_number = Column(String(50), index=True, nullable=True) # Voter ID (e.g. XTX7477128)
    serial_number = Column(Integer, index=True, nullable=True) # Anukramank (1..694)
    booth_part_number = Column(String(20), index=True, default="62") # e.g. "62" or "B-299"
    
    # Names
    full_name_mr = Column(String(200), index=True, nullable=False)
    full_name_en = Column(String(200), index=True, nullable=True)
    surname = Column(String(100), index=True, nullable=True)
    first_name = Column(String(100), nullable=True)
    father_name = Column(String(100), nullable=True)
    relative_name_mr = Column(String(200), nullable=True)
    relation_type = Column(String(50), default="Father") # Father/Husband/Mother/Other
    
    # Details
    house_number = Column(String(50), index=True, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), default="Male") # Male / Female / Other (पुरुष / महिला / तृतीय पंथी)
    
    # Foreign Keys
    village_id = Column(String(36), ForeignKey("villages.id"), nullable=True, index=True)
    ward_id = Column(String(36), ForeignKey("wards.id"), nullable=True)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=True)
    assigned_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    family_id = Column(String(36), ForeignKey("families.id"), nullable=True)

    # Demographic & Contact
    mobile_number = Column(String(20), index=True, nullable=True)
    address = Column(Text, nullable=True)
    pin_code = Column(String(10), default="415414")
    religion = Column(String(100), index=True, nullable=True)
    caste = Column(String(100), index=True, nullable=True)
    designation = Column(String(100), index=True, nullable=True)
    profession = Column(String(100), index=True, nullable=True)

    # Status
    status = Column(String(20), default="ACTIVE", index=True) # "ACTIVE" or "DECEASED"
    deceased_date = Column(DateTime, nullable=True)
    deceased_recorded_by = Column(String(36), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    village = relationship("Village", back_populates="members")
    ward = relationship("Ward", back_populates="members")
    category = relationship("Category", back_populates="members")
    assigned_user = relationship("User", back_populates="assigned_members", foreign_keys=[assigned_user_id])
    family = relationship("Family", back_populates="members")

class ImportJob(Base):
    __tablename__ = "import_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False) # "PDF", "EXCEL", "CSV"
    file_size = Column(Integer, default=0) # in bytes
    total_pages = Column(Integer, default=0)
    status = Column(String(50), default="pending") # "pending", "processing", "completed", "failed"
    progress = Column(Integer, default=0) # 0 to 100
    stage = Column(String(100), default="File uploaded") # 1 of 8 stages

    # Metrics
    total_records = Column(Integer, default=0)
    valid_records = Column(Integer, default=0)
    invalid_records = Column(Integer, default=0)
    duplicate_records = Column(Integer, default=0)
    imported_records = Column(Integer, default=0)

    error_summary = Column(Text, nullable=True)
    result_file_path = Column(String(255), nullable=True) # Generated Excel path
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    records = relationship("ImportRecord", back_populates="job", cascade="all, delete-orphan")

class ImportRecord(Base):
    __tablename__ = "import_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("import_jobs.id"), nullable=False)
    row_index = Column(Integer, nullable=False)
    raw_data = Column(JSON, nullable=True)
    parsed_data = Column(JSON, nullable=True)
    status = Column(String(20), default="VALID") # "VALID", "INVALID", "DUPLICATE"
    errors = Column(Text, nullable=True)
    is_duplicate = Column(Boolean, default=False)

    job = relationship("ImportJob", back_populates="records")

class SyncHistory(Base):
    __tablename__ = "sync_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    sync_type = Column(String(20), default="QUICK") # "QUICK" or "FULL"
    status = Column(String(20), default="SUCCESS")
    records_pulled = Column(Integer, default=0)
    records_pushed = Column(Integer, default=0)
    last_synced_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sync_histories")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False) # e.g. "LOGIN", "SEARCH", "UPDATE_MEMBER", "MARK_DECEASED"
    entity_type = Column(String(50), nullable=True) # "MEMBER", "USER", "IMPORT_JOB"
    entity_id = Column(String(36), nullable=True)
    details = Column(Text, nullable=True)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="audit_logs")
