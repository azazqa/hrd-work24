"use server";

import { requireAccessToken } from "@/components/actions/auth-token";

export type SettlementState =
  | "pending"
  | "settled"
  | "completed"
  | "reject"
  | "cancelled";

export type SettlementListRead = {
  id: string;
  order_id: string;
  order_price: number;
  price: number;
  state: SettlementState;
  created_at: string;
  updated_at: string;
  settled_at?: string | null;
  completed_at?: string | null;
  channel_name?: string | null;
  mall_product_name?: string | null;
  quantity?: number | null;
  invoice_number?: string | null;
  shipping_date?: string | null;
};

export type PageSettlementListRead = {
  items: SettlementListRead[];
  total: number;
  page: number;
  size: number;
  pages: number;
};

export type SettlementListSearch = {
  state?: SettlementState;
  order_id?: string;
  channel_ids?: string[];
  channel_id?: string; // backward-compatible
  channel_name?: string; // backward-compatible
  mall_product_name?: string;
  invoice_number?: string;
  settled_date_start?: string;
  settled_date_end?: string;
  completed_date_start?: string;
  completed_date_end?: string;
};

export async function fetchSettlements(
  page: number = 1,
  size: number = 10,
  search?: SettlementListSearch,
): Promise<PageSettlementListRead | { message: string }> {
  const token = await requireAccessToken();
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const url = new URL(`${baseURL}/settlements`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(size));
  if (search?.state) url.searchParams.set("state", search.state);
  if (search?.order_id) url.searchParams.set("order_id", search.order_id);
  const channelIds = (search?.channel_ids ?? []).map((s) => s.trim()).filter(Boolean);
  if (channelIds.length > 0) url.searchParams.set("channel_ids", channelIds.join(","));
  else if (search?.channel_id) url.searchParams.set("channel_id", search.channel_id);
  else if (search?.channel_name) url.searchParams.set("channel_name", search.channel_name);
  if (search?.mall_product_name) url.searchParams.set("mall_product_name", search.mall_product_name);
  if (search?.invoice_number) url.searchParams.set("invoice_number", search.invoice_number);
  if (search?.settled_date_start)
    url.searchParams.set("settled_date_start", search.settled_date_start);
  if (search?.settled_date_end)
    url.searchParams.set("settled_date_end", search.settled_date_end);
  if (search?.completed_date_start)
    url.searchParams.set("completed_date_start", search.completed_date_start);
  if (search?.completed_date_end)
    url.searchParams.set("completed_date_end", search.completed_date_end);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    return { message: text || `HTTP ${res.status}` };
  }
  return (await res.json()) as PageSettlementListRead;
}

