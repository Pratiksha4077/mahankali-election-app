# Data Format Analysis (DATA_FORMAT_ANALYSIS.md)
**Project**: Mahankali Voters — Election & Voter Management System  
**Analysis Date**: 2026-09-22  
**Source Inputs**: Provided Sample Member/Voter Reference (PDF 1) & Official Maharashtra Electoral Roll 2026 (PDF 2)

---

## 1. Executive Summary

A core requirement of the application is processing, normalizing, mapping, and preserving authentic Marathi voter and membership data without corruption or loss of fidelity. This document details the exact structure of:
1. **The Member / Voter Data Format** (8 tabular columns with Marathi names and alphanumeric membership numbers).
2. **The Official Maharashtra Electoral Roll Format** (33-page standard voter roll with assembly/booth headers and 30-box-per-page voter cards).
3. **Data mapping rules**, Marathi Unicode preservation, duplicate detection criteria, and manual enrichment requirements.

---

## 2. Source Format 1: Member / Voter Data Table

This format represents organized member lists provided as PDFs or Excel/CSV spreadsheets.

### 2.1 Column Specification

| Column Index | Field Name (Marathi) | Field Name (English) | Sample Value | Data Type | Nullable | MongoDB Destination |
|---|---|---|---|---|---|---|
| 1 | Sr no | Serial Number | `1`, `2`, `10` | Integer | No | `members.serialNumber` |
| 2 | Full Name Marathi | Full Name (Marathi) | `पोक्षे दिगंबर कृष्णा` | String (Unicode) | No | `members.nameMarathi.full` |
| 3 | Surname Marathi | Surname (Marathi) | `पोक्षे`, `सनदे`, `शेटे` | String (Unicode) | Yes | `members.nameMarathi.surname` |
| 4 | First Name Marathi | First Name (Marathi) | `दिगंबर`, `दस्तगीर`, `किरण` | String (Unicode) | Yes | `members.nameMarathi.first` |
| 5 | Father Name Marathi | Father Name (Marathi) | `कृष्णा`, `जंगलू`, `राजाराम` | String (Unicode) | Yes | `members.nameMarathi.fatherName` |
| 6 | Membership Number | Membership Number | `B-1`, `B-2`, `B-10` | String (Alphanumeric) | No | `members.membershipNumber` |
| 7 | Village Marathi | Village (Marathi) | `अग्रण धुळगांव`, `कवठेमहांकाळ` | String (Unicode) | No | `members.village.nameMarathi` |
| 8 | Mobile Number | Mobile Number | *(Blank in sample; enriched later)* | String (10 Digits) | Yes | `members.mobileNumber` |

### 2.2 Format Characteristics & Sample Records
```
1  | पोक्षे दिगंबर कृष्णा     | पोक्षे    | दिगंबर    | कृष्णा    | B-1  | अग्रण धुळगांव  | [Blank]
2  | सनदे दस्तगीर जंगलू     | सनदे     | दस्तगीर  | जंगलू    | B-2  | कवठेमहांकाळ    | [Blank]
3  | कोठावळे किरण राजाराम   | कोठावळे  | किरण    | राजाराम  | B-3  | कवठेमहांकाळ    | [Blank]
4  | शेटे शशिकांत शिवाप्पा    | शेटे     | शशिकांत  | शिवाप्पा  | B-4  | कवठेमहांकाळ    | [Blank]
5  | शेटे सुभाष शिवाप्पा     | शेटे     | सुभाष    | शिवाप्पा  | B-5  | कवठेमहांकाळ    | [Blank]
6  | मुजावर साहेबलाल बापू   | मुजावर   | साहेबलाल | बापू     | B-6  | कवठेमहांकाळ    | [Blank]
7  | मोहनानी पी. एस.         | मोहनानी  | पी.     | एस.      | B-7  | कवठेमहांकाळ    | [Blank]
8  | सनदे अजिज जंगलू        | सनदे     | अजिज    | जंगलू    | B-8  | कवठेमहांकाळ    | [Blank]
9  | चौगुले शिवाजी बापू     | चौगुले   | शिवाजी   | बापू     | B-9  | कवठेमहांकाळ    | [Blank]
10 | शेख ईस्माइल महंमद       | शेख     | ईस्माइल  | महंमद    | B-10 | कवठेमहांकाळ    | [Blank]
```

### 2.3 Critical Observations
- **Membership Number Format**: Typically prefixed with a section or booth letter and serial number (e.g., `B-1`, `B-299`, `M-104`). This is a primary candidate for unique indexing within a village.
- **Marathi Names Decomposition**: The format explicitly separates Surname, First Name, and Father's Name from the Full Name. This enables exact surname grouping and alphabetical sorting in Marathi.
- **Village Association**: Multiple villages are represented (`अग्रण धुळगांव`, `कवठेमहांकाळ`). In Excel imports, each row may specify a village name, which the backend must map to an existing `village_id` or prompt the Admin for confirmation.

---

## 3. Source Format 2: Maharashtra State Election Commission Electoral Roll (2026)

This represents the official 33-page PDF electoral roll (*मतदार यादी २०२६*).

### 3.1 Document Metadata (Header & Polling Station)
- **State**: Maharashtra (S13)
- **Revision Year**: 2026 (पुनरीक्षणाचे वर्ष : २०२६)
- **Qualifying Date**: 01-10-2026 (अर्हता दिनांक : ०१-१०-२०२६)
- **Assembly Constituency (विधानसभा)**: `283 - इस्लामपूर (सर्वसाधारण)`
- **Lok Sabha Constituency (लोकसभा)**: `48 - हातकणंगले (सर्वसाधारण)`
- **List Part Number (यादी भाग क्रमांक)**: `61`
- **Village (मूळ गाव / नगर)**: `साखराळे`
- **Taluka**: `वाळवा` | **District**: `सांगली` | **PIN Code**: `415414`
- **Polling Station**: `61 - साखराळे`, केंद्रीय प्राथमिक शाळा, पश्चिमेकडील नविन इमारत पूर्वाभिमुखी उत्तरेकडून खोली नं २, साखराळे
- **Total Electors Breakdown**:
  - Male (पुरुष): `450`
  - Female (महिला): `394`
  - Third Gender (तृतीय पंथी): `0`
  - Total Electors (एकूण मतदार): `844`
- **Ward / Sections (विभाग क्रमांक व नाव)**:
  1. बिरोबा देवालय ते सोसायटी मराठी शाळा या मधील भाग साखराळे
  2. हरिजन वाडा व मांगवाडा साखराळे
  3. भजनी मंडपा जवळील भाग साखराळे
  4. जंगमघराजवळील भाग साखराळे
  5. सोसायटीचे मागील भाग साखराळे
  6. नवीन कारखाना कॉलनी साखराळे

### 3.2 Voter Card Box Structure (Grid 3 x 10 = 30 per page)

Each individual voter box contains:

```
+-------------------------------------------------------------+
|  1                                             XTX7438468   |  <-- Sr No & EPIC
|-------------------------------------------------------------|
| नाव: रफिक जहांगीर बारगीर                                    |  <-- Full Name
| वडिलांचे नाव: जहांगीर बारगीर                                |  <-- Relative Relation & Name
| घर क्रमांक: -                                               |  <-- House Number
| वय: 53  लिंग: पुरुष                          [छायाचित्र     |  <-- Age & Gender
|                                               उपलब्ध]       |  <-- Photo Available
+-------------------------------------------------------------+
```

### 3.3 Field Extraction Patterns

| Field | Marathi Pattern / Regex | Sample Extracted Value | Normalized Target |
|---|---|---|---|
| **Serial No** | `^\s*([0-9०-९]+)\s*` (top left) | `1`, `357`, `844` | `serialNumber: 1` |
| **EPIC No** | `([A-Z]{3}[0-9]{7}\|[A-Z]{2}[0-9]{7,8})` | `XTX7438468`, `LBY1293554` | `epicNumber: "XTX7438468"` |
| **Full Name** | `नाव\s*[:\-]\s*([^\n\r]+)` | `रफिक जहांगीर बारगीर` | `nameMarathi.full` |
| **Relation Type** | `(वडिलांचे\|पतीचे\|आईचे\|इतर)\s*नाव` | `वडिलांचे` -> Father, `पतीचे` -> Husband | `relationType: "Father"` |
| **Relative Name** | `(?:नाव)\s*[:\-]\s*([^\n\r]+)` | `जहांगीर बारगीर` | `nameMarathi.fatherName` |
| **House No** | `घर\s*क्रमांक\s*[:\-]\s*([^\n\r]+)` | `-`, `४०१`, `५०३-१` | `houseNumber: "401"` |
| **Age** | `वय\s*[:\-]\s*([0-9०-९]+)` | `53`, `२८` | `age: 53` |
| **Gender** | `लिंग\s*[:\-]?\s*(पुरुष\|महिला\|तृतीय पंथी)` | `पुरुष` -> Male, `महिला` -> Female | `gender: "Male"` |

---

## 4. Unicode & Marathi Text Preservation Rules

1. **UTF-8 Encoding Everywhere**: MongoDB collections, FastAPI request/response payloads, and Python strings must strictly enforce UTF-8.
2. **No Lossy Conversions**: Marathi characters must never be stripped, ASCII-transliterated destructively, or subjected to Latin-1 encoding errors (`?` or `Ã¤` mojibake).
3. **Marathi Numeral Normalization**:
   - Marathi digits (`०`, `१`, `२`, `३`, `४`, `५`, `६`, `७`, `८`, `९`) must be converted to Arabic digits (`0`-`9`) for numerical calculations (age, serial number, part number) while preserving the original representation where appropriate.
4. **Bilingual Search Support**:
   - Backend search must query both `nameMarathi.full` and English transliteration / phonetic tokens.
   - Example: Searching "Patil" matches records with Marathi surname "पाटील".

---

## 5. Duplicate Identification Strategy

Duplicate records can occur across multiple uploads for the same village. The system implements a **configurable, multi-tier duplicate detection engine**:

| Priority | Detection Rule | Match Criteria | Resolution Option |
|---|---|---|---|
| **Tier 1 (Highest)** | Exact EPIC Match | `epicNumber == incoming.epicNumber` | Prompt: Skip / Update / Keep Both |
| **Tier 2** | Membership ID + Village | `membershipNumber == incoming.membershipNumber AND village.id == incoming.village.id` | Prompt: Skip / Update / Merge |
| **Tier 3** | Full Name + Relative Name + Village | `nameMarathi.full == incoming.nameMarathi.full AND relative == incoming.relative AND village.id == incoming.village.id` | Flag as "Probable Duplicate" for Admin confirmation |
| **Tier 4** | Mobile Number Match | `mobileNumber == incoming.mobileNumber AND mobileNumber != ""` | Flag for review (family members may share a phone) |

---

## 6. Fields Requiring Enrichment

The source voter rolls lack certain operational fields required for electoral and organizational management. These fields must be populated through the application:
1. **Mobile Number**: Missing from official voter PDFs (enrichable via Voter Profile edit or Excel batch upload).
2. **Category / Color Tag**: Sponsor-defined prioritization tags (Green, Yellow, Orange, Red).
3. **Family Unit Association**: Linking members sharing a household or surname to a common `familyId`.
4. **Demographics**: Profession, designation, religion, caste (optional factual tags added per approved requirements without political bias).
5. **Deceased Status**: Verification and marking of deceased voters with audit timestamps and user IDs.
