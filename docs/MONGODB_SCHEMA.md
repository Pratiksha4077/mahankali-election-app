# MongoDB Schema Specification (MONGODB_SCHEMA.md)
**Project**: Mahankali Voters — Election & Voter Management System  
**Database**: MongoDB 8.x  
**Database Name**: `election_db`  
**Driver**: Motor (Async) & PyMongo (Sync/Worker)  

---

## 1. Overview of Collections

The database contains 14 specialized collections designed for high scalability, rapid search, and auditability:

1. `users`: System administrators and application users.
2. `villages`: Gram panchayats, municipalities, and administrative divisions.
3. `wards`: Electoral wards, booths, and sections.
4. `members`: Primary voter & member master collection (Section 21 format).
5. `families`: Family unit groupings linking member records.
6. `categories`: Sponsor-configurable classification tags (Green, Yellow, Orange, Red).
7. `assignments`: Village and ward allocations assigned to application users.
8. `import_jobs`: Asynchronous import job status and progress tracking.
9. `import_files`: Multi-file upload ledger associated with villages.
10. `import_records`: Intermediate parsed rows staging for validation and duplicate checking.
11. `audit_logs`: Administrative and operational change audit trail.
12. `app_activities`: Strict in-app activity timeline for application users.
13. `sync_history`: Device and user synchronization ledger.
14. `notifications`: System announcements and import completion alerts.

---

## 2. Collection Schemas & Sample Documents

### 2.1 Collection: `members`
The primary collection storing voter and organizational member records.

```json
{
  "_id": "65fc1a89b4e12c001f89a101",
  "epicNumber": "XTX7438468",
  "membershipNumber": "B-1",
  "serialNumber": 1,
  "boothPartNumber": "61",

  "name": {
    "full": "Digambar Krishna Pokshe",
    "first": "Digambar",
    "surname": "Pokshe",
    "fatherName": "Krishna"
  },

  "nameMarathi": {
    "full": "पोक्षे दिगंबर कृष्णा",
    "first": "दिगंबर",
    "surname": "पोक्षे",
    "fatherName": "कृष्णा"
  },

  "relative": {
    "relationType": "Father",
    "nameMarathi": "कृष्णा",
    "nameEnglish": "Krishna"
  },

  "village": {
    "id": "65fc1a89b4e12c001f89a001",
    "name": "Agran Dhulgaon",
    "nameMarathi": "अग्रण धुळगांव"
  },

  "ward": {
    "id": "65fc1a89b4e12c001f89a010",
    "number": 1,
    "name": "बिरोबा देवालय परिसर"
  },

  "houseNumber": "401",
  "age": 53,
  "gender": "Male",

  "mobileNumber": "9822012345",
  "address": "बिरोबा देवालय जवळ, साखराळे",
  "pinCode": "415414",

  "religion": "Hindu",
  "caste": "Maratha",
  "designation": "Member",
  "profession": "Agriculture",

  "familyId": "65fc1a89b4e12c001f89a200",

  "category": {
    "id": "65fc1a89b4e12c001f89a050",
    "name": "Green",
    "nameMarathi": "हिरवा",
    "color": "#10B981"
  },

  "status": "ACTIVE",
  "deceasedDate": null,
  "deceasedRecordedBy": null,

  "assignedUserId": "65fc1a89b4e12c001f89a020",

  "source": {
    "fileName": "Sakharele_Booth61.pdf",
    "fileType": "PDF",
    "importJobId": "65fc1a89b4e12c001f89a999",
    "uploadDate": "2026-09-22T10:00:00.000Z",
    "uploadedBy": "admin"
  },

  "version": 1,
  "createdAt": "2026-09-22T10:00:00.000Z",
  "updatedAt": "2026-09-22T12:30:00.000Z",
  "updatedBy": "rupesh_sir"
}
```

---

### 2.2 Collection: `users`

```json
{
  "_id": "65fc1a89b4e12c001f89a020",
  "username": "rupesh_sir",
  "fullName": "Rupesh Patil",
  "mobileNumber": "9579860030",
  "hashedPassword": "$2b$12$eXampLeHaSheDPasSwOrD89...",
  "role": "USER",
  "accountStatus": "ACTIVE",
  "assignedVillages": [
    "65fc1a89b4e12c001f89a001"
  ],
  "lastLogin": "2026-09-22T14:15:00.000Z",
  "lastActivity": "2026-09-22T14:45:00.000Z",
  "createdAt": "2026-09-20T08:00:00.000Z",
  "updatedAt": "2026-09-22T14:45:00.000Z",
  "createdBy": "admin"
}
```

---

### 2.3 Collection: `villages`

```json
{
  "_id": "65fc1a89b4e12c001f89a001",
  "name": "Kavthe Mahankal",
  "nameMarathi": "कवठेमहांकाळ",
  "taluka": "Kavthe Mahankal",
  "talukaMarathi": "कवठे महांकाळ",
  "district": "Sangli",
  "districtMarathi": "सांगली",
  "pinCode": "416405",
  "stats": {
    "totalVoters": 5683,
    "activeMembers": 5400,
    "deceasedMembers": 283,
    "totalFamilies": 1240,
    "categorizedMembers": 4820
  },
  "sourceFilesCount": 3,
  "createdAt": "2026-09-20T08:00:00.000Z",
  "updatedAt": "2026-09-22T12:00:00.000Z"
}
```

---

### 2.4 Collection: `families`

```json
{
  "_id": "65fc1a89b4e12c001f89a200",
  "villageId": "65fc1a89b4e12c001f89a001",
  "familyHeadMemberId": "65fc1a89b4e12c001f89a101",
  "familyHeadName": "पोक्षे दिगंबर कृष्णा",
  "houseNumber": "401",
  "memberIds": [
    "65fc1a89b4e12c001f89a101",
    "65fc1a89b4e12c001f89a102",
    "65fc1a89b4e12c001f89a103"
  ],
  "totalMembers": 3,
  "notes": "Family residence verified in Ward 1",
  "createdAt": "2026-09-22T11:00:00.000Z",
  "updatedAt": "2026-09-22T11:00:00.000Z"
}
```

---

### 2.5 Collection: `categories`

```json
{
  "_id": "65fc1a89b4e12c001f89a050",
  "code": "GREEN",
  "name": "Green",
  "nameMarathi": "हिरवा",
  "color": "#10B981",
  "description": "Category 1 / Confirmed Support (Sponsor Defined)",
  "displayOrder": 1,
  "isActive": true
}
```

---

### 2.6 Collection: `import_jobs`

```json
{
  "_id": "65fc1a89b4e12c001f89a999",
  "villageId": "65fc1a89b4e12c001f89a001",
  "villageName": "कवठेमहांकाळ",
  "fileName": "village_01.pdf",
  "fileType": "PDF",
  "fileSize": 3482100,
  "totalPages": 33,
  "status": "COMPLETED",
  "progress": 100,
  "currentStage": "8. Completed",
  "stages": [
    { "name": "File uploaded", "completed": true, "timestamp": "2026-09-22T10:00:00Z" },
    { "name": "PDF analyzed", "completed": true, "timestamp": "2026-09-22T10:00:02Z" },
    { "name": "Text extracted", "completed": true, "timestamp": "2026-09-22T10:00:10Z" },
    { "name": "Records detected", "completed": true, "timestamp": "2026-09-22T10:00:15Z" },
    { "name": "Validating", "completed": true, "timestamp": "2026-09-22T10:00:20Z" },
    { "name": "Duplicate checking", "completed": true, "timestamp": "2026-09-22T10:00:25Z" },
    { "name": "Generating Excel", "completed": true, "timestamp": "2026-09-22T10:00:30Z" },
    { "name": "Importing database", "completed": true, "timestamp": "2026-09-22T10:00:35Z" }
  ],
  "metrics": {
    "totalRecords": 844,
    "validRecords": 840,
    "invalidRecords": 4,
    "duplicateRecords": 0,
    "importedRecords": 840
  },
  "excelDownloadUrl": "/static/processed/election_extract_65fc1a89.xlsx",
  "errorReportUrl": null,
  "uploadedBy": "admin",
  "createdAt": "2026-09-22T10:00:00.000Z",
  "completedAt": "2026-09-22T10:00:35.000Z"
}
```

---

### 2.7 Collection: `app_activities`
Strict in-app user action logging (protects user privacy; zero covert surveillance).

```json
{
  "_id": "65fc1a89b4e12c001f89a801",
  "userId": "65fc1a89b4e12c001f89a020",
  "username": "rupesh_sir",
  "action": "CALL_INITIATED",
  "targetMemberId": "65fc1a89b4e12c001f89a101",
  "targetMemberName": "पोक्षे दिगंबर कृष्णा",
  "details": "User tapped phone dialer button for member",
  "metadata": {
    "platform": "Android",
    "villageId": "65fc1a89b4e12c001f89a001"
  },
  "timestamp": "2026-09-22T14:20:00.000Z"
}
```

---

## 3. MongoDB Indexes Specification

To support instantaneous search and aggregation across hundreds of thousands of voter records, the following compound and single indexes are deployed:

### `members` Collection Indexes
```javascript
// 1. Text Search Index for English & Marathi queries
db.members.createIndex(
  {
    "nameMarathi.full": "text",
    "name.full": "text",
    "nameMarathi.surname": "text",
    "membershipNumber": "text",
    "epicNumber": "text",
    "mobileNumber": "text"
  },
  {
    name: "idx_members_text_search",
    weights: {
      "nameMarathi.full": 10,
      "membershipNumber": 8,
      "nameMarathi.surname": 6,
      "name.full": 5,
      "mobileNumber": 5
    }
  }
);

// 2. Village & Status Compound Index (Listing & Filtering)
db.members.createIndex({ "village.id": 1, "status": 1, "serialNumber": 1 });

// 3. Unique/Lookup on Membership Number per Village
db.members.createIndex({ "village.id": 1, "membershipNumber": 1 });

// 4. EPIC Number Index
db.members.createIndex({ "epicNumber": 1 }, { sparse: true });

// 5. Category Aggregation Index
db.members.createIndex({ "village.id": 1, "category.id": 1 });

// 6. Family Association Index
db.members.createIndex({ "familyId": 1 });

// 7. Assigned User Filter Index
db.members.createIndex({ "assignedUserId": 1, "village.id": 1 });
```

### `users` Collection Indexes
```javascript
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "mobileNumber": 1 });
db.users.createIndex({ "role": 1, "accountStatus": 1 });
```

### `import_jobs` Collection Indexes
```javascript
db.import_jobs.createIndex({ "villageId": 1, "createdAt": -1 });
db.import_jobs.createIndex({ "status": 1 });
```

### `app_activities` Collection Indexes
```javascript
db.app_activities.createIndex({ "userId": 1, "timestamp": -1 });
db.app_activities.createIndex({ "action": 1, "timestamp": -1 });
```
