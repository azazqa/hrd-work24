"use server";

import { requireAccessToken } from "@/components/actions/auth-token";

export type SettlementListItem = {
  id: number;
  purchase_ym: string;
  purchase_year: number;
  sales_ym: string | null;
  client_name: string;
  course_name: string;
  education_period: string | null;
  education_period_date: string | null;
  headcount: number | null;
  base_tuition: string | number | null;
  net_sales: string | number | null;
  settlement_amount: string | number | null;
  sales_rep: string | null;
};

export type SettlementListPage = {
  items: SettlementListItem[];
  total?: number | null;
  page?: number | null;
  size?: number | null;
  pages?: number | null;
};

export type SettlementListSearch = {
  year?: number;
  client_name?: string;
  course_name?: string;
};

export type OwnedSettlementCompareItem = {
  institution_name: string | null;
  client_name: string | null;
  course_name: string | null;
  tra_start_date: string | null;
  tra_end_date: string | null;
  reg_course_man: string | null;
  status: "matched" | "unsettled" | "unmapped";
};

export type OwnedSettlementCompareStatus =
  OwnedSettlementCompareItem["status"];

export type OwnedSettlementCompareResult = {
  year: number;
  total: number;
  matched: number;
  unsettled: number;
  unmapped: number;
  has_result: boolean;
  cache_hit: boolean;
  extracted_at: string | null;
  compared_at: string | null;
};

export type OwnedSettlementCompareItemsPage = {
  items: OwnedSettlementCompareItem[];
  total?: number | null;
  page?: number | null;
  size?: number | null;
  pages?: number | null;
};

export type OwnedOpeningExtractQueue = {
  id: number;
  year: number;
  status: string;
  row_count: number | null;
  extracted_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
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

export async function fetchSettlements(
  page: number,
  size: number,
  search: SettlementListSearch,
): Promise<SettlementListPage | { message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return { message: "API_BASE_URL is not configured" };
  }

  const token = await requireAccessToken();
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("size", String(size));
  if (search.year != null) q.set("year", String(search.year));
  if (search.client_name?.trim()) q.set("client_name", search.client_name.trim());
  if (search.course_name?.trim()) q.set("course_name", search.course_name.trim());

  const res = await fetch(`${baseURL}/settlements?${q.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `정산 조회에 실패했습니다. (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      message = formatApiError(body.detail) || message;
    } catch {
      /* ignore */
    }
    return { message };
  }

  return (await res.json()) as SettlementListPage;
}

export async function compareOwnedSettlements(
  year: number,
): Promise<OwnedSettlementCompareResult | { message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return { message: "API_BASE_URL is not configured" };
  }

  const token = await requireAccessToken();
  const q = new URLSearchParams();
  q.set("year", String(year));

  const res = await fetch(
    `${baseURL}/settlements/compare-owned?${q.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    let message = `비교에 실패했습니다. (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      message = formatApiError(body.detail) || message;
    } catch {
      /* ignore */
    }
    return { message };
  }

  return (await res.json()) as OwnedSettlementCompareResult;
}

export async function runOwnedSettlementCompare(
  year: number,
): Promise<OwnedSettlementCompareResult | { message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return { message: "API_BASE_URL is not configured" };
  }

  const token = await requireAccessToken();
  const q = new URLSearchParams();
  q.set("year", String(year));

  const res = await fetch(
    `${baseURL}/settlements/compare-owned?${q.toString()}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    let message = `비교 실행에 실패했습니다. (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      message = formatApiError(body.detail) || message;
    } catch {
      /* ignore */
    }
    return { message };
  }

  return (await res.json()) as OwnedSettlementCompareResult;
}

export async function fetchCompareOwnedItems(
  year: number,
  status: OwnedSettlementCompareStatus,
  page: number,
  size: number,
): Promise<OwnedSettlementCompareItemsPage | { message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return { message: "API_BASE_URL is not configured" };
  }

  const token = await requireAccessToken();
  const q = new URLSearchParams();
  q.set("year", String(year));
  q.set("status", status);
  q.set("page", String(page));
  q.set("size", String(size));

  const res = await fetch(
    `${baseURL}/settlements/compare-owned/items?${q.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    let message = `비교 목록 조회에 실패했습니다. (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      message = formatApiError(body.detail) || message;
    } catch {
      /* ignore */
    }
    return { message };
  }

  return (await res.json()) as OwnedSettlementCompareItemsPage;
}

export async function refreshOwnedCourseOpenings(
  year: number,
): Promise<OwnedOpeningExtractQueue | { message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return { message: "API_BASE_URL is not configured" };
  }

  const token = await requireAccessToken();
  const q = new URLSearchParams();
  q.set("year", String(year));

  const res = await fetch(
    `${baseURL}/settlements/compare-owned/refresh?${q.toString()}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    let message = `추출 요청에 실패했습니다. (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      message = formatApiError(body.detail) || message;
    } catch {
      /* ignore */
    }
    return { message };
  }

  return (await res.json()) as OwnedOpeningExtractQueue;
}

export async function fetchOwnedCourseOpeningRefreshJob(
  queueId: number,
): Promise<OwnedOpeningExtractQueue | { message: string }> {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return { message: "API_BASE_URL is not configured" };
  }

  const token = await requireAccessToken();
  const res = await fetch(
    `${baseURL}/settlements/compare-owned/refresh-jobs/${queueId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    let message = `추출 상태 조회에 실패했습니다. (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      message = formatApiError(body.detail) || message;
    } catch {
      /* ignore */
    }
    return { message };
  }

  return (await res.json()) as OwnedOpeningExtractQueue;
}
