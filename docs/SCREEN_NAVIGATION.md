# Screen Navigation Architecture (SCREEN_NAVIGATION.md)
**Project**: Mahankali Voters — Election & Voter Management System  
**Framework**: React Navigation (Native Stack + Bottom Tabs)  
**TypeScript**: Fully typed routes and parameter lists  

---

## 1. High-Level Navigation Hierarchy

```
                            [App.tsx]
                                │
                        [RootNavigator]
                                │
         ┌──────────────────────┴──────────────────────┐
         ▼                                             ▼
  [Unauthenticated]                             [Authenticated]
         │                                             │
   AuthNavigator                                Role Switcher
   (LoginScreen)                                       │
                         ┌─────────────────────────────┴─────────────────────────────┐
                         ▼                                                           ▼
                   [Role == ADMIN]                                             [Role == USER]
                   AdminNavigator                                              UserNavigator
                         │                                                           │
        ┌────────────────┴────────────────┐                         ┌────────────────┴────────────────┐
        ▼                                 ▼                         ▼                                 ▼
   Admin Tabs                        Admin Stacks               User Tabs                        User Stacks
- Dashboard                       - AddUserScreen           - Home (Voter List)               - MemberDetailsScreen
- UserManagement                  - EditUserScreen          - ReportsScreen                   - EditMemberScreen
- DataUpload                      - UserDetailsScreen       - UserSettingsScreen              - FamilyScreen
- ImportJobs                      - ImportPreviewScreen                                       - ReportDetailScreen
- AuditLogs                       - ActivityScreen                                            - VillageSelectModal
```

---

## 2. Navigators & Screen Details

### 2.1 Auth Navigator (`AuthNavigator.tsx`)
Handles user onboarding and session establishment.
- **`LoginScreen`**:
  - Username or 10-digit mobile number input.
  - Secure password field with Show/Hide toggle.
  - Submits credentials to `POST /api/auth/login`.
  - On success, saves JWT token in `AsyncStorage` and updates `AuthContext`.
  - Automatically redirects based on user role (`ADMIN` -> `AdminNavigator`, `USER` -> `UserNavigator`).

---

### 2.2 Admin Navigator (`AdminNavigator.tsx`)
A dedicated, isolated administrative portal. Application users with `USER` role can never access or render this navigator.

#### Admin Bottom Tabs:
1. **`AdminDashboardTab`** (`AdminDashboardScreen.tsx`):
   - Executive analytics: Total Voters, Active Members, Dead Records, App Users, Total Villages, Total Families, Pending Imports.
   - Live distribution charts (Village breakdown, Category color breakdown).
   - Quick action shortcuts to "Data Upload" and "User Management".
2. **`UserManagementTab`** (`UserManagementScreen.tsx`):
   - Filter chips: `All Users`, `Active Users`, `Disabled Users`.
   - User summary cards showing Name, Mobile, Role, Account Status, Last Login, and Last Activity.
   - Floating action button (+) leading to `AddUserScreen`.
   - Card action buttons: View Details, Edit User, Enable/Disable, Deactivate.
3. **`DataUploadTab`** (`DataUploadScreen.tsx`):
   - **Village Selector Dropdown**: Admin chooses target village *before* choosing files.
   - Upload Options: `Upload PDF` or `Upload Excel`.
   - Support for multiple PDFs and Excel files for a single village.
   - File picker with size and type validation.
   - Initiates background processing job and redirects to `ImportJobsScreen`.
4. **`ImportJobsTab`** (`ImportJobsScreen.tsx`):
   - Real-time list of current and past import jobs.
   - Live progress indicator (0-100%) across 8 stages.
   - Actions: View Preview, Download Generated Excel (`.xlsx`), Download Rejected Row Report.
5. **`AuditLogsTab`** (`AuditLogsScreen.tsx`):
   - Complete administrative audit trail with action filtering, timestamps, and user identifiers.

#### Admin Stack Screens:
- **`AddUserScreen`**: Dedicated form to create new application users with validation.
- **`EditUserScreen`**: Form to update user profile, password reset, and village assignments.
- **`UserDetailsScreen`**: Detailed user profile and application activity timeline (logins, searches, member views, dialer clicks).
- **`ImportPreviewScreen`**: Pre-commit validation screen showing total records, valid records, invalid records, duplicate candidates, and resolution options (Skip / Update / Merge / Keep Both).

---

### 2.3 User Navigator (`UserNavigator.tsx`)
The primary browsing and field-operation interface for authorized village data.

#### User Bottom Tabs:
1. **`HomeTab`** (`UserHomeScreen.tsx`):
   - Header with application brand, active village name, and quick notification badge.
   - **Bilingual Search Bar**: Instant debounced search for Marathi and English queries.
   - **Village Selector**: Village switcher allowing the user to select their assigned village.
   - Filter tabs: `All Voters` vs `My Assigned Voters`.
   - **Voter List**: FlatList with lazy loading, server-side pagination, and pull-to-refresh.
   - **Voter Card**: Shows serial number, booth badge, Marathi full name, relative name, house number, category tag, and quick dialer shortcut.
2. **`ReportsTab`** (`ReportsScreen.tsx`):
   - 12 Factual Report Tiles:
     1. Family-wise
     2. Alphabetical (A-Z)
     3. Surname-wise
     4. Village-wise
     5. Category/Color-wise
     6. Deceased Records
     7. Mobile Status
     8. Membership Number-wise
     9. Religion-wise
     10. Caste-wise
     11. Designation-wise
     12. Profession-wise
   - Navigates to `ReportDetailScreen` with interactive filtering and factual breakdowns.
3. **`SettingsTab`** (`UserSettingsScreen.tsx`):
   - **Strictly contains ONLY User Preferences**:
     - User Profile Card (Name, Username, Mobile, Role).
     - Quick Sync & Full Sync controls with last synced timestamp.
     - Language Switcher (मराठी / English).
     - Push Notification toggles.
     - About Application & Version Info.
     - Logout button.
   - **CRITICAL RESTRICTION**: Absolutely **NO** PDF Upload, Excel Upload, CSV Upload, Data Mapping, or Import Settings appear on this screen.

#### User Stack Screens:
- **`MemberDetailsScreen`**:
  - Comprehensive view of voter information (Name, Marathi Name, Relative, House No, Age, Gender, Mobile, Address, Religion, Caste, Designation, Profession).
  - Sponsor-defined Category Tag picker (Green, Yellow, Orange, Red).
  - "Mark as Deceased" switch with confirmation modal.
  - Interactive Action Bar: Direct Call, SMS Composer, WhatsApp Chat, Print/Share.
- **`EditMemberScreen`**: Editable form for updating contact information and demographics.
- **`FamilyScreen`**: View connected family members and add new family members linked to the member's `familyId`.
- **`ReportDetailScreen`**: Detailed paginated records matching the selected report classification.

---

## 3. Strict Upload Quarantine Verification

| Screen / Component | Present in Admin Navigator? | Present in User Navigator? | Compliance Status |
|---|---|---|---|
| `DataUploadScreen` (PDF/Excel) | ✅ YES | ❌ NO (Blocked) | Compliant |
| `PdfToExcelScreen` | ✅ YES | ❌ NO (Blocked) | Compliant |
| `ExcelUploadScreen` | ✅ YES (Relocated to Admin) | ❌ NO (Removed) | Compliant |
| `ImportJobsScreen` | ✅ YES | ❌ NO (Blocked) | Compliant |
| `ImportPreviewScreen` | ✅ YES | ❌ NO (Blocked) | Compliant |
| `UserSettingsScreen` | N/A | ✅ YES (Cleaned: preferences only) | Compliant |
