# Mahankali Voters — Election & Voter Management System
*(महांकाली बचाव समिती - मतदार व सभासद व्यवस्थापन प्रणाली २०२६)*

A production-grade, full-stack electoral management solution built with a **React Native (Expo + TypeScript + Web)** frontend and a **Python FastAPI (SQLAlchemy + SQLite/PostgreSQL)** backend. It features an automated Marathi electoral roll PDF extraction pipeline, OCR fallback, bilingual Excel processing, dual Admin and User panels, and data synchronization.

---

## 🏛️ System Architecture

```
                       React Native (Expo + Web)
                             MOBILE / WEB
                                  │
                                  │ HTTPS REST API
                                  ▼
                         Python FastAPI Backend
                      Authentication & API Gateway
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
  PostgreSQL / SQLite       PDF Engine (PyMuPDF)       Excel Engine
  SQLAlchemy Repository     + Marathi OCR Fallback     Pandas / openpyxl
        │                         │                         │
        │                         ▼                         │
        │                   Extract Data                    │
        │                         │                         │
        │                         ▼                         │
        │                    PDF → Excel ◄──────────────────┘
        ▼
   Reports & Search
```

---

## 🚀 Key Features

### 1. 🛡️ Two Main Panels
- **User Panel**:
  - **Home Screen**: Instant debounced search (English & Marathi transliteration), village filter chips (*साखराळे, अग्रण धुळगांव, अथणी, अनंतपूर, कवठे महांकाळ*), "All Voters" vs "My Assigned Voters" tabs, and voter cards showing Part/Booth badge (e.g. `B-299 / #301`), full name, relative, village, call shortcut, and category tag.
  - **Voter Profile**: WhatsApp, SMS, Direct Call, Print/Share deep links; 5-color voter tag picker (Green, Light Green, Yellow, Orange, Red); "Mark as Deceased (Dead)" switch; inline editable phone, address, and demographics; connected team and family members list; responsive update toast feedback.
  - **12 Reports Dashboard**: Alphabetical (A-Z with letter bar), Membership Number, By Family, By Surname, By Mobile Status, By Religion, By Caste, By Designation, By Profession, By Color Rating, By Village, and Deceased.
  - **Data Management (Sync)**: Quick incremental sync, full re-sync download, user profile card, and language switcher.
- **Admin Panel**:
  - **Dashboard**: High-level KPI cards (Total Users, Active/Disabled, Total Villages, Total Voters, Deceased, Duplicates Filtered), interactive Village and Category distribution charts, and real-time activity feed.
  - **User Management**: Filter by All vs Disabled; user cards with Call & SMS / In-App activity history link, Edit, Disable/Enable, Delete actions; floating action button (+) with Add User modal.
  - **User Activity History**: Timeline of user operations (logins, searches, profile views, contact triggers, sync events).
  - **PDF to Excel Studio**: Dedicated file upload, live 8-stage progress tracker (0-100%), summary metrics (Valid, Invalid, Duplicates, Imported), data preview modal, bilingual Excel download (`.xlsx`), and database commit.
  - **Excel Import Studio**: Upload `.xlsx` or `.csv`, preview matched columns, detect duplicates, download rejected error Excel, and commit to DB.
  - **Audit Logs**: Filterable audit trail of administrative and operational actions.

### 2. 📄 Mandatory Marathi Electoral Roll PDF → Excel Pipeline
- **Module Architecture**:
  - `detector.py`: Detects whether PDF contains selectable text or scanned images.
  - `extractor.py`: Extracts raw text, blocks, words with coordinates using PyMuPDF (`fitz`) and `pdfplumber`.
  - `ocr.py`: OCR fallback for scanned PDFs using Marathi (`mar`) & English models.
  - `table_parser.py`: Multi-strategy parsing for 8-column voter lists (`Sr No`, `Full Name Marathi`, `Surname`, `First Name`, `Father Name`, `Membership Number`, `Village`, `Mobile Number`) and standard ECI voter card boxes.
  - `marathi_normalizer.py`: Full Marathi Unicode normalization, non-breaking space cleaning, Devanagari numerals conversion, and name part parsing.
  - `mapper.py`: Configurable column mapper standardizing dynamic headers into canonical models.
  - `validator.py`: Comprehensive row validation ensuring voter records meet electoral standards.
  - `duplicate_detector.py`: Intra-batch and cross-database duplicate detector.
  - `excel_generator.py`: Generates real, non-empty, beautifully styled bilingual `.xlsx` workbooks with summary sheets using openpyxl & pandas.
  - `pipeline.py`: Orchestrates the complete pipeline with strict error checking (if records_found = 0, status is FAILED; never generates empty Excel).

============================================================
MANDATORY PDF → EXCEL IMPLEMENTATION
============================================================
PDF → Excel is a REQUIRED WORKING FEATURE, not a placeholder.
- Upload PDF → Detect PDF → Extract rows → Map columns → Validate data → Generate .xlsx → Download Excel / MongoDB
- React Native frontend triggers upload, monitors progress, receives `job_id`, checks status, displays "Excel Ready", previews rows, and downloads `.xlsx`.
- Python FastAPI backend handles all file extraction and Excel generation.
- The generated Excel file must NOT be empty. If records_found = 0, status is FAILED or EXTRACTION_REVIEW_REQUIRED.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Mobile Frontend** | React Native, Expo SDK 57, TypeScript, React Navigation (Native Stack & Bottom Tabs), Safe Area Context |
| **Web Frontend** | React Native Web, React DOM (responsive across mobile, tablet, desktop) |
| **Backend Framework** | Python 3.13, FastAPI, Pydantic V2, Pydantic Settings |
| **Primary Database** | **MongoDB 8.x** (via `motor` async client & `pymongo`), Compound & Text Indexes |
| **PDF Processing** | PyMuPDF (`fitz`), pdfplumber, Pillow, Marathi OCR Engine |
| **Excel / CSV** | Pandas, openpyxl, xlsxwriter |
| **Security & Auth** | JWT (`PyJWT`), native `bcrypt` password hashing, OAuth2 Bearer RBAC |

---

## 📦 Project Structure

```
Election app/
├── backend/
│   ├── app/
│   │   ├── api/                  # REST endpoints (auth, admin_dashboard, admin_users, members, family, villages, reports, import, sync)
│   │   ├── auth/                 # JWT security, bcrypt hashing, dependencies
│   │   ├── config/               # Settings & MongoDB configuration
│   │   ├── database/             # MongoDB Motor async & PyMongo sync connection, auto-indexing, seed script
│   │   ├── excel_processing/     # Reader, validator, importer, exporter
│   │   ├── models/               # MongoDB BSON schemas & Pydantic models (Section 21)
│   │   ├── pdf_processing/       # detector, extractor, ocr, table_parser, marathi_normalizer, mapper, validator, duplicate_detector, excel_generator, pipeline
│   │   ├── services/             # Mongo member, user, report, duplicate detector business logic
│   │   └── main.py               # FastAPI entrypoint, lifespan events, CORS
│   ├── tests/                    # Pytest test suite (unit/integration & PDF to Excel tests)
│   ├── uploads/                  # Temporary file upload staging
│   ├── processed/                # Generated bilingual Excel workbooks
│   └── requirements.txt          # Python dependencies
│
└── frontend/
    ├── src/
    │   ├── api/                  # Axios client, endpoints for members, family, admin upload, import jobs
    │   ├── components/           # Header, SearchBar, VillageChips, VoterCard, Toast
    │   ├── context/              # AuthContext, LanguageContext, SyncContext
    │   ├── localization/         # Marathi & English bilingual dictionaries
    │   ├── models/               # TypeScript interfaces & types
    │   ├── navigation/           # RootNavigator (strict admin/user role segregation)
    │   ├── screens/
    │   │   ├── admin/            # AdminDashboard, DataUpload, ImportJobs, UserDetails, UserManagement, UserActivity, PdfToExcel, AuditLogs
    │   │   ├── auth/             # LoginScreen
    │   │   └── user/             # UserHomeScreen, VoterProfileScreen, ReportsScreen, ReportDetailScreen, SettingsSyncScreen
    │   └── theme/                # Dark navy theme tokens, typography, colors
    ├── App.tsx                   # App root provider wrapper
    └── package.json              # NPM dependencies & scripts
```

---

## ⚡ Quick Start Guide

### Step 1: Ensure MongoDB 8.x is Running
Make sure MongoDB is installed and running on `localhost:27017` (default MongoDB service):
```powershell
# Check MongoDB Windows service status
Get-Service -Name "*Mongo*"

# If stopped, start it with:
Start-Service MongoDB
```

---

### Step 2: Start the Python FastAPI Backend

Open a terminal in the `backend` folder:
```powershell
cd "d:\Election app\backend"

# (Optional) Seed the MongoDB database with initial admin, user, villages, and sample voters:
python -m app.database.seed_mongo

# Run test suite to verify all 14 tests pass:
python -m pytest -v

# Start the FastAPI server on port 8000:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- **Interactive Swagger Docs**: Open [http://localhost:8000/docs](http://localhost:8000/docs)
- **Default Admin Login**: Username: `admin` | Password: `admin123`
- **Default Field User Login**: Username: `rupesh_sir` | Password: `user123`

---

### Step 3: Start the React Native / Expo Frontend

Open a second terminal in the `frontend` folder:
```powershell
cd "d:\Election app\frontend"

# Run in Web browser mode (Recommended for instant testing):
npm run web
# OR:
npx expo start --web

# For Mobile / Expo Go on phone:
npx expo start
```
- **Web App**: Automatically opens at [http://localhost:8081](http://localhost:8081)
- **Mobile App**: Scan the terminal QR code using the **Expo Go** app on Android/iOS.

---

### Step 4: 📱 Connect Mobile APK to Backend

1. **Keep Backend Running on `0.0.0.0`**:
   The backend MUST run with `--host 0.0.0.0 --port 8000`:
   ```powershell
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   # Or simply double click: start_backend.bat
   ```
2. **Find Your PC's Wi-Fi IP Address**:
   Run `ipconfig` in PowerShell and find your IPv4 Address (e.g. `10.58.203.93`).
3. **Change / Verify Server Address in Mobile App**:
   On the mobile login screen, tap the **"सर्व्हर" (Server)** button in the top right:
   - Enter your PC's IP address: `http://10.58.203.93:8000/api`
   - Tap **"कनेक्शन तपासा" (Test Connection)** to confirm
   - Tap **"सेव्ह करा" (Save)**
   - Now login with Username: `admin` | Password: `admin123`!

---

### Step 5: 📦 Build Android Standalone APK File

To generate the standalone `.apk` installer file for mobile phones:

```powershell
cd "d:\Election app\frontend"

# Build APK using EAS:
npx eas-cli build -p android --profile preview
```
*Note: Or simply double click [build_apk.bat](file:///d:/Election%20app/build_apk.bat) in the project root.*
Once the build completes, EAS provides a direct download link for your `.apk` file to install directly onto any Android phone.

---

## 🧪 Testing Summary

Run the automated test suite:
```powershell
cd "d:\Election app\backend"
python -m pytest -v
```
**Results: 14/14 tests passing** covering authentication, village listings, member search, MongoDB report pipelines, admin KPI calculations, user management, family member routes, and Marathi electoral roll regex parsers.

