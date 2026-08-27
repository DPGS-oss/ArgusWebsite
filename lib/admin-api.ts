export type AdminUsageSummary = {
  users_with_cloud_data: number;
  total_invoices: number;
  total_parties: number;
  total_purchases: number;
  total_expenses: number;
  total_stock_items: number;
  active_sync_7d: number;
  active_sync_30d: number;
};

export type AdminPaymentSummary = {
  total_payments: number;
  verified_payments: number;
  renewed_payments: number;
  total_amount_paise: number;
  by_source: Record<string, number>;
  by_plan: Record<string, number>;
  recent_30d: number;
};

export type AdminSubscriptionDetails = {
  by_source: Record<string, number>;
  by_status: Record<string, number>;
  auto_renew_active: number;
  intro_promo_users: number;
  promo_beta_users: number;
  signups_by_month: Record<string, number>;
};

export type AdminSummary = {
  total_users: number;
  subscribed_active: number;
  subscribed_expired: number;
  free_users: number;
  accountants: number;
  by_plan: Record<string, number>;
  recent_signups_7d: number;
  recent_signups_30d: number;
  active_ca_links: number;
  usage?: AdminUsageSummary;
  payments?: AdminPaymentSummary;
  subscription_details?: AdminSubscriptionDetails;
};

export type AdminUserUsage = {
  invoices: number;
  parties: number;
  purchases: number;
  expenses: number;
  stock_items: number;
  quotes: number;
  credit_notes: number;
  delivery_challans: number;
  payments: number;
  khata_entries: number;
  businesses: number;
  last_sync_at: string | null;
  device: string | null;
  has_cloud_data: boolean;
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  business_name: string;
  gstin: string;
  phone: string;
  account_type: string;
  created_at: string | null;
  subscription_status: string;
  subscription: {
    plan?: string | null;
    plan_key?: string | null;
    active?: boolean;
    expiry_date?: string | null;
    auto_renew?: boolean;
    source?: string | null;
    label?: string | null;
  } | null;
  usage?: AdminUserUsage | null;
};

export type AdminReports = {
  subscription: AdminSubscriptionDetails;
  usage: AdminUsageSummary;
  payments: AdminPaymentSummary;
  active_ca_links: number;
  top_users_by_invoices: Array<{
    user_id: string;
    email: string;
    name: string;
    business_name: string;
    invoices: number;
    parties: number;
    last_sync_at: string | null;
    subscription_status: string;
  }>;
  generated_at: string;
};

export type AdminGrantPlan =
  | "business_monthly"
  | "business_yearly"
  | "business_lifetime";

const ADMIN_KEY_STORAGE = "argus_admin_key";

export function loadAdminKey(): string {
  if (typeof window === "undefined") return "";
  try {
    // Prefer session-only storage. Migrate any legacy localStorage copy then delete it.
    const session = sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";
    const legacy = localStorage.getItem(ADMIN_KEY_STORAGE) || "";
    if (legacy) {
      localStorage.removeItem(ADMIN_KEY_STORAGE);
      if (!session && legacy) {
        sessionStorage.setItem(ADMIN_KEY_STORAGE, legacy);
        return legacy;
      }
    }
    return session;
  } catch {
    return "";
  }
}

export function saveAdminKey(key: string) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = key.trim();
    sessionStorage.setItem(ADMIN_KEY_STORAGE, trimmed);
    localStorage.removeItem(ADMIN_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export function clearAdminKey() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ADMIN_KEY_STORAGE);
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

function adminHeaders(token: string, adminKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Admin-Key": adminKey,
  };
}

export async function verifyAdminSession(token: string, adminKey: string) {
  const res = await fetch("/api/admin/session", {
    headers: adminHeaders(token, adminKey),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Admin session denied");
  return data as { ok: boolean; key_expires_at?: string; email?: string };
}

export async function fetchAdminOverview(token: string, adminKey: string) {
  const res = await fetch("/api/admin/overview", {
    headers: adminHeaders(token, adminKey),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load overview");
  return data as { summary: AdminSummary; key_expires_at?: string };
}

export async function fetchAdminReports(token: string, adminKey: string) {
  const res = await fetch("/api/admin/reports", {
    headers: adminHeaders(token, adminKey),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load reports");
  return data as { reports: AdminReports; key_expires_at?: string };
}

export async function fetchAdminUsers(
  token: string,
  adminKey: string,
  params?: { q?: string; status?: string },
) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`/api/admin/users${suffix}`, {
    headers: adminHeaders(token, adminKey),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load users");
  return data as { users: AdminUserRow[]; total: number };
}

export async function fetchAdminUserUsage(
  token: string,
  adminKey: string,
  userId: string,
) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/usage`, {
    headers: adminHeaders(token, adminKey),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load user usage");
  return data as {
    user: AdminUserRow;
    usage: AdminUserUsage;
    payments: Array<{
      id: string;
      status?: string;
      source?: string;
      plan?: string;
      amount_paise?: number;
      created_at?: string;
    }>;
  };
}

export async function grantAdminSubscription(
  token: string,
  adminKey: string,
  userId: string,
  plan: AdminGrantPlan = "business_lifetime",
) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/subscription`, {
    method: "PUT",
    headers: adminHeaders(token, adminKey),
    body: JSON.stringify({ action: "grant", plan }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Grant failed");
  return data;
}

export async function extendAdminSubscription(
  token: string,
  adminKey: string,
  userId: string,
  extendMonths: number,
) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/subscription`, {
    method: "PUT",
    headers: adminHeaders(token, adminKey),
    body: JSON.stringify({ action: "extend", extend_months: extendMonths }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Extend failed");
  return data;
}

export async function revokeAdminSubscription(token: string, adminKey: string, userId: string) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/subscription`, {
    method: "PUT",
    headers: adminHeaders(token, adminKey),
    body: JSON.stringify({ action: "revoke" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Revoke failed");
  return data;
}
