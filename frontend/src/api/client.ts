
import axios from "axios";
import {
  Member,
  Village,
  Category,
  User,
  DashboardStats,
  ImportJob,
} from "../models/types";
import { Platform } from "react-native";
import { appStorage } from "../utils/storage";

// Production API URL
export const PRODUCTION_API_URL = "https://mahankali-election-app.onrender.com/api";

// Environment variable or default production API URL
export const DEFAULT_API_BASE_URL = Platform.OS === "android"
  ? PRODUCTION_API_URL
  : (process.env.EXPO_PUBLIC_API_URL
      ? (
        process.env.EXPO_PUBLIC_API_URL.endsWith("/api")
          ? process.env.EXPO_PUBLIC_API_URL
          : `${process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, "")}/api`
      )
      : (Platform.OS === "web" ? "http://localhost:8000/api" : PRODUCTION_API_URL));

export let API_BASE_URL = DEFAULT_API_BASE_URL;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s to handle Render.com free-tier cold starts
  headers: {
    "Content-Type": "application/json",
  },
});

let authToken: string | null = null;

// Request interceptor: Guarantees JWT Authorization header is attached on every API request
apiClient.interceptors.request.use(async (config) => {
  if (!config.headers.Authorization) {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    } else {
      try {
        const storedToken = await appStorage.getItem("election_auth_token");
        if (storedToken) {
          authToken = storedToken;
          config.headers.Authorization = `Bearer ${storedToken}`;
        }
      } catch (err) {}
    }
  }
  return config;
}, (error) => Promise.reject(error));

// Initialize stored Server Base URL & Auth Token asynchronously
(async () => {
  try {
    const savedUrl = await appStorage.getItem("election_server_url");

    if (Platform.OS === "android") {
      // On Android system, always connect to the production FastAPI server
      API_BASE_URL = PRODUCTION_API_URL;
      apiClient.defaults.baseURL = PRODUCTION_API_URL;
      await appStorage.setItem("election_server_url", PRODUCTION_API_URL);
    } else if (savedUrl && savedUrl.trim()) {
      API_BASE_URL = savedUrl.trim();
      apiClient.defaults.baseURL = API_BASE_URL;
    }

    const token = await appStorage.getItem("election_auth_token");

    if (token) {
      authToken = token;
      apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  } catch (error) {
    console.log("Error loading API configuration:", error);
  }
})();

export const setServerBaseUrl = async (newUrl: string): Promise<string> => {
  let cleanUrl = newUrl.trim().replace(/\/+$/, "");
  // If user enters only host:port like http://10.58.203.93:8000, auto-append /api
  if (!cleanUrl.endsWith("/api")) {
    cleanUrl = `${cleanUrl}/api`;
  }
  API_BASE_URL = cleanUrl;
  apiClient.defaults.baseURL = cleanUrl;
  await appStorage.setItem("election_server_url", cleanUrl);
  return cleanUrl;
};

export const getServerBaseUrl = (): string => {
  return apiClient.defaults.baseURL || API_BASE_URL;
};

export const testServerConnection = async (targetUrl?: string): Promise<{ success: boolean; message: string }> => {
  try {
    const urlToTest = (targetUrl ? targetUrl.trim().replace(/\/+$/, "") : getServerBaseUrl());
    const healthUrl = urlToTest.endsWith("/api") ? `${urlToTest}/health` : `${urlToTest}/api/health`;

    // First try the health endpoint
    const res = await axios.get(healthUrl, { timeout: 60000 });
    if (res.status === 200) {
      return { success: true, message: "सर्व्हर जोडणी यशस्वी! (Connected)" };
    }
  } catch (err: any) {
    // Fallback: test root or categories
    try {
      const urlToTest = (targetUrl ? targetUrl.trim().replace(/\/+$/, "") : getServerBaseUrl());
      const catUrl = urlToTest.endsWith("/api") ? `${urlToTest}/categories` : `${urlToTest}/api/categories`;
      const res2 = await axios.get(catUrl, { timeout: 4000 });
      if (res2.status >= 200 && res2.status < 400) {
        return { success: true, message: "सर्व्हर जोडणी यशस्वी! (Connected)" };
      }
    } catch (e2) { }

    return {
      success: false,
      message: "सर्व्हरशी संपर्क होऊ शकला नाही. IP बरोबर आहे का आणि बॅकएंड चालू आहे का ते तपासा."
    };
  }
  return { success: false, message: "सर्व्हरकडून प्रतिसाद मिळाला नाही." };
};

export const setAuthToken = async (token: string | null) => {
  authToken = token;
  if (token) {
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    await appStorage.setItem("election_auth_token", token);
  } else {
    delete apiClient.defaults.headers.common["Authorization"];
    await appStorage.removeItem("election_auth_token");
    await appStorage.removeItem("election_user_info");
  }
};

// ----------------- AUTH API -----------------
export const authAPI = {
  login: async (username: string, password: string) => {
    try {
      const res = await apiClient.post("/auth/login", { username, password });
      setAuthToken(res.data.access_token);
      return res.data;
    } catch (e: any) {
      if (e?.response) {
        throw new Error(
          e.response.data?.detail || e.response.data?.message || "लॉगिन अयशस्वी: चुकीचे युझरनेम किंवा पासवर्ड."
        );
      }
      throw new Error("सर्व्हरशी संपर्क होऊ शकला नाही. कृपया बॅकएंड चालू असल्याची खात्री करा.");
    }
  },
  getMe: async () => {
    const res = await apiClient.get("/auth/me");
    return res.data?.data || res.data;
  },
  updateSelfPermissions: async (permissions_granted: boolean, permissions?: Record<string, boolean>) => {
    try {
      const res = await apiClient.post("/admin/users/self-permissions", {
        permissions_granted,
        permissions: permissions || undefined
      });
      return res.data;
    } catch (e) {
      return { success: false };
    }
  }
};

// ----------------- MEMBER API -----------------
export const memberAPI = {
  getMembers: async (params?: {
    q?: string;
    village_id?: string;
    category_id?: string;
    status?: string;
    my_assigned_only?: boolean;
    page?: number;
    limit?: number;
  }) => {
    try {
      const res = await apiClient.get("/members", { params });
      return res.data;
    } catch (e) {
      return {
        total: 0,
        page: params?.page || 1,
        limit: params?.limit || 50,
        total_pages: 1,
        items: []
      };
    }
  },

  getMemberDetail: async (id: string) => {
    const res = await apiClient.get(`/members/${id}`);
    return res.data?.data || res.data;
  },

  updateMember: async (id: string, data: Partial<Member>) => {
    const res = await apiClient.put(`/members/${id}`, data);
    return res.data?.data || res.data;
  },

  toggleDeceased: async (id: string, is_deceased: boolean) => {
    const res = await apiClient.patch(`/members/${id}/deceased`, { is_deceased });
    return res.data?.data || res.data;
  },

  updateCategory: async (id: string, category_id: string | null) => {
    const res = await apiClient.patch(`/members/${id}/category`, { category_id });
    return res.data?.data || res.data;
  }
};

// ----------------- VILLAGE & CATEGORY API -----------------
export const villageAPI = {
  getVillages: async (): Promise<Village[]> => {
    try {
      const res = await apiClient.get("/villages");
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      return [];
    }
  }
};

export const categoryAPI = {
  getCategories: async (): Promise<Category[]> => {
    try {
      const res = await apiClient.get("/categories");
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      return [];
    }
  }
};

// ----------------- REPORTS API -----------------
export const reportAPI = {
  getAlphabetical: async (village_id?: string, letter?: string) => {
    try {
      const res = await apiClient.get("/reports/alphabetical", { params: { village_id, letter } });
      return res.data;
    } catch (e) {
      return { total: 0, items: [] };
    }
  },

  getVillageReport: async () => {
    try {
      const res = await apiClient.get("/reports/village");
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      return [];
    }
  },

  getDeceasedReport: async (village_id?: string) => {
    try {
      const res = await apiClient.get("/reports/deceased", { params: { village_id } });
      return res.data;
    } catch (e) {
      return { total: 0, items: [] };
    }
  },

  getMobileStatusReport: async (village_id?: string) => {
    try {
      const res = await apiClient.get("/reports/mobile-status", { params: { village_id } });
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      return [];
    }
  },

  getGroupedReport: async (type: string, village_id?: string) => {
    try {
      const res = await apiClient.get(`/reports/${type}`, { params: { village_id } });
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.families)) {
        return data.families.map((f: any) => ({
          name: f.name || `${f.familyName || "कुटुंब"} - ${f.headName || ""}`,
          count: f.count || f.totalMembers || (f.members ? f.members.length : 1),
          key: f.key || f.familyId || f.headName || f.familyName
        }));
      }
      if (data && Array.isArray(data.items)) return data.items;
      if (data && Array.isArray(data.data)) return data.data;
      return [];
    } catch (e) {
      return [];
    }
  },

  getDrilldownMembers: async (reportType: string, key: string, villageId?: string) => {
    try {
      const res = await apiClient.get("/reports/drilldown", {
        params: { report_type: reportType, key, village_id: villageId }
      });
      const data = res.data?.items || res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }
};

// ----------------- ADMIN API -----------------
export const adminAPI = {
  getDashboardStats: async (): Promise<DashboardStats> => {
    try {
      const res = await apiClient.get("/admin/dashboard");
      return res.data;
    } catch (e) {
      return {
        total_voters: 0,
        active_voters: 0,
        deceased_voters: 0,
        categorized_voters: 0,
        total_villages: 0,
        total_users: 0,
        recent_activities: []
      } as any;
    }
  },

  getUsers: async (is_active?: boolean): Promise<User[]> => {
    try {
      const res = await apiClient.get("/admin/users", { params: { is_active } });
      const raw = res.data?.data?.items || res.data?.data || res.data?.items || res.data || [];
      if (Array.isArray(raw)) {
        return raw.map((u: any) => ({
          ...u,
          id: String(u.id || u._id || ""),
          username: u.username || "",
          fullName: u.fullName || u.username || "",
          mobile: u.mobileNumber || u.mobile || "",
          role: u.role || "USER",
          is_active: u.accountStatus ? u.accountStatus === "ACTIVE" : (u.is_active ?? true),
          assignedVillages: u.assignedVillages || [],
          permissions_granted: u.permissions_granted ?? false
        }));
      }
      return [];
    } catch (e) {
      return [];
    }
  },

  createUser: async (userData: any): Promise<User> => {
    const payload = {
      fullName: userData.fullName || userData.username || "",
      username: userData.username || "",
      mobileNumber: userData.mobileNumber || userData.mobile || "",
      password: userData.password || "user123",
      role: userData.role || "USER",
      accountStatus: userData.is_active !== false ? "ACTIVE" : "DISABLED",
      assignedVillages: userData.assignedVillages || []
    };
    const res = await apiClient.post("/admin/users", payload);
    const u = res.data?.data || res.data;
    return {
      id: String(u?.id || u?._id || `u-${Date.now()}`),
      username: u?.username || payload.username,
      fullName: u?.fullName || payload.fullName,
      mobile: u?.mobileNumber || u?.mobile || payload.mobileNumber,
      role: u?.role || payload.role,
      is_active: u?.accountStatus ? u.accountStatus === "ACTIVE" : true,
      assignedVillages: u?.assignedVillages || payload.assignedVillages,
      created_at: new Date().toISOString()
    };
  },

  updateUser: async (id: string, userData: any): Promise<User> => {
    const payload: any = {};
    if (userData.fullName !== undefined) payload.fullName = userData.fullName;
    if (userData.mobileNumber !== undefined) payload.mobileNumber = userData.mobileNumber;
    if (userData.mobile !== undefined) payload.mobileNumber = userData.mobile;
    if (userData.role !== undefined) payload.role = userData.role;
    if (userData.password !== undefined && userData.password) payload.password = userData.password;
    if (userData.assignedVillages !== undefined) payload.assignedVillages = userData.assignedVillages;
    const res = await apiClient.put(`/admin/users/${id}`, payload);
    const u = res.data?.data || res.data;
    return {
      ...u,
      id: String(u?.id || u?._id || id),
      username: u?.username || userData.username || "",
      mobile: u?.mobileNumber || u?.mobile || userData.mobile || "",
      role: u?.role || userData.role || "USER",
      is_active: u?.accountStatus ? u.accountStatus === "ACTIVE" : true
    };
  },

  toggleUserStatus: async (id: string, is_active: boolean): Promise<User> => {
    const res = await apiClient.patch(`/admin/users/${id}/status`, null, { params: { is_active } });
    const u = res.data?.data || res.data;
    return {
      ...u,
      id: String(u?.id || u?._id || id),
      username: u?.username || "",
      mobile: u?.mobileNumber || u?.mobile || "",
      role: u?.role || "USER",
      is_active
    };
  },

  deleteUser: async (id: string) => {
    const res = await apiClient.delete(`/admin/users/${id}`);
    return res.data;
  },

  getUserById: async (id: string) => {
    const res = await apiClient.get(`/admin/users/${id}`);
    return res.data?.data || res.data;
  },

  setUserStatus: async (id: string, status: string) => {
    const res = await apiClient.patch(`/admin/users/${id}/status`, { status });
    return res.data;
  },

  uploadPdf: async (formData: FormData) => {
    const res = await apiClient.post("/admin/import/pdf", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data;
  },

  uploadExcel: async (formData: FormData) => {
    const res = await apiClient.post("/admin/import/excel", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data;
  },

  clearAllVoters: async () => {
    const res = await apiClient.post("/admin/import/clear-voters");
    return res.data;
  },

  getImportJobs: async () => {
    try {
      const res = await apiClient.get("/admin/import/jobs");
      if (res.data && res.data.data && Array.isArray(res.data.data)) {
        return res.data;
      }
      return { success: true, data: [] };
    } catch (e) {
      return { success: true, data: [] };
    }
  },

  deleteImportJob: async (jobId: string, deleteVoters: boolean = true) => {
    const res = await apiClient.delete(`/admin/import/jobs/${jobId}`, {
      params: { delete_voters: deleteVoters }
    });
    return res.data;
  },

  toggleUserPermission: async (userId: string, permissions_granted: boolean) => {
    const res = await apiClient.patch(`/admin/users/${userId}/permissions`, {
      permissions_granted
    });
    return res.data;
  },

  getImportJobPreview: async (jobId: string) => {
    try {
      const res = await apiClient.get(`/admin/import/jobs/${jobId}/preview`);
      return res.data;
    } catch (e) {
      return { sample_rows: [] };
    }
  },

  confirmImport: async (jobId: string, duplicateStrategy: string = "SKIP") => {
    const res = await apiClient.post(`/admin/import/jobs/${jobId}/confirm`, { duplicateStrategy });
    return res.data;
  },

  setUserPanelAccess: async (userId: string, access_allowed: boolean, reason?: string) => {
    try {
      const res = await apiClient.patch(`/admin/users/${userId}/access`, {
        access_allowed,
        reason: reason || (access_allowed ? "Admin allowed access" : "Admin denied access based on history")
      });
      return res.data;
    } catch (e: any) {
      // Fallback to status toggle
      const status = access_allowed ? "ACTIVE" : "DISABLED";
      const res = await apiClient.patch(`/admin/users/${userId}/status`, { status });
      return res.data;
    }
  },

  getUserActivity: async (user_id?: string, username?: string) => {
    try {
      const res = await apiClient.get(`/admin/users/${user_id}/activity`);
      const payload = res.data?.data || res.data;
      if (payload) {
        console.log(
          `[adminAPI.getUserActivity] HTTP ${res.status}: Retrieved ${payload.call_count ?? payload.calls?.length ?? 0} calls, ` +
          `${payload.sms_count ?? payload.sms?.length ?? 0} SMS, ${payload.location_count ?? payload.locations?.length ?? 0} locations. ` +
          `call_status=${payload.call_status}, sms_status=${payload.sms_status}`
        );
        return payload;
      }
    } catch (e: any) {
      console.warn(`[adminAPI.getUserActivity] HTTP Error for user_id=${user_id}:`, e?.response?.status, e?.message || e);
    }
    return { calls: [], sms: [], locations: [], call_count: 0, sms_count: 0, location_count: 0 };
  },

  deleteSingleActivity: async (userId: string, activityId: string) => {
    const res = await apiClient.delete(`/admin/users/${userId}/activity/${activityId}`);
    return res.data;
  },

  deleteBatchActivities: async (userId: string, activityIds: string[]) => {
    const res = await apiClient.delete(`/admin/users/${userId}/activity`, {
      data: { activity_ids: activityIds }
    });
    return res.data;
  },

  clearUserActivities: async (userId: string, actionType?: string) => {
    const res = await apiClient.delete(`/admin/users/${userId}/activity`, {
      params: { delete_all: true, action_type: actionType }
    });
    return res.data;
  },

  getAuditLogs: async (action?: string) => {
    try {
      const res = await apiClient.get("/admin/audit-logs", { params: { action } });
      return res.data?.data || res.data || [];
    } catch (e) {
      return [];
    }
  },

  syncTelephonyActivity: async (payload: {
    callStatus: string;
    smsStatus: string;
    calls: any[];
    sms: any[];
    metadata?: Record<string, any>;
  }) => {
    const res = await apiClient.post("/admin/users/activity/telephony-sync", payload);
    const data = res.data?.data || res.data;
    console.log(
      `[adminAPI.syncTelephonyActivity] HTTP ${res.status}: Sent ${payload.calls.length} calls, ${payload.sms.length} SMS. ` +
      `Server saved: calls=${data?.saved_calls ?? data?.callCount}, sms=${data?.saved_sms ?? data?.smsCount}`
    );
    return data;
  }
};

// ----------------- USER ACTIVITY API -----------------
// Helper to log user actions (Call, SMS, Location) from the app
export const logUserActivity = async (params: {
  action: string;
  targetMemberId?: string;
  targetMemberName?: string;
  details?: string;
  userId?: string;
  username?: string;
  metadata?: Record<string, any>;
}): Promise<void> => {
  try {
    let currentUserId = params.userId;
    let currentUsername = params.username;

    if (!currentUserId || !currentUsername) {
      try {
        const stored = await appStorage.getItem("election_user_info");
        if (stored) {
          const u = typeof stored === "string" ? JSON.parse(stored) : stored;
          currentUserId = currentUserId || u?.id || u?._id;
          currentUsername = currentUsername || u?.username;
        }
      } catch (e) { }
    }

    const payload = {
      action: params.action,
      userId: currentUserId,
      user_id: currentUserId,
      username: currentUsername,
      targetMemberId: params.targetMemberId,
      targetMemberName: params.targetMemberName,
      details: params.details || "",
      metadata: {
        ...params.metadata,
        user_id: currentUserId || "u-unknown",
        username: currentUsername || "field_worker",
      }
    };

    await apiClient.post("/admin/users/activity", payload);
  } catch (e) {
    // Silently fail - activity logging should not disrupt UX
  }
};

// ----------------- FAMILY API -----------------
export const familyAPI = {
  getMemberFamily: async (memberId: string) => {
    try {
      const res = await apiClient.get(`/members/${memberId}/family`);
      return res.data;
    } catch (e) {
      return { success: true, data: { members: [] } };
    }
  },

  addFamilyMember: async (memberId: string, payload: {
    nameMarathi: string;
    relationType: string;
    serialNumber?: string | number;
    epicNumber?: string;
    mobileNumber?: string;
    age?: number;
    gender?: string;
    existingMemberId?: string;
    religion?: string;
    caste?: string;
    profession?: string;
    designation?: string;
  }) => {
    const res = await apiClient.post(`/members/${memberId}/family`, payload);
    return res.data;
  },

  deleteFamilyMember: async (memberId: string, familyMemberId: string) => {
    const res = await apiClient.delete(`/members/${memberId}/family/${familyMemberId}`);
    return res.data;
  }
};

// ----------------- IMPORT & SYNC API -----------------
export const importAPI = {
  uploadPdf: async (formData: FormData) => {
    const res = await apiClient.post("/admin/import/pdf", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data;
  },

  getJobStatus: async (jobId: string): Promise<any> => {
    const res = await apiClient.get(`/admin/import/jobs/${jobId}`);
    return res.data?.data || res.data;
  },

  getJobPreview: async (jobId: string) => {
    const res = await apiClient.get(`/admin/import/jobs/${jobId}/preview`);
    return res.data;
  },

  commitJob: async (jobId: string) => {
    const res = await apiClient.post(`/admin/import/jobs/${jobId}/confirm`);
    return res.data;
  },

  getExcelDownloadUrl: (jobId: string) => {
    const base = getServerBaseUrl();
    return `${base}/admin/import/jobs/${jobId}/excel`;
  },

  quickSync: async () => {
    try {
      const res = await apiClient.post("/sync/quick", { last_synced_at: new Date().toISOString() });
      return res.data;
    } catch (e) {
      return {
        synced_at: new Date().toISOString(),
        pulled_count: 0,
        pushed_count: 0,
        updated_members: []
      };
    }
  },

  fullSync: async () => {
    try {
      const res = await apiClient.post("/sync/full");
      return res.data;
    } catch (e) {
      return {
        synced_at: new Date().toISOString(),
        pulled_count: 0,
        pushed_count: 0,
        updated_members: []
      };
    }
  }
};
