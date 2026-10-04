from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

# ----------------- AUTH & USER -----------------

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class UserBase(BaseModel):
    username: str
    mobile: str
    role: str = "USER" # "ADMIN" or "USER"
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    mobile: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: str
    created_at: datetime
    last_activity: datetime

    class Config:
        from_attributes = True

# ----------------- VILLAGE & WARD -----------------

class WardResponse(BaseModel):
    id: str
    ward_number: int
    name: str

    class Config:
        from_attributes = True

class VillageBase(BaseModel):
    name_en: str
    name_mr: str
    taluka: Optional[str] = "Walwa / इस्लामपूर"
    district: Optional[str] = "Sangli / सांगली"
    pin_code: Optional[str] = "415414"

class VillageCreate(VillageBase):
    pass

class VillageResponse(VillageBase):
    id: str
    total_voters: int
    active_voters: int
    deceased_voters: int
    created_at: datetime
    wards: List[WardResponse] = []

    class Config:
        from_attributes = True

# ----------------- CATEGORY -----------------

class CategoryBase(BaseModel):
    code: str
    label_en: str
    label_mr: str
    color_hex: str
    description: Optional[str] = ""
    is_active: bool = True

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: str

    class Config:
        from_attributes = True

# ----------------- MEMBER / VOTER -----------------

class MemberBase(BaseModel):
    epic_number: Optional[str] = None
    serial_number: Optional[int] = None
    booth_part_number: Optional[str] = "62"
    full_name_mr: str
    full_name_en: Optional[str] = None
    surname: Optional[str] = None
    first_name: Optional[str] = None
    father_name: Optional[str] = None
    relative_name_mr: Optional[str] = None
    relation_type: Optional[str] = "Father"
    house_number: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = "Male"
    village_id: Optional[str] = None
    ward_id: Optional[str] = None
    category_id: Optional[str] = None
    mobile_number: Optional[str] = None
    address: Optional[str] = None
    pin_code: Optional[str] = "415414"
    religion: Optional[str] = None
    caste: Optional[str] = None
    designation: Optional[str] = None
    profession: Optional[str] = None
    status: Optional[str] = "ACTIVE"

class MemberCreate(MemberBase):
    pass

class MemberUpdate(BaseModel):
    full_name_mr: Optional[str] = None
    full_name_en: Optional[str] = None
    surname: Optional[str] = None
    first_name: Optional[str] = None
    father_name: Optional[str] = None
    relative_name_mr: Optional[str] = None
    relation_type: Optional[str] = None
    house_number: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    village_id: Optional[str] = None
    ward_id: Optional[str] = None
    category_id: Optional[str] = None
    mobile_number: Optional[str] = None
    address: Optional[str] = None
    pin_code: Optional[str] = None
    religion: Optional[str] = None
    caste: Optional[str] = None
    designation: Optional[str] = None
    profession: Optional[str] = None
    status: Optional[str] = None

class MemberDeceasedUpdate(BaseModel):
    is_deceased: bool

class MemberCategoryUpdate(BaseModel):
    category_id: Optional[str] = None

class MemberResponse(MemberBase):
    id: str
    village_name_mr: Optional[str] = None
    village_name_en: Optional[str] = None
    category_color: Optional[str] = None
    category_label: Optional[str] = None
    deceased_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MemberListResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    items: List[MemberResponse]

# ----------------- IMPORT & EXPORT -----------------

class ImportJobResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    total_pages: int
    status: str
    progress: int
    stage: str
    total_records: int
    valid_records: int
    invalid_records: int
    duplicate_records: int
    imported_records: int
    error_summary: Optional[str] = None
    result_file_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ImportPreviewItem(BaseModel):
    row_index: int
    epic_number: Optional[str] = None
    serial_number: Optional[int] = None
    full_name: str
    relative_name: Optional[str] = None
    house_number: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    village: Optional[str] = None
    status: str = "VALID"
    errors: Optional[str] = None
    is_duplicate: bool = False

class ImportJobPreviewResponse(BaseModel):
    job_id: str
    total_records: int
    valid_count: int
    invalid_count: int
    duplicate_count: int
    preview_rows: List[ImportPreviewItem]

# ----------------- SYNC -----------------

class SyncRequest(BaseModel):
    last_synced_at: Optional[datetime] = None
    modified_members: Optional[List[Dict[str, Any]]] = []

class SyncResponse(BaseModel):
    synced_at: datetime
    pulled_count: int
    pushed_count: int
    updated_members: List[MemberResponse]

# ----------------- DASHBOARD & REPORTS -----------------

class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    disabled_users: int
    total_villages: int
    total_members: int
    active_members: int
    deceased_members: int
    duplicate_records: int
    pending_imports: int
    last_sync: Optional[datetime] = None
    members_by_village: List[Dict[str, Any]]
    members_by_category: List[Dict[str, Any]]
    recent_activities: List[Dict[str, Any]]

class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    username: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    details: Optional[str] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True
