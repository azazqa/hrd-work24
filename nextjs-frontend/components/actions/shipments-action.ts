"use server";

import { requireAccessToken } from "@/components/actions/auth-token";

export type ShipmentListRead = {
  id: string;
  order_id: string;
  invoice_number?: string | null;
  order_date: string;
  order_status: string;
  channel?: {
    id: string;
    name: string;
    courier_name?: string | null;
    courier_url?: string | null;
    url?: string | null;
  } | null;
  memo?: string | null;
  receiver?: {
    id: string;
    name: string;
    phone: string;
    zip_code: string;
    address: string;
    address_detail?: string | null;
  } | null;
  items: Array<{
    product: { id: string; product_code: string; name: string };
    quantity: number;
  }>;
  total_quantity: number;
  order_placed_date: string;
  shipping_date: string | null;
};

export type PageShipmentListRead = {
  items: ShipmentListRead[];
  total: number;
  page: number;
  size: number;
  pages: number;
};

export type ShipmentListSearch = {
  order_status?: string;
  channel_ids?: string[];
  channel_id?: string; // backward-compatible
  invoice_number?: string;
  receiver_name?: string;
  receiver_phone?: string;
  receiver_zip_code?: string;
  receiver_address?: string;
  product_query?: string;
  order_date_start?: string;
  order_date_end?: string;
  order_placed_date_start?: string;
  order_placed_date_end?: string;
  shipping_date_start?: string;
  shipping_date_end?: string;
};

function _filenameFromContentDisposition(cd: string | null): string | null {
  if (!cd) return null;
  // filename*=UTF-8''...
  const mStar = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (mStar?.[1]) {
    try {
      return decodeURIComponent(mStar[1]);
    } catch {
      return mStar[1];
    }
  }
  const m = cd.match(/filename\s*=\s*\"?([^\";]+)\"?/i);
  return m?.[1] ?? null;
}

export async function fetchShipments(
  page: number = 1,
  size: number = 10,
  search?: { order_id?: string } & ShipmentListSearch,
) {
  const token = await requireAccessToken();

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const url = new URL(`${baseURL}/shipments`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(size));
  if (search?.order_id) {
    url.searchParams.set("order_id", search.order_id);
  }
  if (search?.order_status) url.searchParams.set("order_status", search.order_status);
  const channelIds = (search?.channel_ids ?? []).map((s) => s.trim()).filter(Boolean);
  if (channelIds.length > 0) url.searchParams.set("channel_ids", channelIds.join(","));
  else if (search?.channel_id) url.searchParams.set("channel_id", search.channel_id);
  if (search?.invoice_number) url.searchParams.set("invoice_number", search.invoice_number);
  if (search?.receiver_name) url.searchParams.set("receiver_name", search.receiver_name);
  if (search?.receiver_phone) url.searchParams.set("receiver_phone", search.receiver_phone);
  if (search?.receiver_zip_code) url.searchParams.set("receiver_zip_code", search.receiver_zip_code);
  if (search?.receiver_address) url.searchParams.set("receiver_address", search.receiver_address);
  if (search?.product_query) url.searchParams.set("product_query", search.product_query);
  if (search?.order_date_start) url.searchParams.set("order_date_start", search.order_date_start);
  if (search?.order_date_end) url.searchParams.set("order_date_end", search.order_date_end);
  if (search?.order_placed_date_start)
    url.searchParams.set("order_placed_date_start", search.order_placed_date_start);
  if (search?.order_placed_date_end)
    url.searchParams.set("order_placed_date_end", search.order_placed_date_end);
  if (search?.shipping_date_start)
    url.searchParams.set("shipping_date_start", search.shipping_date_start);
  if (search?.shipping_date_end)
    url.searchParams.set("shipping_date_end", search.shipping_date_end);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return { message: text || `HTTP ${res.status}` };
  }

  return (await res.json()) as PageShipmentListRead;
}

export async function fetchShipmentsByOrderId(
  orderId: string,
): Promise<ShipmentListRead[] | { message: string }> {
  const result = await fetchShipments(1, 100, { order_id: orderId });
  if ("message" in result) return result;
  return result.items ?? [];
}

export async function downloadSelectedShipmentsExcel(
  shipmentIds: string[],
): Promise<{ filename: string; base64: string } | { message: string }> {
  const token = await requireAccessToken();

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const res = await fetch(`${baseURL}/shipments/excel/selected`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ shipment_ids: shipmentIds }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return { message: text || `HTTP ${res.status}` };
  }

  const ab = await res.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const filename =
    _filenameFromContentDisposition(res.headers.get("content-disposition")) ??
    `shipments_selected_${Date.now()}.xlsx`;

  return { filename, base64 };
}

export async function downloadAllShipmentsExcel(
  search?: ShipmentListSearch,
): Promise<{ filename: string; base64: string } | { message: string }> {
  const token = await requireAccessToken();

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const url = new URL(`${baseURL}/shipments/excel`);
  if (search?.order_status) url.searchParams.set("order_status", search.order_status);
  if (search?.channel_id) url.searchParams.set("channel_id", search.channel_id);
  if (search?.invoice_number) url.searchParams.set("invoice_number", search.invoice_number);
  if (search?.receiver_name) url.searchParams.set("receiver_name", search.receiver_name);
  if (search?.receiver_phone) url.searchParams.set("receiver_phone", search.receiver_phone);
  if (search?.receiver_zip_code) url.searchParams.set("receiver_zip_code", search.receiver_zip_code);
  if (search?.receiver_address) url.searchParams.set("receiver_address", search.receiver_address);
  if (search?.product_query) url.searchParams.set("product_query", search.product_query);
  if (search?.order_date_start) url.searchParams.set("order_date_start", search.order_date_start);
  if (search?.order_date_end) url.searchParams.set("order_date_end", search.order_date_end);
  if (search?.order_placed_date_start)
    url.searchParams.set("order_placed_date_start", search.order_placed_date_start);
  if (search?.order_placed_date_end)
    url.searchParams.set("order_placed_date_end", search.order_placed_date_end);
  if (search?.shipping_date_start)
    url.searchParams.set("shipping_date_start", search.shipping_date_start);
  if (search?.shipping_date_end)
    url.searchParams.set("shipping_date_end", search.shipping_date_end);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return { message: text || `HTTP ${res.status}` };
  }

  const ab = await res.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const filename =
    _filenameFromContentDisposition(res.headers.get("content-disposition")) ??
    `shipments_${Date.now()}.xlsx`;

  return { filename, base64 };
}

/** 검색 조건에 맞는 배송 전체 (페이지네이션 반복, size는 API 최대 100) */
export async function fetchAllShipmentsForExport(
  search?: ShipmentListSearch,
): Promise<ShipmentListRead[] | { message: string }> {
  const pageSize = 100;
  const all: ShipmentListRead[] = [];
  let page = 1;

  for (;;) {
    const res = await fetchShipments(page, pageSize, search);
    if ("message" in res) return res;
    const items = (res?.items ?? []) as ShipmentListRead[];
    all.push(...items);
    if (items.length < pageSize) break;
    page += 1;
    if (page > 10_000) {
      return { message: "다운로드 한도를 초과했습니다. 검색 조건을 좁혀 주세요." };
    }
  }

  return all;
}

