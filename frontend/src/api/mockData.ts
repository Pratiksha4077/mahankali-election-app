import { Member, Village, Category, User, DashboardStats } from "../models/types";

export const MOCK_USERS: User[] = [
  { id: "u-1", username: "admin", mobile: "9876543210", role: "ADMIN", is_active: true, created_at: "2026-09-01T10:00:00Z" },
  { id: "u-2", username: "rupesh_sir", mobile: "9172474077", role: "USER", is_active: true, created_at: "2026-09-02T11:30:00Z" },
  { id: "u-3", username: "siddharth_londhe", mobile: "7028511404", role: "USER", is_active: true, created_at: "2026-09-02T12:00:00Z" },
  { id: "u-4", username: "saurabh_kothawale", mobile: "7276809080", role: "USER", is_active: true, created_at: "2026-09-03T09:15:00Z" },
  { id: "u-5", username: "ravi_gadve", mobile: "7588238320", role: "USER", is_active: true, created_at: "2026-09-03T14:40:00Z" },
  { id: "u-6", username: "omkar", mobile: "7756850199", role: "USER", is_active: true, created_at: "2026-09-04T16:20:00Z" },
];

export const MOCK_CATEGORIES: Category[] = [
  { id: "c-1", code: "CAT_GREEN", label_en: "Strong Supporter", label_mr: "पक्के समर्थक", color_hex: "#10B981", is_active: true },
  { id: "c-2", code: "CAT_LIGHT_GREEN", label_en: "Leaning Supporter", label_mr: "अनुकूल मतदार", color_hex: "#84CC16", is_active: true },
  { id: "c-3", code: "CAT_YELLOW", label_en: "Neutral / Undecided", label_mr: "तटस्थ / अनिर्णित", color_hex: "#F59E0B", is_active: true },
  { id: "c-4", code: "CAT_ORANGE", label_en: "Leaning Opposition", label_mr: "प्रतिकूल झुकणारे", color_hex: "#F97316", is_active: true },
  { id: "c-5", code: "CAT_RED", label_en: "Strong Opposition", label_mr: "कडक विरोध", color_hex: "#EF4444", is_active: true },
];

export const MOCK_VILLAGES: Village[] = [
  { id: "v-1", name_en: "Sakharele", name_mr: "साखराळे", total_voters: 694, active_voters: 692, deceased_voters: 2 },
  { id: "v-2", name_en: "Agran Dhulgaon", name_mr: "अग्रण धुळगांव", total_voters: 44, active_voters: 44, deceased_voters: 0 },
  { id: "v-3", name_en: "Athani", name_mr: "अथणी", total_voters: 312, active_voters: 310, deceased_voters: 2 },
  { id: "v-4", name_en: "Anantpur", name_mr: "अनंतपूर", total_voters: 185, active_voters: 184, deceased_voters: 1 },
  { id: "v-5", name_en: "Kavathe Mahankal", name_mr: "कवठे महांकाळ", total_voters: 1410, active_voters: 1402, deceased_voters: 8 },
];

export const MOCK_MEMBERS: Member[] = [
  // Agran Dhulgaon from reference screenshot page 2
  {
    id: "m-1",
    booth_part_number: "B-299",
    serial_number: 301,
    epic_number: "LBY1290301",
    full_name_mr: "भोसले सुभाष शंकर",
    surname: "भोसले",
    first_name: "सुभाष",
    father_name: "शंकर",
    relative_name_mr: "शंकर भोसले",
    relation_type: "Father",
    house_number: "14",
    age: 48,
    gender: "Male",
    village_id: "v-2",
    village_name_mr: "अग्रण धुळगांव",
    category_id: "c-1",
    category_color: "#10B981",
    category_label: "पक्के समर्थक",
    mobile_number: "9822012345",
    address: "अग्रण धुळगांव, ता. कवठे महांकाळ",
    religion: "हिंदू",
    caste: "मराठा",
    designation: "सभासद",
    profession: "शेती",
    status: "ACTIVE"
  },
  {
    id: "m-2",
    booth_part_number: "B-300",
    serial_number: 302,
    epic_number: "LBY1290302",
    full_name_mr: "भोसले केशव आबा",
    surname: "भोसले",
    first_name: "केशव",
    father_name: "आबा",
    relative_name_mr: "आबा भोसले",
    relation_type: "Father",
    house_number: "16",
    age: 52,
    gender: "Male",
    village_id: "v-2",
    village_name_mr: "अग्रण धुळगांव",
    category_id: "c-1",
    category_color: "#10B981",
    category_label: "पक्के समर्थक",
    mobile_number: "9822012346",
    address: "अग्रण धुळगांव, ता. कवठे महांकाळ",
    religion: "हिंदू",
    caste: "मराठा",
    designation: "सभासद",
    profession: "शेती",
    status: "ACTIVE"
  },
  {
    id: "m-3",
    booth_part_number: "B-301",
    serial_number: 303,
    epic_number: "LBY1290303",
    full_name_mr: "भोसले विष्णू नाना",
    surname: "भोसले",
    first_name: "विष्णू",
    father_name: "नाना",
    relative_name_mr: "नाना भोसले",
    relation_type: "Father",
    house_number: "18",
    age: 45,
    gender: "Male",
    village_id: "v-2",
    village_name_mr: "अग्रण धुळगांव",
    category_id: "c-2",
    category_color: "#84CC16",
    category_label: "अनुकूल मतदार",
    mobile_number: "9822012347",
    address: "अग्रण धुळगांव, ता. कवठे महांकाळ",
    religion: "हिंदू",
    caste: "मराठा",
    designation: "सभासद",
    profession: "शेती",
    status: "ACTIVE"
  },
  {
    id: "m-4",
    booth_part_number: "B-302",
    serial_number: 304,
    epic_number: "LBY1290304",
    full_name_mr: "भोसले संभाजी निवृत्ती",
    surname: "भोसले",
    first_name: "संभाजी",
    father_name: "निवृत्ती",
    relative_name_mr: "निवृत्ती भोसले",
    relation_type: "Father",
    house_number: "20",
    age: 58,
    gender: "Male",
    village_id: "v-2",
    village_name_mr: "अग्रण धुळगांव",
    category_id: "c-3",
    category_color: "#F59E0B",
    category_label: "तटस्थ / अनिर्णित",
    mobile_number: "9822012348",
    address: "अग्रण धुळगांव, ता. कवठे महांकाळ",
    religion: "हिंदू",
    caste: "मराठा",
    designation: "सभासद",
    profession: "शेती",
    status: "ACTIVE"
  },
  {
    id: "m-5",
    booth_part_number: "B-303",
    serial_number: 305,
    epic_number: "LBY1290305",
    full_name_mr: "काटकर मारूती सखाराम",
    surname: "काटकर",
    first_name: "मारूती",
    father_name: "सखाराम",
    relative_name_mr: "सखाराम काटकर",
    relation_type: "Father",
    house_number: "22",
    age: 63,
    gender: "Male",
    village_id: "v-2",
    village_name_mr: "अग्रण धुळगांव",
    category_id: "c-1",
    category_color: "#10B981",
    category_label: "पक्के समर्थक",
    mobile_number: "9822012349",
    address: "अग्रण धुळगांव, ता. कवठे महांकाळ",
    religion: "हिंदू",
    caste: "मराठा",
    designation: "सभासद",
    profession: "शेती",
    status: "ACTIVE"
  },
  {
    id: "m-6",
    booth_part_number: "B-304",
    serial_number: 306,
    epic_number: "LBY1290306",
    full_name_mr: "भोसले विजय भगवान",
    surname: "भोसले",
    first_name: "विजय",
    father_name: "भगवान",
    relative_name_mr: "भगवान भोसले",
    relation_type: "Father",
    house_number: "24",
    age: 39,
    gender: "Male",
    village_id: "v-2",
    village_name_mr: "अग्रण धुळगांव",
    category_id: "c-4",
    category_color: "#F97316",
    category_label: "प्रतिकूल झुकणारे",
    mobile_number: "9822012350",
    address: "अग्रण धुळगांव, ता. कवठे महांकाळ",
    religion: "हिंदू",
    caste: "मराठा",
    designation: "सभासद",
    profession: "व्यवसाय",
    status: "ACTIVE"
  },

  // Sakharele voters from provided PDF page 3
  {
    id: "m-7",
    booth_part_number: "B-62",
    serial_number: 1,
    epic_number: "XTX7477128",
    full_name_mr: "सोनाली वनिता भंडारे",
    surname: "भंडारे",
    first_name: "सोनाली",
    father_name: "वनिता",
    relative_name_mr: "वनिता भंडारे",
    relation_type: "Father",
    house_number: "12",
    age: 28,
    gender: "Female",
    village_id: "v-1",
    village_name_mr: "साखराळे",
    category_id: "c-1",
    category_color: "#10B981",
    category_label: "पक्के समर्थक",
    mobile_number: "9823000001",
    address: "1-हरिजन वाडा व मांगवाडा साखराळे",
    religion: "हिंदू",
    caste: "बौद्ध",
    designation: "सभासद",
    profession: "गृहशिक्षिका",
    status: "ACTIVE"
  },
  {
    id: "m-8",
    booth_part_number: "B-62",
    serial_number: 2,
    epic_number: "XTX6650014",
    full_name_mr: "अतुल उत्तम दंडवते",
    surname: "दंडवते",
    first_name: "अतुल",
    father_name: "उत्तम",
    relative_name_mr: "उत्तम दंडवते",
    relation_type: "Father",
    house_number: "12",
    age: 54,
    gender: "Male",
    village_id: "v-1",
    village_name_mr: "साखराळे",
    category_id: "c-1",
    category_color: "#10B981",
    category_label: "पक्के समर्थक",
    mobile_number: "9823000002",
    address: "1-हरिजन वाडा व मांगवाडा साखराळे",
    religion: "हिंदू",
    caste: "मराठा",
    designation: "सभासद",
    profession: "शेती",
    status: "ACTIVE"
  },
  {
    id: "m-9",
    booth_part_number: "B-62",
    serial_number: 3,
    epic_number: "XTX6650006",
    full_name_mr: "लता अतुल दंडवते",
    surname: "दंडवते",
    first_name: "लता",
    father_name: "अतुल",
    relative_name_mr: "अतुल दंडवते",
    relation_type: "Husband",
    house_number: "12",
    age: 47,
    gender: "Female",
    village_id: "v-1",
    village_name_mr: "साखराळे",
    category_id: "c-1",
    category_color: "#10B981",
    category_label: "पक्के समर्थक",
    mobile_number: "9823000003",
    address: "1-हरिजन वाडा व मांगवाडा साखराळे",
    religion: "हिंदू",
    caste: "मराठा",
    designation: "सभासद",
    profession: "गृहिणी",
    status: "ACTIVE"
  },
  {
    id: "m-10",
    booth_part_number: "B-62",
    serial_number: 4,
    epic_number: "XTX6649990",
    full_name_mr: "भगवान दगडू कांबळे",
    surname: "कांबळे",
    first_name: "भगवान",
    father_name: "दगडू",
    relative_name_mr: "दगडू कांबळे",
    relation_type: "Father",
    house_number: "15",
    age: 61,
    gender: "Male",
    village_id: "v-1",
    village_name_mr: "साखराळे",
    category_id: "c-3",
    category_color: "#F59E0B",
    category_label: "तटस्थ / अनिर्णित",
    mobile_number: "9823000004",
    address: "1-हरिजन वाडा व मांगवाडा साखराळे",
    religion: "हिंदू",
    caste: "मातंग",
    designation: "सभासद",
    profession: "मजूर",
    status: "ACTIVE"
  },
  {
    id: "m-11",
    booth_part_number: "B-14",
    serial_number: 1446,
    epic_number: "XTX1446000",
    full_name_mr: "कांबळे मारुती आनंदा (स्वर्गीय)",
    surname: "कांबळे",
    first_name: "मारुती",
    father_name: "आनंदा",
    relative_name_mr: "आनंदा कांबळे",
    relation_type: "Father",
    house_number: "88",
    age: 72,
    gender: "Male",
    village_id: "v-5",
    village_name_mr: "कवठे महांकाळ",
    category_id: "c-5",
    category_color: "#EF4444",
    category_label: "कडक विरोध",
    mobile_number: "",
    address: "कवठे महांकाळ",
    status: "DECEASED",
    deceased_date: "2025-11-14T00:00:00Z"
  }
];

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  total_users: 6,
  active_users: 6,
  disabled_users: 0,
  total_villages: 5,
  total_members: 2645,
  active_members: 2632,
  deceased_members: 13,
  duplicate_records: 0,
  pending_imports: 0,
  last_sync: "2026-09-21T18:00:00Z",
  members_by_village: [
    { village_id: "v-1", name_mr: "साखराळे", name_en: "Sakharele", count: 694 },
    { village_id: "v-2", name_mr: "अग्रण धुळगांव", name_en: "Agran Dhulgaon", count: 44 },
    { village_id: "v-3", name_mr: "अथणी", name_en: "Athani", count: 312 },
    { village_id: "v-4", name_mr: "अनंतपूर", name_en: "Anantpur", count: 185 },
    { village_id: "v-5", name_mr: "कवठे महांकाळ", name_en: "Kavathe Mahankal", count: 1410 }
  ],
  members_by_category: [
    { category_id: "c-1", label: "पक्के समर्थक", color: "#10B981", count: 1420 },
    { category_id: "c-2", label: "अनुकूल मतदार", color: "#84CC16", count: 580 },
    { category_id: "c-3", label: "तटस्थ / अनिर्णित", color: "#F59E0B", count: 350 },
    { category_id: "c-4", label: "प्रतिकूल झुकणारे", color: "#F97316", count: 180 },
    { category_id: "c-5", label: "कडक विरोध", color: "#EF4444", count: 115 }
  ],
  recent_activities: [
    { id: "act-1", action: "LOGIN", details: "User rupesh_sir logged in", timestamp: "2026-09-21T17:45:00Z", username: "rupesh_sir" },
    { id: "act-2", action: "SEARCH", details: "Searched for 'भोसले'", timestamp: "2026-09-21T17:48:00Z", username: "rupesh_sir" },
    { id: "act-3", action: "VIEW_PROFILE", details: "Viewed profile of भोसले सुभाष शंकर", timestamp: "2026-09-21T17:50:00Z", username: "rupesh_sir" },
    { id: "act-4", action: "QUICK_SYNC", details: "Synced 44 records down", timestamp: "2026-09-21T18:00:00Z", username: "rupesh_sir" }
  ]
};

export const MOCK_USER_ACTIVITIES: Record<string, {
  timeline: any[];
  calls: any[];
  sms: any[];
  locations: any[];
  call_count: number;
  sms_count: number;
  location_count: number;
}> = {
  // Rupesh Sir (Mobile: 9172474077)
  "rupesh_sir": {
    call_count: 5,
    sms_count: 4,
    location_count: 4,
    calls: [
      {
        id: "call-r1",
        targetMemberName: "पाटील तानाजी यशवंत",
        details: "कॉल केला (Rupesh Sir: 9172474077): पाटील तानाजी यशवंत (9822100010) - गाव: साखराळे",
        metadata: { phone: "9822100010", voter: "पाटील तानाजी यशवंत", village: "साखराळे", duration: "2m 45s", callerMobile: "9172474077" },
        timestamp: "2026-09-23T11:30:00Z"
      },
      {
        id: "call-r2",
        targetMemberName: "भोसले सुभाष शंकर",
        details: "कॉल केला (Rupesh Sir: 9172474077): भोसले सुभाष शंकर (9822012345) - गाव: साखराळे",
        metadata: { phone: "9822012345", voter: "भोसले सुभाष शंकर", village: "साखराळे", duration: "3m 12s", callerMobile: "9172474077" },
        timestamp: "2026-09-23T10:15:00Z"
      },
      {
        id: "call-r3",
        targetMemberName: "कदम वसंत नारायण",
        details: "कॉल केला (Rupesh Sir: 9172474077): कदम वसंत नारायण (9850123999) - गाव: साखराळे",
        metadata: { phone: "9850123999", voter: "कदम वसंत नारायण", village: "साखराळे", duration: "1m 55s", callerMobile: "9172474077" },
        timestamp: "2026-09-22T16:20:00Z"
      },
      {
        id: "call-r4",
        targetMemberName: "मोरे विजय पांडुरंग",
        details: "कॉल केला (Rupesh Sir: 9172474077): मोरे विजय पांडुरंग (9890123456) - गाव: साखराळे",
        metadata: { phone: "9890123456", voter: "मोरे विजय पांडुरंग", village: "साखराळे", duration: "4m 10s", callerMobile: "9172474077" },
        timestamp: "2026-09-22T14:05:00Z"
      },
      {
        id: "call-r5",
        targetMemberName: "शिंदे आनंदा गणपती",
        details: "कॉल केला (Rupesh Sir: 9172474077): शिंदे आनंदा गणपती (9422011223) - गाव: साखराळे",
        metadata: { phone: "9422011223", voter: "शिंदे आनंदा गणपती", village: "साखराळे", duration: "2m 10s", callerMobile: "9172474077" },
        timestamp: "2026-09-21T09:40:00Z"
      }
    ],
    sms: [
      {
        id: "sms-r1",
        targetMemberName: "पाटील तानाजी यशवंत",
        details: "SMS पाठवला: 'मतदार नोंदणी पडताळणी व मतदान केंद्र माहिती - साखराळे'",
        metadata: { phone: "9822100010", voter: "पाटील तानाजी यशवंत", village: "साखराळे", senderMobile: "9172474077" },
        timestamp: "2026-09-23T11:32:00Z"
      },
      {
        id: "sms-r2",
        targetMemberName: "भोसले सुभाष शंकर",
        details: "SMS पाठवला: 'मतदार स्लिप उपलब्ध झाली आहे, कृपया तपासा.'",
        metadata: { phone: "9822012345", voter: "भोसले सुभाष शंकर", village: "साखराळे", senderMobile: "9172474077" },
        timestamp: "2026-09-23T10:20:00Z"
      },
      {
        id: "sms-r3",
        targetMemberName: "कदम वसंत नारायण",
        details: "SMS पाठवला: 'कुटुंबातील सर्व सदस्यांची नावे समाविष्ट असल्याची खात्री करा.'",
        metadata: { phone: "9850123999", voter: "कदम वसंत नारायण", village: "साखराळे", senderMobile: "9172474077" },
        timestamp: "2026-09-22T16:25:00Z"
      },
      {
        id: "sms-r4",
        targetMemberName: "मोरे विजय पांडुरंग",
        details: "SMS पाठवला: 'मतदान केंद्र क्र. 61 - साखराळे प्राथमिक शाळा'",
        metadata: { phone: "9890123456", voter: "मोरे विजय पांडुरंग", village: "साखराळे", senderMobile: "9172474077" },
        timestamp: "2026-09-21T18:10:00Z"
      }
    ],
    locations: [
      {
        id: "loc-r1",
        action: "LOCATION_CHECKIN",
        details: "गाव भेट व मतदार पडताळणी: साखराळे (बूथ क्र. 61 - केंद्रीय प्राथमिक शाळा, पश्चिम भाग)",
        metadata: { village: "साखराळे", booth: "भाग क्र. 61", district: "सांगली", taluka: "वाळवा" },
        timestamp: "2026-09-23T11:00:00Z"
      },
      {
        id: "loc-r2",
        action: "LOCATION_CHECKIN",
        details: "गाव भेट व मतदार पडताळणी: साखराळे (बूथ क्र. 62 - माध्यमिक विद्यालय, पूर्व भाग)",
        metadata: { village: "साखराळे", booth: "भाग क्र. 62", district: "सांगली", taluka: "वाळवा" },
        timestamp: "2026-09-23T09:30:00Z"
      },
      {
        id: "loc-r3",
        action: "LOCATION_CHECKIN",
        details: "गाव भेट व मतदार पडताळणी: साखराळे (वार्ड क्र. 3, जुने गावठाण परिसर)",
        metadata: { village: "साखराळे", booth: "भाग क्र. 61", district: "सांगली", taluka: "वाळवा" },
        timestamp: "2026-09-22T15:00:00Z"
      },
      {
        id: "loc-r4",
        action: "LOCATION_CHECKIN",
        details: "गाव भेट व मतदार पडताळणी: साखराळे (ग्रामपंचायत कार्यालय व मध्यवर्ती चौक)",
        metadata: { village: "साखराळे", booth: "भाग क्र. 62", district: "सांगली", taluka: "वाळवा" },
        timestamp: "2026-09-21T10:00:00Z"
      }
    ],
    timeline: []
  },

  // Admin User
  "admin": {
    call_count: 3,
    sms_count: 3,
    location_count: 2,
    calls: [
      {
        id: "call-a1",
        targetMemberName: "Rupesh Sir (फील्ड प्रमुख)",
        details: "कॉल केला: Rupesh Sir (9172474077) - मतदार डेटा आढावा",
        metadata: { phone: "9172474077", voter: "Rupesh Sir", village: "साखराळे", duration: "5m 20s" },
        timestamp: "2026-09-23T12:00:00Z"
      },
      {
        id: "call-a2",
        targetMemberName: "सिद्धार्थ लोंढे (कार्यकर्ता)",
        details: "कॉल केला: सिद्धार्थ लोंढे (7028511404) - साखराळे बूथ वाटप",
        metadata: { phone: "7028511404", voter: "सिद्धार्थ लोंढे", village: "साखराळे", duration: "3m 10s" },
        timestamp: "2026-09-23T09:10:00Z"
      },
      {
        id: "call-a3",
        targetMemberName: "सौरभ कोठावळे (कार्यकर्ता)",
        details: "कॉल केला: सौरभ कोठावळे (7276809080) - मतदार स्लिप वाटप नियोजन",
        metadata: { phone: "7276809080", voter: "सौरभ कोठावळे", village: "साखराळे", duration: "4m 00s" },
        timestamp: "2026-09-22T17:30:00Z"
      }
    ],
    sms: [
      {
        id: "sms-a1",
        targetMemberName: "Rupesh Sir",
        details: "SMS पाठवला: 'साखराळे गाव डेटा अपलोड पूर्ण झाला आहे, मतदार पडताळणी सुरू करा.'",
        metadata: { phone: "9172474077", voter: "Rupesh Sir", village: "साखराळे" },
        timestamp: "2026-09-23T08:30:00Z"
      },
      {
        id: "sms-a2",
        targetMemberName: "सर्व युझर्स",
        details: "SMS ब्रॉडकास्ट: 'साखराळे बूथ क्र. 61 आणि 62 ची नवीन यादी ॲपमध्ये उपलब्ध आहे.'",
        metadata: { phone: "9876543210", voter: "सिस्टम संदेश", village: "साखराळे" },
        timestamp: "2026-09-22T10:00:00Z"
      },
      {
        id: "sms-a3",
        targetMemberName: "रवी गाडवे",
        details: "SMS पाठवला: 'दुपारी 3 वाजता साखराळे मतदार नियोजन बैठक'",
        metadata: { phone: "7588238320", voter: "रवी गाडवे", village: "साखराळे" },
        timestamp: "2026-09-21T14:00:00Z"
      }
    ],
    locations: [
      {
        id: "loc-a1",
        action: "LOCATION_CHECKIN",
        details: "केंद्रीय नियंत्रण कक्ष व मुख्य केंद्र: साखराळे (तालुका वाळवा)",
        metadata: { village: "साखराळे", booth: "मध्यवर्ती कार्यालय", district: "सांगली" },
        timestamp: "2026-09-23T08:00:00Z"
      },
      {
        id: "loc-a2",
        action: "LOCATION_CHECKIN",
        details: "गाव पाहणी दौरा: साखराळे (बूथ क्र. 61 व 62)",
        metadata: { village: "साखराळे", booth: "बूथ 61-62", district: "सांगली" },
        timestamp: "2026-09-22T11:00:00Z"
      }
    ],
    timeline: []
  },

  // Siddharth Londhe
  "siddharth_londhe": {
    call_count: 4,
    sms_count: 3,
    location_count: 3,
    calls: [
      {
        id: "call-s1",
        targetMemberName: "जाधव प्रकाश विष्णू",
        details: "कॉल केला: जाधव प्रकाश विष्णू (9823045678) - गाव: साखराळे",
        metadata: { phone: "9823045678", voter: "जाधव प्रकाश विष्णू", village: "साखराळे", duration: "1m 40s" },
        timestamp: "2026-09-23T11:15:00Z"
      },
      {
        id: "call-s2",
        targetMemberName: "कुंभार रमेश मारुती",
        details: "कॉल केला: कुंभार रमेश मारुती (9823098765) - गाव: साखराळे",
        metadata: { phone: "9823098765", voter: "कुंभार रमेश मारुती", village: "साखराळे", duration: "2m 15s" },
        timestamp: "2026-09-22T15:45:00Z"
      },
      {
        id: "call-s3",
        targetMemberName: "सावंत दिलीप बळवंत",
        details: "कॉल केला: सावंत दिलीप बळवंत (9823112233) - गाव: साखराळे",
        metadata: { phone: "9823112233", voter: "सावंत दिलीप बळवंत", village: "साखराळे", duration: "3m 30s" },
        timestamp: "2026-09-22T10:20:00Z"
      },
      {
        id: "call-s4",
        targetMemberName: "घाडगे संभाजी तुकाराम",
        details: "कॉल केला: घाडगे संभाजी तुकाराम (9823445566) - गाव: साखराळे",
        metadata: { phone: "9823445566", voter: "घाडगे संभाजी तुकाराम", village: "साखराळे", duration: "2m 05s" },
        timestamp: "2026-09-21T16:10:00Z"
      }
    ],
    sms: [
      {
        id: "sms-s1",
        targetMemberName: "जाधव प्रकाश विष्णू",
        details: "SMS पाठवला: 'आपले नाव साखराळे मतदार यादीत समाविष्ट आहे.'",
        metadata: { phone: "9823045678", voter: "जाधव प्रकाश विष्णू", village: "साखराळे" },
        timestamp: "2026-09-23T11:20:00Z"
      },
      {
        id: "sms-s2",
        targetMemberName: "कुंभार रमेश मारुती",
        details: "SMS पाठवला: 'मतदान केंद्र क्र. 61 ची माहिती.'",
        metadata: { phone: "9823098765", voter: "कुंभार रमेश मारुती", village: "साखराळे" },
        timestamp: "2026-09-22T15:50:00Z"
      },
      {
        id: "sms-s3",
        targetMemberName: "सावंत दिलीप बळवंत",
        details: "SMS पाठवला: 'कुटुंबातील सदस्यांची यादी पडताळणी.'",
        metadata: { phone: "9823112233", voter: "सावंत दिलीप बळवंत", village: "साखराळे" },
        timestamp: "2026-09-22T10:25:00Z"
      }
    ],
    locations: [
      {
        id: "loc-s1",
        action: "LOCATION_CHECKIN",
        details: "गाव भेट: साखराळे (बूथ क्र. 61 - गल्ली क्र. 1 ते 4)",
        metadata: { village: "साखराळे", booth: "भाग क्र. 61", district: "सांगली" },
        timestamp: "2026-09-23T10:30:00Z"
      },
      {
        id: "loc-s2",
        action: "LOCATION_CHECKIN",
        details: "घरोघरी भेट: साखराळे (मारुती मंदिर परिसर)",
        metadata: { village: "साखराळे", booth: "भाग क्र. 61", district: "सांगली" },
        timestamp: "2026-09-22T14:30:00Z"
      },
      {
        id: "loc-s3",
        action: "LOCATION_CHECKIN",
        details: "मतदार संपर्क केंद्र: साखराळे (ग्रामपंचायत चौक)",
        metadata: { village: "साखराळे", booth: "मध्यवर्ती", district: "सांगली" },
        timestamp: "2026-09-21T15:00:00Z"
      }
    ],
    timeline: []
  },

  // Saurabh Kothawale
  "saurabh_kothawale": {
    call_count: 3,
    sms_count: 2,
    location_count: 2,
    calls: [
      {
        id: "call-sk1",
        targetMemberName: "माने अशोक सखाराम",
        details: "कॉल केला: माने अशोक सखाराम (9860112233) - गाव: साखराळे",
        metadata: { phone: "9860112233", voter: "माने अशोक सखाराम", village: "साखराळे", duration: "2m 10s" },
        timestamp: "2026-09-23T10:45:00Z"
      },
      {
        id: "call-sk2",
        targetMemberName: "चव्हाण सर्जेराव पांडुरंग",
        details: "कॉल केला: चव्हाण सर्जेराव पांडुरंग (9860445566) - गाव: साखराळे",
        metadata: { phone: "9860445566", voter: "चव्हाण सर्जेराव पांडुरंग", village: "साखराळे", duration: "1m 35s" },
        timestamp: "2026-09-22T16:15:00Z"
      },
      {
        id: "call-sk3",
        targetMemberName: "जगताप सुरेश बापू",
        details: "कॉल केला: जगताप सुरेश बापू (9860778899) - गाव: साखराळे",
        metadata: { phone: "9860778899", voter: "जगताप सुरेश बापू", village: "साखराळे", duration: "3m 05s" },
        timestamp: "2026-09-21T11:20:00Z"
      }
    ],
    sms: [
      {
        id: "sms-sk1",
        targetMemberName: "माने अशोक सखाराम",
        details: "SMS पाठवला: 'साखराळे बूथ क्र. 62 मतदार ओळखपत्र पडताळणी.'",
        metadata: { phone: "9860112233", voter: "माने अशोक सखाराम", village: "साखराळे" },
        timestamp: "2026-09-23T10:50:00Z"
      },
      {
        id: "sms-sk2",
        targetMemberName: "चव्हाण सर्जेराव पांडुरंग",
        details: "SMS पाठवला: 'नवीन मतदार नोंदणी व यादी क्रमांक माहिती.'",
        metadata: { phone: "9860445566", voter: "चव्हाण सर्जेराव पांडुरंग", village: "साखराळे" },
        timestamp: "2026-09-22T16:20:00Z"
      }
    ],
    locations: [
      {
        id: "loc-sk1",
        action: "LOCATION_CHECKIN",
        details: "बूथ भेट: साखराळे (बूथ क्र. 62 - माध्यमिक शाळा परिसर)",
        metadata: { village: "साखराळे", booth: "भाग क्र. 62", district: "सांगली" },
        timestamp: "2026-09-23T09:45:00Z"
      },
      {
        id: "loc-sk2",
        action: "LOCATION_CHECKIN",
        details: "वॉर्ड दौरा: साखराळे (उत्तर विभाग)",
        metadata: { village: "साखराळे", booth: "भाग क्र. 62", district: "सांगली" },
        timestamp: "2026-09-22T15:30:00Z"
      }
    ],
    timeline: []
  },

  // Ravi Gadve
  "ravi_gadve": {
    call_count: 3,
    sms_count: 2,
    location_count: 2,
    calls: [
      {
        id: "call-rg1",
        targetMemberName: "देशमुख संजय रघुनाथ",
        details: "कॉल केला: देशमुख संजय रघुनाथ (9890223344) - गाव: साखराळे",
        metadata: { phone: "9890223344", voter: "देशमुख संजय रघुनाथ", village: "साखराळे", duration: "2m 30s" },
        timestamp: "2026-09-23T11:00:00Z"
      },
      {
        id: "call-rg2",
        targetMemberName: "गायकवाड बबन शंकर",
        details: "कॉल केला: गायकवाड बबन शंकर (9890556677) - गाव: साखराळे",
        metadata: { phone: "9890556677", voter: "गायकवाड बबन शंकर", village: "साखराळे", duration: "1m 50s" },
        timestamp: "2026-09-22T14:40:00Z"
      },
      {
        id: "call-rg3",
        targetMemberName: "केंगार दत्तात्रय विठ्ठल",
        details: "कॉल केला: केंगार दत्तात्रय विठ्ठल (9890889900) - गाव: साखराळे",
        metadata: { phone: "9890889900", voter: "केंगार दत्तात्रय विठ्ठल", village: "साखराळे", duration: "3m 15s" },
        timestamp: "2026-09-21T15:30:00Z"
      }
    ],
    sms: [
      {
        id: "sms-rg1",
        targetMemberName: "देशमुख संजय रघुनाथ",
        details: "SMS पाठवला: 'साखराळे मतदार माहिती अद्यतनित केली आहे.'",
        metadata: { phone: "9890223344", voter: "देशमुख संजय रघुनाथ", village: "साखराळे" },
        timestamp: "2026-09-23T11:05:00Z"
      },
      {
        id: "sms-rg2",
        targetMemberName: "गायकवाड बबन शंकर",
        details: "SMS पाठवला: 'मतदान केंद्र स्थळ: प्राथमिक शाळा साखराळे.'",
        metadata: { phone: "9890556677", voter: "गायकवाड बबन शंकर", village: "साखराळे" },
        timestamp: "2026-09-22T14:45:00Z"
      }
    ],
    locations: [
      {
        id: "loc-rg1",
        action: "LOCATION_CHECKIN",
        details: "मतदार संपर्क: साखराळे (दक्षिण वाडा परिसर)",
        metadata: { village: "साखराळे", booth: "भाग क्र. 61", district: "सांगली" },
        timestamp: "2026-09-23T10:15:00Z"
      },
      {
        id: "loc-rg2",
        action: "LOCATION_CHECKIN",
        details: "बूथ उपस्थिती: साखराळे (बूथ क्र. 61 केंद्र)",
        metadata: { village: "साखराळे", booth: "भाग क्र. 61", district: "सांगली" },
        timestamp: "2026-09-21T14:00:00Z"
      }
    ],
    timeline: []
  },

  // Omkar
  "omkar": {
    call_count: 2,
    sms_count: 2,
    location_count: 2,
    calls: [
      {
        id: "call-om1",
        targetMemberName: "राउत विलास हरी",
        details: "कॉल केला: राउत विलास हरी (9870112233) - गाव: साखराळे",
        metadata: { phone: "9870112233", voter: "राउत विलास हरी", village: "साखराळे", duration: "1m 45s" },
        timestamp: "2026-09-23T09:30:00Z"
      },
      {
        id: "call-om2",
        targetMemberName: "साळुंखे नानासो बापू",
        details: "कॉल केला: साळुंखे नानासो बापू (9870445566) - गाव: साखराळे",
        metadata: { phone: "9870445566", voter: "साळुंखे नानासो बापू", village: "साखराळे", duration: "2m 20s" },
        timestamp: "2026-09-22T11:15:00Z"
      }
    ],
    sms: [
      {
        id: "sms-om1",
        targetMemberName: "राउत विलास हरी",
        details: "SMS पाठवला: 'साखराळे मतदार नोंदणी पडताळणी पूर्ण झाली.'",
        metadata: { phone: "9870112233", voter: "राउत विलास हरी", village: "साखराळे" },
        timestamp: "2026-09-23T09:35:00Z"
      },
      {
        id: "sms-om2",
        targetMemberName: "साळुंखे नानासो बापू",
        details: "SMS पाठवला: 'मतदान केंद्र क्र. 62 माहिती.'",
        metadata: { phone: "9870445566", voter: "साळुंखे नानासो बापू", village: "साखराळे" },
        timestamp: "2026-09-22T11:20:00Z"
      }
    ],
    locations: [
      {
        id: "loc-om1",
        action: "LOCATION_CHECKIN",
        details: "गाव फेरी: साखराळे (शाळा परिसर)",
        metadata: { village: "साखराळे", booth: "भाग क्र. 62", district: "सांगली" },
        timestamp: "2026-09-23T09:00:00Z"
      },
      {
        id: "loc-om2",
        action: "LOCATION_CHECKIN",
        details: "बूथ केंद्र उपस्थिती: साखराळे (बूथ क्र. 62)",
        metadata: { village: "साखराळे", booth: "भाग क्र. 62", district: "सांगली" },
        timestamp: "2026-09-22T10:45:00Z"
      }
    ],
    timeline: []
  }
};

// Fill timeline automatically for each user
Object.keys(MOCK_USER_ACTIVITIES).forEach((k) => {
  const u = MOCK_USER_ACTIVITIES[k];
  u.timeline = [...u.calls, ...u.sms, ...u.locations].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
});

// Mock Past Import Jobs
export const MOCK_IMPORT_JOBS = [
  {
    id: "job-101",
    fileName: "Sakharele_Booth61.pdf",
    villageName: "साखराळे",
    fileType: "PDF",
    status: "COMPLETED",
    progress: 100,
    metrics: { totalRecords: 1240, validRecords: 1240, importedRecords: 1240 },
    createdAt: "2026-09-23T09:30:00Z",
    uploadedBy: "admin"
  },
  {
    id: "job-102",
    fileName: "Sakharele_Booth62.pdf",
    villageName: "साखराळे",
    fileType: "PDF",
    status: "COMPLETED",
    progress: 100,
    metrics: { totalRecords: 1180, validRecords: 1180, importedRecords: 1180 },
    createdAt: "2026-09-23T10:15:00Z",
    uploadedBy: "admin"
  },
  {
    id: "job-103",
    fileName: "Sakharele_Voters_2026.xlsx",
    villageName: "साखराळे",
    fileType: "EXCEL",
    status: "COMPLETED",
    progress: 100,
    metrics: { totalRecords: 2420, validRecords: 2420, importedRecords: 2420 },
    createdAt: "2026-09-22T14:00:00Z",
    uploadedBy: "admin"
  },
  {
    id: "job-104",
    fileName: "Sakharele_Supplement_List.pdf",
    villageName: "साखराळे",
    fileType: "PDF",
    status: "COMPLETED",
    progress: 100,
    metrics: { totalRecords: 350, validRecords: 350, importedRecords: 350 },
    createdAt: "2026-09-21T16:30:00Z",
    uploadedBy: "admin"
  }
];
