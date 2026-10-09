export type UserRole = "ADMIN" | "USER";

export interface User {
  id: string;
  username: string;
  fullName?: string;
  full_name?: string;
  mobile: string;
  mobileNumber?: string;
  role: UserRole;
  is_active: boolean;
  accountStatus?: string;
  assignedVillages?: string[];
  permissions_granted?: boolean;
  permissions?: {
    location?: boolean;
    phoneCall?: boolean;
    sms?: boolean;
  };
  created_at?: string;
  last_activity?: string;
}

export interface Village {
  id: string;
  name_en: string;
  name_mr: string;
  taluka?: string;
  district?: string;
  pin_code?: string;
  total_voters: number;
  active_voters: number;
  deceased_voters: number;
}

export interface Category {
  id: string;
  code: string;
  label_en: string;
  label_mr: string;
  color_hex: string;
  description?: string;
  is_active: boolean;
}

export interface Member {
  id: string;
  epic_number?: string;
  membership_number?: string;
  serial_number?: number;
  booth_part_number?: string;
  full_name_mr: string;
  full_name_en?: string;
  surname?: string;
  first_name?: string;
  father_name?: string;
  relative_name_mr?: string;
  relation_type?: string;
  house_number?: string;
  age?: number;
  gender?: "Male" | "Female" | "Other" | string;
  village_id?: string;
  village_name_mr?: string;
  village_name_en?: string;
  category_id?: string;
  category_color?: string;
  category_label?: string;
  category?: any;
  mobile_number?: string;
  mobileNumber?: string;
  address?: string;
  pin_code?: string;
  pinCode?: string;
  houseNumber?: string;
  epicNumber?: string;
  serialNumber?: number | string;
  religion?: string;
  caste?: string;
  designation?: string;
  profession?: string;
  voter_number?: string | number;
  date_of_birth?: string;
  dob?: string;
  part_number?: string | number;
  booth_number?: string | number;
  booth_name?: string;
  status: "ACTIVE" | "DECEASED";
  is_deceased?: boolean;
  deceased_date?: string;
  family_members?: Member[];
  assigned_user_id?: string;
}

export interface ImportJob {
  id: string;
  filename: string;
  file_type: "PDF" | "EXCEL" | "CSV";
  file_size: number;
  total_pages: number;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  stage: string;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  duplicate_records: number;
  imported_records: number;
  error_summary?: string;
  result_file_path?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  username?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  timestamp: string;
}

export interface DashboardStats {
  total_users: number;
  active_users: number;
  disabled_users: number;
  total_villages: number;
  total_members: number;
  active_members: number;
  deceased_members: number;
  duplicate_records: number;
  pending_imports: number;
  categorized_voters?: number;
  total_voters?: number;
  active_voters?: number;
  deceased_voters?: number;
  last_sync?: string;
  members_by_village: { village_id: string; name_mr: string; name_en: string; count: number }[];
  members_by_category: { category_id: string; label: string; color: string; count: number }[];
  recent_activities: { id: string; action: string; details: string; timestamp: string; username: string }[];
}
