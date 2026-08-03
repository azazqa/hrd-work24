"use server";

import { requireAccessToken } from "@/components/actions/auth-token";

export type ClientNameMapping = {
  id: number;
  institution_name: string;
  client_name: string;
  created_at: string;
  updated_at: string;
};

export type ClientNameMappingPage = {
  items: ClientNameMapping[];
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

export async function fetchClientMappings(
  page: number,
  size: number,
  q?: string,
): Promise<ClientNameMappingPage | { message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const token = await requireAccessToken();
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("size", String(size));
  if (q?.trim()) params.set("q", q.trim());

  const res = await fetch(`${baseURL}/client-mappings?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      message: await parseError(
        res,
        `맵핑 조회에 실패했습니다. (HTTP ${res.status})`,
      ),
    };
  }
  return (await res.json()) as ClientNameMappingPage;
}

export async function createClientMappingAction(input: {
  institution_name: string;
  client_name: string;
}): Promise<{ ok: true; data: ClientNameMapping } | { ok: false; message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { ok: false, message: "API_BASE_URL is not configured" };

  const token = await requireAccessToken();
  const res = await fetch(`${baseURL}/client-mappings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return {
      ok: false,
      message: await parseError(res, `맵핑 추가에 실패했습니다. (HTTP ${res.status})`),
    };
  }
  return { ok: true, data: (await res.json()) as ClientNameMapping };
}

export async function updateClientMappingAction(
  id: number,
  input: { institution_name?: string; client_name?: string },
): Promise<{ ok: true; data: ClientNameMapping } | { ok: false; message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { ok: false, message: "API_BASE_URL is not configured" };

  const token = await requireAccessToken();
  const res = await fetch(`${baseURL}/client-mappings/${id}`, {
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
      message: await parseError(res, `맵핑 수정에 실패했습니다. (HTTP ${res.status})`),
    };
  }
  return { ok: true, data: (await res.json()) as ClientNameMapping };
}

export async function deleteClientMappingAction(
  id: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { ok: false, message: "API_BASE_URL is not configured" };

  const token = await requireAccessToken();
  const res = await fetch(`${baseURL}/client-mappings/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return {
      ok: false,
      message: await parseError(res, `맵핑 삭제에 실패했습니다. (HTTP ${res.status})`),
    };
  }
  return { ok: true };
}
