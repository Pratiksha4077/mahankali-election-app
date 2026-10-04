from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class NameSubDoc(BaseModel):
    full: str = ""
    first: Optional[str] = ""
    surname: Optional[str] = ""
    fatherName: Optional[str] = ""

class RelativeSubDoc(BaseModel):
    relationType: str = "Father"  # Father / Husband / Mother / Other
    nameMarathi: Optional[str] = ""
    nameEnglish: Optional[str] = ""

class VillageRefSubDoc(BaseModel):
    id: str = ""
    name: str = ""
    nameMarathi: str = ""

class WardRefSubDoc(BaseModel):
    id: Optional[str] = None
    number: Optional[int] = None
    name: Optional[str] = ""

class CategoryRefSubDoc(BaseModel):
    id: Optional[str] = None
    name: str = "Uncategorized"
    nameMarathi: str = "अवर्गीकृत"
    color: str = "#6B7280"

class SourceMetadataSubDoc(BaseModel):
    fileName: str = ""
    fileType: str = "PDF"  # PDF / EXCEL / CSV / MANUAL
    importJobId: Optional[str] = None
    uploadDate: Optional[datetime] = None
    uploadedBy: Optional[str] = "admin"

class MemberDoc(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    membershipNumber: Optional[str] = None
    epicNumber: Optional[str] = None
    serialNumber: Optional[int] = None
    boothPartNumber: Optional[str] = "61"

    name: NameSubDoc = Field(default_factory=NameSubDoc)
    nameMarathi: NameSubDoc = Field(default_factory=NameSubDoc)
    relative: RelativeSubDoc = Field(default_factory=RelativeSubDoc)

    village: VillageRefSubDoc = Field(default_factory=VillageRefSubDoc)
    ward: Optional[WardRefSubDoc] = None

    houseNumber: Optional[str] = ""
    age: Optional[int] = None
    gender: Optional[str] = "Male"

    mobileNumber: Optional[str] = ""
    address: Optional[str] = ""
    pinCode: Optional[str] = "415414"

    religion: Optional[str] = ""
    caste: Optional[str] = ""
    designation: Optional[str] = ""
    profession: Optional[str] = ""

    familyId: Optional[str] = None

    category: CategoryRefSubDoc = Field(default_factory=CategoryRefSubDoc)

    status: str = "ACTIVE"  # "ACTIVE" or "DECEASED"
    deceasedDate: Optional[datetime] = None
    deceasedRecordedBy: Optional[str] = None

    assignedUserId: Optional[str] = None
    source: SourceMetadataSubDoc = Field(default_factory=SourceMetadataSubDoc)

    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    updatedBy: Optional[str] = "system"

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class UserDoc(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    username: str
    fullName: str
    mobileNumber: str
    hashedPassword: str
    role: str = "USER"  # "ADMIN" or "USER"
    accountStatus: str = "ACTIVE"  # "ACTIVE" or "DISABLED"
    assignedVillages: List[str] = Field(default_factory=list)
    lastLogin: Optional[datetime] = None
    lastActivity: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    createdBy: Optional[str] = "admin"

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class VillageDoc(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    nameMarathi: str
    taluka: str = "Walwa"
    talukaMarathi: str = "वाळवा"
    district: str = "Sangli"
    districtMarathi: str = "सांगली"
    pinCode: str = "415414"
    stats: Dict[str, int] = Field(default_factory=lambda: {
        "totalVoters": 0,
        "activeMembers": 0,
        "deceasedMembers": 0,
        "totalFamilies": 0,
        "categorizedMembers": 0
    })
    sourceFilesCount: int = 0
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class FamilyDoc(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    villageId: str
    familyHeadMemberId: Optional[str] = None
    familyHeadName: str
    houseNumber: Optional[str] = ""
    memberIds: List[str] = Field(default_factory=list)
    totalMembers: int = 0
    notes: Optional[str] = ""
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class CategoryDoc(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    code: str  # "GREEN", "YELLOW", "ORANGE", "RED"
    name: str  # "Green", "Yellow", "Orange", "Red"
    nameMarathi: str  # "हिरवा", "पिवळा", "केशरी", "लाल"
    color: str  # "#10B981", "#F59E0B", "#F97316", "#EF4444"
    description: Optional[str] = ""
    displayOrder: int = 1
    isActive: bool = True

    class Config:
        populate_by_name = True

class ImportJobDoc(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    villageId: str
    villageName: str
    fileName: str
    fileType: str = "PDF"  # "PDF", "EXCEL", "CSV"
    fileSize: int = 0
    totalPages: int = 0
    status: str = "QUEUED"  # QUEUED, PROCESSING, COMPLETED, FAILED
    progress: int = 0  # 0 to 100
    currentStage: str = "File uploaded"
    stages: List[Dict[str, Any]] = Field(default_factory=list)
    metrics: Dict[str, int] = Field(default_factory=lambda: {
        "totalRecords": 0,
        "validRecords": 0,
        "invalidRecords": 0,
        "duplicateRecords": 0,
        "importedRecords": 0
    })
    excelDownloadUrl: Optional[str] = None
    errorReportUrl: Optional[str] = None
    uploadedBy: str = "admin"
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    completedAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class AppActivityDoc(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    userId: Optional[str] = None
    username: Optional[str] = "system"
    action: str  # LOGIN, SEARCH, VIEW_MEMBER, UPDATE_MEMBER, CALL_INITIATED, SMS_INITIATED, etc.
    targetMemberId: Optional[str] = None
    targetMemberName: Optional[str] = None
    details: Optional[str] = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}
