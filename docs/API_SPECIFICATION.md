# REST API Specification (API_SPECIFICATION.md)
**Project**: Mahankali Voters — Election & Voter Management System  
**Version**: 2.0.0  
**Base URL**: `/api`  
**Authentication**: HTTP Bearer JWT Token (`Authorization: Bearer <token>`)  

---

## 1. Global Standards & Error Envelope

All API endpoints adhere to a standardized JSON response format.

### 1.1 Success Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### 1.2 Error Response Envelope (Section 53)
```json
{
  "success": false,
  "message": "Invalid membership number provided",
  "errorCode": "INVALID_MEMBERSHIP",
  "details": null
}
```

### 1.3 Standard HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Input validation failed or malformed payload.
- `401 Unauthorized`: Missing or expired JWT token.
- `403 Forbidden`: Insufficient role/permissions (e.g. non-admin accessing admin routes).
- `404 Not Found`: Resource not found in database.
- `409 Conflict`: Duplicate key error (e.g. username or EPIC already exists).
- `500 Internal Server Error`: Safe, sanitized server error message.

---

## 2. API Endpoints Specification

### 2.1 Authentication (`/api/auth`)

#### `POST /api/auth/login`
- **Description**: Authenticate user via username/mobile and password.
- **Access**: Public
- **Request Body**:
```json
{
  "username": "admin",
  "password": "adminpassword"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1Ni...",
    "tokenType": "bearer",
    "user": {
      "id": "65fc1a89b4e12c001f89a020",
      "username": "admin",
      "fullName": "System Administrator",
      "role": "ADMIN",
      "accountStatus": "ACTIVE"
    }
  }
}
```

#### `POST /api/auth/logout`
- **Description**: Invalidate user session and log `LOGOUT` activity.
- **Access**: Authenticated

#### `GET /api/auth/me`
- **Description**: Get current user profile and role details.
- **Access**: Authenticated

---

### 2.2 Admin User Management (`/api/admin/users`)
*All endpoints strictly require `ADMIN` role.*

#### `GET /api/admin/users`
- **Description**: List application users with filtering by status and search query.
- **Query Params**: `status` (ACTIVE / DISABLED / ALL), `q` (search name/mobile), `page`, `limit`

#### `POST /api/admin/users`
- **Description**: Create a new application user.
- **Request Body**:
```json
{
  "fullName": "Santosh Patil",
  "username": "santosh_patil",
  "mobileNumber": "9822334455",
  "password": "SecurePassword123",
  "role": "USER",
  "accountStatus": "ACTIVE",
  "assignedVillages": ["65fc1a89b4e12c001f89a001"]
}
```

#### `GET /api/admin/users/{id}`
- **Description**: Get single user details and application summary.

#### `PUT /api/admin/users/{id}`
- **Description**: Update user information (name, mobile, role, assigned villages).

#### `PATCH /api/admin/users/{id}/status`
- **Description**: Enable or disable user account (`ACTIVE` / `DISABLED`).

#### `DELETE /api/admin/users/{id}`
- **Description**: Soft delete or deactivate user.

---

### 2.3 Admin Dashboard & Analytics (`/api/admin`)

#### `GET /api/admin/dashboard`
- **Description**: High-level statistical cards and distribution summaries.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "totalVoters": 5683,
    "activeMembers": 5400,
    "deadRecords": 283,
    "appUsers": 25,
    "activeAppUsers": 22,
    "disabledAppUsers": 3,
    "totalVillages": 14,
    "totalFamilies": 1240,
    "importedRecords": 5683,
    "duplicateRecords": 45,
    "pendingImportJobs": 0,
    "lastDataUpdate": "2026-09-22T14:30:00Z"
  }
}
```

#### `GET /api/admin/analytics`
- **Description**: Village-wise breakdown, category color charts, and import history trends.

---

### 2.4 Villages (`/api/villages`)

#### `GET /api/villages`
- **Description**: List all villages with voter counts and metadata.

#### `GET /api/villages/{id}`
- **Description**: Get village details and ward lists.

---

### 2.5 Members & Voters (`/api/members`)

#### `GET /api/members`
- **Description**: List voters for a village with server-side pagination.
- **Query Params**:
  - `village_id`: Village ObjectId (required for normal browsing)
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 50, max: 200)
  - `status`: `ACTIVE` (default) or `DECEASED` or `ALL`
  - `category_id`: Filter by category
  - `my_assigned_only`: Boolean flag

#### `GET /api/members/search`
- **Description**: Full-text bilingual search across Marathi and English names, membership numbers, and phone numbers.
- **Query Params**: `q` (query string), `village_id`, `page`, `limit`

#### `GET /api/members/{id}`
- **Description**: Get full member profile document including family and category.

#### `PUT /api/members/{id}`
- **Description**: Update permitted member fields (mobile, address, profession, etc.).
- **Audit**: Logs `UPDATE_MEMBER` action with user ID and previous values.

#### `PATCH /api/members/{id}/status`
- **Description**: Update member status (e.g. Mark as Deceased).
- **Request Body**:
```json
{
  "status": "DECEASED",
  "deceasedDate": "2026-09-22T00:00:00Z"
}
```

#### `PATCH /api/members/{id}/category`
- **Description**: Update category/color tag.
- **Request Body**:
```json
{
  "categoryId": "65fc1a89b4e12c001f89a050"
}
```

---

### 2.6 Family Management (`/api/members/{id}/family` & `/api/family`)

#### `GET /api/members/{id}/family`
- **Description**: Fetch all family members connected to this member's family unit.

#### `POST /api/members/{id}/family`
- **Description**: Add/link a new family member to the existing family unit.

#### `PUT /api/family/{id}`
- **Description**: Update family notes or head of family.

#### `DELETE /api/family/{id}`
- **Description**: Disassociate a member from a family unit.

---

### 2.7 Admin Import Pipeline (`/api/admin/import`)
*All endpoints strictly require `ADMIN` role. No user access.*

#### `POST /api/admin/import/pdf`
- **Description**: Upload single or multiple PDFs bound to a specific village. Initiates background parsing.
- **Form Data**:
  - `file`: PDF file (`multipart/form-data`)
  - `village_id`: Target village ObjectId (Required)
  - `auto_commit`: Boolean (optional, default: false)
- **Response `202 Accepted`**:
```json
{
  "success": true,
  "data": {
    "jobId": "65fc1a89b4e12c001f89a999",
    "status": "QUEUED",
    "fileName": "village_01.pdf",
    "villageId": "65fc1a89b4e12c001f89a001",
    "message": "PDF upload accepted. Async processing started."
  }
}
```

#### `POST /api/admin/import/excel`
- **Description**: Upload Excel (`.xlsx`, `.xls`) or `.csv` bound to a village.

#### `GET /api/admin/import/jobs/{jobId}`
- **Description**: Poll live progress of an import job (stages, percentage, status).

#### `GET /api/admin/import/jobs/{jobId}/preview`
- **Description**: Retrieve parsed rows preview, counts of valid/invalid/duplicates before commit.

#### `GET /api/admin/import/jobs/{jobId}/errors`
- **Description**: Download Excel workbook of invalid/rejected rows.

#### `GET /api/admin/import/jobs/{jobId}/excel`
- **Description**: Download generated bilingual Excel workbook produced from the PDF.

#### `POST /api/admin/import/jobs/{jobId}/confirm`
- **Description**: Commit previewed valid records to MongoDB.
- **Request Body**:
```json
{
  "duplicateStrategy": "SKIP" // "SKIP", "UPDATE", "KEEP_BOTH"
}
```

---

### 2.8 Factual Reports (`/api/reports`)

All reports return aggregated data from MongoDB without political inference.
- `GET /api/reports/family` - Grouped by family unit and head.
- `GET /api/reports/alphabetical` - Grouped by Marathi initial letter (A-Z).
- `GET /api/reports/surname` - Grouped by Marathi surname with member counts.
- `GET /api/reports/religion` - Factual count by religion.
- `GET /api/reports/caste` - Factual count by caste.
- `GET /api/reports/category` - Grouped by sponsor color category (Green, Yellow, Orange, Red).
- `GET /api/reports/village` - Breakdown by village.
- `GET /api/reports/deceased` - List of all deceased records with dates.

---

### 2.9 Data Synchronization (`/api/sync`)

#### `GET /api/sync/status`
- **Description**: Check current sync version and records updated since client's `lastSyncAt`.

#### `POST /api/sync`
- **Description**: Quick Sync - returns only delta changes (records created/updated since client timestamp).

#### `POST /api/sync/full`
- **Description**: Full Sync - returns complete dataset for client's authorized village.

---

### 2.10 In-App Activity & Audit (`/api/admin/users/{id}/activity`)

#### `GET /api/admin/users/{id}/activity`
- **Description**: Retrieve chronological timeline of in-app actions initiated by a specific user.
- **Events**: `LOGIN`, `LOGOUT`, `SEARCH`, `VIEW_MEMBER`, `UPDATE_MEMBER`, `CALL_INITIATED`, `SMS_INITIATED`, `WHATSAPP_OPENED`.
- **Privacy Assurance**: Excludes any device-level calls, SMS, contacts, or covert GPS coordinates.
