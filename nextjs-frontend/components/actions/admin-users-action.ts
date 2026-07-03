"use server";

import { requireAccessToken } from "@/components/actions/auth-token";

export type AdminUserListItem = {
  id: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  department?: string | null;
  full_name?: string | null;
  phone?: string | null;
  extension_number?: string | null;
  logistics_location_id?: string | null;
  logistics_location_name?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminUserListResponse = {
  items: AdminUserListItem[];
  total: number;
};

export async function fetchAdminUsers(offset = 0, limit = 50) {
  const token = await requireAccessToken();
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const url = new URL(`${baseURL}/admin/users`);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { message: `Failed to load users (HTTP ${res.status}) ${text}` };
  }

  return (await res.json()) as AdminUserListResponse;
}

export async function createAdminUser(formData: FormData) {
  const token = await requireAccessToken();
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const is_superuser = formData.get("is_superuser") === "on";
  const department = String(formData.get("department") ?? "").trim();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const extension_number = String(formData.get("extension_number") ?? "").trim();

  const res = await fetch(`${baseURL}/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      is_superuser,
      department: department.length > 0 ? department : null,
      full_name: full_name.length > 0 ? full_name : null,
      phone: phone.length > 0 ? phone : null,
      extension_number: extension_number.length > 0 ? extension_number : null,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { message: `Failed to create user (HTTP ${res.status}) ${text}` };
  }

  return { ok: true };
}

export async function adminSetPassword(formData: FormData) {
  const token = await requireAccessToken();
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const userId = String(formData.get("user_id") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!userId) return { message: "user_id is required" };

  const res = await fetch(`${baseURL}/admin/users/${encodeURIComponent(userId)}/password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ password }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { message: `Failed to set password (HTTP ${res.status}) ${text}` };
  }

  return { ok: true };
}

export async function adminUpdateUser(formData: FormData) {
  const token = await requireAccessToken();
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const userId = String(formData.get("user_id") ?? "").trim();
  if (!userId) return { message: "user_id is required" };

  const is_active_raw = formData.get("is_active");
  const is_superuser_raw = formData.get("is_superuser");
  const is_verified_raw = formData.get("is_verified");
  const logistics_location_id_raw = formData.get("logistics_location_id");

  const department_raw = formData.get("department");
  const full_name_raw = formData.get("full_name");
  const phone_raw = formData.get("phone");
  const extension_number_raw = formData.get("extension_number");

  const body: Record<string, boolean | string | null> = {};
  if (is_active_raw !== null) body.is_active = is_active_raw === "on";
  if (is_superuser_raw !== null) body.is_superuser = is_superuser_raw === "on";
  if (is_verified_raw !== null) body.is_verified = is_verified_raw === "on";
  if (logistics_location_id_raw !== null) {
    const v = String(logistics_location_id_raw ?? "").trim();
    body.logistics_location_id = v.length > 0 ? v : null;
  }
  if (department_raw !== null) {
    const d = String(department_raw ?? "").trim();
    body.department = d.length > 0 ? d : null;
  }
  if (full_name_raw !== null) {
    const n = String(full_name_raw ?? "").trim();
    body.full_name = n.length > 0 ? n : null;
  }
  if (phone_raw !== null) {
    const p = String(phone_raw ?? "").trim();
    body.phone = p.length > 0 ? p : null;
  }
  if (extension_number_raw !== null) {
    const e = String(extension_number_raw ?? "").trim();
    body.extension_number = e.length > 0 ? e : null;
  }

  const res = await fetch(
    `${baseURL}/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { message: `Failed to update user (HTTP ${res.status}) ${text}` };
  }

  return { ok: true };
}

