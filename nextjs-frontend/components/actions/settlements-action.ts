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
