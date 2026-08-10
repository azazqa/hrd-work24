"use server";

import { requireAccessToken } from "@/components/actions/auth-token";

export type Company = {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CompanyPage = {
  items: Company[];
  total?: number | null;
  page?: number | null;
  size?: number | null;
  pages?: number | null;
};

function formatApiError(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const parts = detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String(d.msg) : ""))
      .filter(Boolean);
    if (parts.length > 0) return parts.join("; ");
  }
  return "요청에 실패했습니다.";
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    return formatApiError(body.detail) || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchCompanies(
  page: number = 1,
  size: number = 100,
  opts?: { q?: string; is_active?: boolean },
): Promise<CompanyPage | { message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const token = await requireAccessToken();
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("size", String(size));
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.is_active != null) params.set("is_active", String(opts.is_active));

  const res = await fetch(`${baseURL}/companies?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      message: await parseError(
        res,
        `업체 조회에 실패했습니다. (HTTP ${res.status})`,
      ),
    };
  }
  return (await res.json()) as CompanyPage;
}

export async function createCompanyAction(input: {
  name: string;
  is_active?: boolean;
}): Promise<{ ok: true; data: Company } | { ok: false; message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { ok: false, message: "API_BASE_URL is not configured" };

  const token = await requireAccessToken();
  const res = await fetch(`${baseURL}/companies`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      is_active: input.is_active ?? true,
    }),
  });
  if (!res.ok) {
    return {
      ok: false,
      message: await parseError(res, `업체 추가에 실패했습니다. (HTTP ${res.status})`),
    };
  }
  return { ok: true, data: (await res.json()) as Company };
}

export async function updateCompanyAction(
  id: number,
  input: { name?: string; is_active?: boolean },
): Promise<{ ok: true; data: Company } | { ok: false; message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { ok: false, message: "API_BASE_URL is not configured" };

  const token = await requireAccessToken();
  const res = await fetch(`${baseURL}/companies/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return {
      ok: false,
      message: await parseError(res, `업체 수정에 실패했습니다. (HTTP ${res.status})`),
    };
  }
  return { ok: true, data: (await res.json()) as Company };
}

export async function deleteCompanyAction(
  id: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { ok: false, message: "API_BASE_URL is not configured" };

  const token = await requireAccessToken();
  const res = await fetch(`${baseURL}/companies/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return {
      ok: false,
      message: await parseError(res, `업체 삭제에 실패했습니다. (HTTP ${res.status})`),
    };
  }
  return { ok: true };
}
