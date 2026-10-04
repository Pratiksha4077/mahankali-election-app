# Final System Architecture (FINAL_ARCHITECTURE.md)
**Project**: Mahankali Voters — Election & Voter Management System  
**Architecture Date**: 2026-09-22  
**Target Stack**: React Native (Expo + TypeScript) + Python FastAPI + MongoDB  

---

## 1. High-Level Architecture Diagram

```
                    ADMIN
                      │
                      ▼
             ┌─────────────────┐
             │  ADMIN PANEL    │
             │                 │
             │ User Management │
             │ Data Upload     │
             │ PDF → Excel     │
             │ Excel Import    │
             │ Analytics       │
             │ Import History  │
             └────────┬────────┘
                      │
                      ▼
               FASTAPI BACKEND
             (REST API + Async)
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
       MongoDB             PDF/Excel Engine
 (Primary Database)               │
          │                PDF → Data → Excel
          │
          ▼
     USER PANEL
          │
    ┌─────┼──────────┐
    ▼     ▼          ▼
 Search  Village   Reports
    │
    ▼
Voter/Member
    │
    ├── Details
    ├── Family
    ├── Category/Tag
    ├── Edit
    ├── Deceased
    └── Contact
```

---

## 2. Component Breakdown

### 2.1 Frontend Layer (React Native + Expo SDK 57 + TypeScript)
- **Framework**: React Native with Expo (supports Android APK, iOS, and React Native Web for cross-platform desktop admin access).
- **UI & Design System**: Custom theme tokens with rich dark navy glassmorphism (`theme.ts`), high-contrast accessible typography, and smooth micro-animations.
- **Navigation Architecture**:
  - `RootNavigator`: Top-level switcher based on authentication and active role.
  - `AdminNavigator`: Native stack + Drawer/Tabs dedicated strictly to Admin functions (Dashboard, User Management, Data Upload, PDF to Excel, Import Jobs, Audit Logs).
  - `UserNavigator`: Native bottom tabs + Stacks for authorized village voter browsing (Home, Search, Member Profile, Family, Reports, Settings/Sync).
  - **Security Rule**: The User Navigator **never mounts any upload components**.
- **State & Storage**:
  - `AuthContext`: Manages JWT tokens, session lifecycle, and role validation.
  - `SyncContext`: Controls delta vs full sync state, sync timestamps, and online/offline status.
  - `LanguageContext`: Seamless bilingual switching between Marathi (`mr`) and English (`en`).
  - `AsyncStorage`: Secure local persistence for user credentials, tokens, and offline delta caches.

### 2.2 API & Application Gateway Layer (Python FastAPI)
- **Runtime**: Python 3.13 + FastAPI + Uvicorn ASGI server.
- **Security & RBAC**:
  - OAuth2 Bearer token mechanism with PyJWT.
  - Role-Based Access Control (`require_admin` dependency for all administrative and upload endpoints; `get_current_user` for authenticated user operations).
  - Password hashing via `bcrypt` with salt rounds.
- **Validation**: Strict Pydantic V2 schemas for incoming request validation, sanitize inputs against injection, and format response models.
- **Background Processing**:
  - Asynchronous background worker (`BackgroundTasks`) for CPU-heavy tasks: PDF page extraction, Tesseract OCR fallback, duplicate detection, Excel file generation, and bulk MongoDB insertion.
  - Immediate response with `job_id` and non-blocking progress stage polling (`/api/admin/import/jobs/{jobId}`).

### 2.3 Data Storage Layer (MongoDB 8.x)
- **Primary Database**: MongoDB running locally on `mongodb://localhost:27017/election_db` (or configurable via `MONGODB_URI` environment variable).
- **Driver**: `motor` for non-blocking asynchronous FastAPI endpoints; `pymongo` for background worker batch processing and indexing.
- **Collections**:
  - `users`: Administrator and field worker accounts.
  - `villages`: Gram panchayat / ward boundaries and statistics.
  - `wards`: Sub-divisions and booth allocations.
  - `members`: Complete voter documents matching Section 21.
  - `families`: Household grouping records linking member documents.
  - `categories`: Sponsor-configured tags/colors (Green, Yellow, Orange, Red).
  - `import_jobs`: Job metadata, stage tracking (1 of 8), and error summaries.
  - `import_files`: Audit records of every PDF and Excel file uploaded per village.
  - `import_records`: Raw and parsed intermediate rows before database commit.
  - `audit_logs`: Detailed administrative and operational change trail.
  - `app_activities`: Strict in-app activity timeline for application users.
  - `sync_history`: Synchronization audit and delta tracking.

### 2.4 PDF & Excel Processing Engine
- **PyMuPDF (`fitz`)**: Fast, accurate layout and text block extraction for selectable Marathi PDFs.
- **pdfplumber**: Secondary tabular extraction for complex multi-line boxes and borderless tables.
- **OCR Engine (Tesseract + Pillow)**: Optical character recognition fallback for scanned, low-resolution, or image-only electoral roll pages with Marathi language pack (`mar`).
- **Data Parser (`TableParser`)**: High-performance multi-strategy parsing extracting Serial Number, Marathi Name, Surname, First Name, Father Name, Membership Number, Village, Mobile Number, and official ECI voter card boxes.
- **Field Mapper (`FieldMapper`)**: Dynamic, alias-driven mapper translating arbitrary header variations into normalized member document fields.
- **Duplicate Engine (`DuplicateDetector`)**: Configurable multi-tier deduplication (intra-batch + cross-database).
- **Excel Studio (`ExcelGenerator` & `ExcelReader`)**:
  - Automated generation of bilingual `.xlsx` workbooks from extracted PDF data.
  - Direct import and validation of user-provided Excel (`.xlsx`, `.xls`, `.csv`) files.

============================================================
MANDATORY PDF → EXCEL IMPLEMENTATION
============================================================

PDF → Excel is a REQUIRED WORKING FEATURE, not a placeholder.

The implementation must actually generate a valid .xlsx file from the uploaded PDF.

For every uploaded PDF:
1. Save the uploaded PDF.
2. Detect whether it contains selectable text or scanned images.
3. Extract table data.
4. Preserve Marathi Unicode characters.
5. Detect rows and columns.
6. Map extracted columns to the application's data model.
7. Validate each row.
8. Show an import preview.
9. Generate a real .xlsx file using pandas/openpyxl.
10. Make the generated Excel file downloadable from the React Native application.
11. Optionally import the validated records into MongoDB.

The generated Excel file must NOT be empty.

If extraction fails, the API must return an explicit error explaining why.

Do NOT show "processing completed" unless:
- records were actually extracted, AND
- an Excel file was successfully generated.

The import job must contain:
```json
{
    "job_id": "...",
    "status": "COMPLETED",
    "records_found": 123,
    "valid_records": 120,
    "invalid_records": 2,
    "duplicate_records": 1,
    "excel_file": "..."
}
```

If records_found = 0:
status must be FAILED or EXTRACTION_REVIEW_REQUIRED.

Never generate an empty Excel file and report the job as successful.

---

## 3. Data Flows

### 3.1 Admin Data Flow
```
1. Admin logs in with credentials -> Receives JWT with role=ADMIN.
2. Admin opens "Data Upload" screen -> Selects Target Village (e.g. Kavthe Mahankal).
3. Admin selects one or multiple PDF / Excel files.
4. FastAPI creates an `import_job` with status "QUEUED" and returns `job_id`.
5. Background worker initiates 8-stage pipeline:
   - File validation -> PDF/OCR extraction -> Normalization -> Parsing -> Mapping -> Duplicate Detection -> Excel Generation.
6. Admin monitors live stage progress (0% -> 100%) via polling.
7. Admin inspects Import Preview:
   - Total records, valid records, invalid records, duplicate candidates.
8. Admin resolves duplicates (Skip / Update / Merge / Keep Both) and clicks "Confirm Import".
9. Records are batch-inserted into MongoDB `members` with metadata (`village_id`, `import_job_id`, `uploaded_by`).
10. System updates analytics aggregations.
```

### 3.2 User Data Flow
```
1. User logs in with credentials -> Receives JWT with role=USER.
2. User opens User Home -> Authorized village data is displayed (e.g. 5,683 voters).
3. User performs search (Marathi / English transliteration) or applies filters.
4. Server returns paginated member results (50 items/page) using MongoDB text indexes.
5. User clicks Member Card -> Opens Voter Details.
6. User can perform permitted operations:
   - Update contact details or address (creates audit entry).
   - Add/view family members linked via `familyId`.
   - Update category tag (Green/Yellow/Orange/Red).
   - Mark as Deceased (triggers confirmation dialog, stores deceasedDate and user ID).
   - Initiate Contact: Click Call (opens dialer), SMS (opens SMS composer), WhatsApp (opens chat).
   - App logs in-app activity (`CALL_INITIATED`, `SMS_INITIATED`, `VIEW_MEMBER`).
7. User navigates to Reports -> Views factual aggregate reports (Family, Alphabetical, Surname, Village, etc.).
8. User navigates to Settings -> Performs Quick Sync (pulls updated records since `lastSyncAt`).
```

---

## 4. Privacy & Security Isolation

1. **Covert Surveillance Prohibition**:
   - The application **never** requests runtime permissions for Android Call Logs (`READ_CALL_LOG`) or SMS Inbox (`READ_SMS`).
   - The application **never** tracks background GPS location.
   - Only actions initiated **inside the app** via user interface button clicks are recorded as application activities (`CALL_INITIATED`, `SMS_INITIATED`, `WHATSAPP_OPENED`, `SEARCH`, `PROFILE_VIEWED`).
2. **Neutral Data Handling**:
   - Reports and categories represent factual organizational grouping only.
   - The system strictly prohibits automated algorithmic inference of political preferences or voting intentions based on religion, caste, family, or color tags.
3. **Environment Security**:
   - Secrets (`SECRET_KEY`, `MONGODB_URI`) are stored solely on the server in `.env` and never bundled into the mobile client code.
