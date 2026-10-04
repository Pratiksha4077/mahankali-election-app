# Feature Gap Analysis (FEATURE_GAP_ANALYSIS.md)
**Project**: Mahankali Voters — Election & Voter Management System  
**Evaluation Date**: 2026-09-22  
**Baseline**: Built-in React Native + FastAPI SQLite/PostgreSQL Prototype  
**Target Specification**: Master Development Prompt — React Native + FastAPI + MongoDB  

---

## 1. Executive Summary

This document identifies all architectural, functional, and structural gaps between the current built-in codebase and the requirements set forth in the Master Development Prompt. 

Each feature is evaluated across five mandatory dimensions:
1. **Existing Feature**
2. **Current APK / Built-in App Status**
3. **Required Behavior**
4. **Missing / Broken Feature**
5. **New Implementation Strategy**

---

## 2. Comprehensive Feature Gap Matrix

| # | Feature Area | Existing Feature | Current Status | Required Behavior | Missing / Broken Aspects | New Implementation Strategy |
|---|---|---|---|---|---|---|
| **1** | **Primary Database** | Relational DB via SQLAlchemy (SQLite & PostgreSQL) | Functional for relational tables; stores data in `election_app.db` | **MongoDB** is the primary production database. PostgreSQL/SQLite prohibited for production. | Missing Motor async driver, MongoDB collections, BSON schemas, MongoDB indexes. | Replace SQLAlchemy repository with `motor` (async) & `pymongo`. Create MongoDB collections (`members`, `users`, `villages`, etc.) and database initialization scripts. |
| **2** | **Panel Segregation & Upload Quarantine** | User Panel contains `ExcelUploadScreen` linked from `SettingsSyncScreen` | User can access Excel upload from settings; violates role separation | **NO UPLOAD IN USER PANEL**. Only Admin can upload PDF/Excel/CSV or configure mappings. | User settings has "Upload Excel" card. Security boundary leakage between Admin and User. | Remove `ExcelUploadScreen` from User navigation and `SettingsSyncScreen`. Restrict all import/upload endpoints to `require_admin`. |
| **3** | **Village-to-Multi-File Binding** | Single file uploaded per import without village pre-selection | File uploaded, parser extracts village from text header | Admin must select/confirm Village **before** upload. Multiple PDFs & Excel files must link to **one village**. | No village dropdown prior to file selection. No source file metadata (`source_file`, `source_type`, `village_id`, `import_job_id`). | Build Village Selector in Admin Data Upload. Attach `village_id`, `import_job_id`, `uploaded_by`, and `source` metadata to all imported records. |
| **4** | **PDF to Excel Studio** | Basic PDF to Excel screen with synchronous/semi-async conversion | UI shows 8 stages, but processing tightly coupled to SQLAlchemy | Admin selects PDF -> select village -> background job -> preview -> validate -> download Excel -> optional DB import. | Excel download requires completed job; lacks configurable column mapper preview and detached Excel export. | Implement dedicated `/api/admin/import/pdf` returning `job_id`. Provide dedicated `/api/admin/import/jobs/{jobId}/excel` streaming endpoint. |
| **5** | **Configurable Duplicate Detection** | Binary duplicate check on EPIC number | Duplicates are rejected or counted without resolution options | Configurable detection: EPIC, Membership ID + Village, Name + Village. Admin decides: Skip, Update, Merge, Keep Both. | No UI to resolve duplicates. No side-by-side comparison of Existing vs New record. | Implement `DuplicateDetector` service with configurable rules. Add Duplicate Resolution modal in Admin Import Preview. |
| **6** | **User Management & In-App Activity** | User list, Add User modal, simple activity list | Basic table in SQLite; activity logs mixed with general audit | Admin creates multiple application users. Tracks strictly in-app activity (`LOGIN`, `SEARCH`, `VIEW_MEMBER`, `CALL_INITIATED`). | No separate `UserDetailsScreen` showing full user activity timeline. No distinction between in-app vs device logs. | Implement dedicated `UserDetailsScreen` with in-app activity timeline. Add endpoints `/api/admin/users/{id}` and `/api/admin/users/{id}/activity`. |
| **7** | **Privacy & Device Surveillance Safeguards** | Placeholder for call/SMS logs | Log entries exist, but no strict privacy isolation policy | **Strictly NO covert surveillance**. Track only actions initiated inside this app (`CALL_INITIATED`, `SMS_INITIATED`). | Potential ambiguity regarding phone/SMS access permissions. | Enforce privacy policy: Log only when user clicks dialer/SMS buttons inside the app. Never request Android Call Log or SMS read permissions. |
| **8** | **Member Document Structure** | Flat SQL `Member` table with relational foreign keys | Relational columns: `id`, `full_name_mr`, `epic_number`, `village_id` | Rich nested MongoDB BSON document matching Section 21 (`name`, `nameMarathi`, `village`, `category`, `source`). | Flat structure lacks nested objects; limited support for dynamic or custom fields. | Implement Section 21 MongoDB schema with nested sub-documents in `app/models/member.py` and Pydantic validation schemas. |
| **9** | **Family Management** | `Family` SQL table with basic foreign key | Shows head of family name; no interactive management | Profile allows viewing, adding, and linking family members with relationships without inventing unapproved data. | No "Add Family Member" modal or workflow in `VoterProfileScreen`. No dedicated family API endpoints. | Build `/api/members/{id}/family` endpoints (GET, POST, PUT, DELETE). Add interactive Family section in `VoterProfileScreen`. |
| **10** | **Tagging & Color Categories** | 5 color buttons in Voter Profile | Hardcoded color circles in frontend; static SQL `Category` | Configurable sponsor-defined categories/colors (Green, Yellow, Orange, Red). Strict factual use without political bias. | Colors hardcoded in frontend; category change history not audited. | Fetch categories from `/api/categories` backed by MongoDB. Log every category change in `audit_logs`. |
| **11** | **Deceased Member Workflow** | Switch toggle in profile; marks `status = DECEASED` | Updates status in SQL; doesn't prompt for confirmation | User with permission marks "Mark as Deceased". Confirms action, stores `deceasedDate`, `updatedBy`, excludes from active counts. | Lacks confirmation alert dialog before marking deceased. Dashboard does not dynamically exclude deceased from active counts. | Add confirmation alert in `VoterProfileScreen`. Update MongoDB aggregation pipeline to track `active` vs `deceased` accurately. |
| **12** | **Bilingual Search & Filtering** | Debounced search with frontend and backend filtering | Filter queries SQL `Member` with `ilike` on full name | High-performance search on English, Marathi, Surname, First Name, Membership No, Village, Mobile. | SQL `LIKE` queries slow on large datasets; lacks full-text indexing for Devanagari script. | Create compound text indexes in MongoDB: `{ "nameMarathi.full": "text", "membershipNumber": "text", "mobileNumber": "text" }`. |
| **13** | **Reports & Aggregate Analytics** | 12 report categories listed in frontend | SQL group-by queries on static columns | Reports dynamically aggregated from MongoDB data (Family, Alphabetical, Surname, Religion, Caste, Category, Village, Deceased). | Missing export options (CSV/Excel) from individual reports; some aggregations lack pagination. | Implement MongoDB aggregation pipelines for all 12 reports with pagination and Excel download endpoints. |
| **14** | **Data Synchronization & Offline Support** | Quick Sync & Full Sync buttons in settings | Mock sync triggers updating local AsyncStorage timestamp | Quick sync (changed records only) and Full sync (reconcile all records) with offline indicators (Online, Offline, Syncing). | Sync does not synchronize delta records into local cache; lacks offline SQLite/AsyncStorage storage. | Implement delta synchronization API (`/api/sync` and `/api/sync/full`) with version timestamps (`lastSyncAt`, `syncVersion`). |

---

## 3. Immediate Action Plan

1. **Step 1**: Finalize architectural designs and schema definitions in `FINAL_ARCHITECTURE.md`, `MONGODB_SCHEMA.md`, `API_SPECIFICATION.md`, and `SCREEN_NAVIGATION.md`.
2. **Step 2**: Remove `ExcelUploadScreen` from User panel navigation; ensure User settings contains only user preferences.
3. **Step 3**: Introduce MongoDB connection layer (`app/database/mongodb.py`) using `motor` and `pymongo`.
4. **Step 4**: Refactor API endpoints to read and write to MongoDB collections.
5. **Step 5**: Upgrade Admin Data Upload to support Village pre-selection and multi-file tracking.
6. **Step 6**: Implement family management endpoints and UI modals.
