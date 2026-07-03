"use server";

import { requireAccessToken } from "@/components/actions/auth-token";
import {
  listStocks,
  createStock,
  updateStock,
  deleteStock,
  restock,
  releaseStock,
  listStockHistories,
  listProducts,
} from "@/app/clientService";
import type { StockUpdate } from "@/app/openapi-client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { stockSchema } from "@/lib/definitions";

export type StockListSearch = {
  product_query?: string;
  logistics_location_name?: string;
  product_barcode?: string;
  batch_code?: string;
  memo?: string;
  /** StockCondition: normal | refurb | disposal | undecided */
  condition?: string;
  category_id?: string;
};

export async function fetchStocks(
  page: number = 1,
  size: number = 10,
  search?: StockListSearch,
) {
  const token = await requireAccessToken();

  const query: Record<string, unknown> = { page, size };
  if (search?.product_query?.trim()) {
    query.product_query = search.product_query.trim();
  }
  if (search?.logistics_location_name?.trim()) {
    query.logistics_location_name = search.logistics_location_name.trim();
  }
  if (search?.product_barcode?.trim()) {
    query.product_barcode = search.product_barcode.trim();
  }
  if (search?.batch_code?.trim()) {
    query.batch_code = search.batch_code.trim();
  }
  if (search?.memo?.trim()) {
    query.memo = search.memo.trim();
  }
  if (search?.condition?.trim()) {
    query.condition = search.condition.trim();
  }
  if (search?.category_id?.trim()) {
    query.category_id = search.category_id.trim();
  }

  const { data, error } = await listStocks({
    query: query as any,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { message: error };
  }

  return data;
}

/** 대시보드용: 상태·배치별 재고 요약 (물류지 선택 시 필터) */
export type StockSummaryConditionRow = {
  product_id: string;
  condition: "normal" | "refurb" | "disposal" | "undecided";
  quantity: number;
  batch_code?: string | null;
  expiration_date: string;
  product?: { product_code: string; name: string } | null;
};

export async function fetchStockSummaryByProductAndCondition(
  logisticsLocationId?: string | null,
): Promise<StockSummaryConditionRow[] | { message: string }> {
  const token = await requireAccessToken();

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const url = new URL(`${baseURL}/stocks/summary/by-product-and-condition`);
  if (logisticsLocationId) {
    url.searchParams.set("logistics_location_id", logisticsLocationId);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return { message: `재고 요약 조회 실패 (HTTP ${res.status})` };
  }

  const data = (await res.json()) as StockSummaryConditionRow[];
  return Array.isArray(data) ? data : [];
}

/** 전체 재고 이력 (페이지네이션) */
export type StockHistoryListItem = {
  id: string;
  stock_id: string;
  product_id: string;
  quantity: number;
  batch_code?: string | null;
  stock_date: string;
  expiration_date: string;
  action_type: string;
  action_quantity: number;
  update_user_id: string;
  /** user.id = update_user_id 조인 시 user.email */
  update_user_email?: string | null;
  created_at: string;
  reason?: string | null;
  product?: {
    product_code: string;
    name: string;
    description?: string | null;
    category_name?: string | null;
    is_tax?: boolean;
    tax_rate?: string | null;
    state?: "active" | "inactive" | "discontinued" | null;
  } | null;
  logistics_location?: { id: string; name: string } | null;
};

export type PageStockHistoryList = {
  items: StockHistoryListItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
};

export type StockHistoryListSearch = {
  product_query?: string;
  batch_code?: string;
  reason?: string;
  /** StockHistoryActionType 값 (inbound, restock, …) */
  action_type?: string;
};

export async function fetchAllStockHistories(
  page = 1,
  size = 20,
  logisticsLocationId?: string | null,
  search?: StockHistoryListSearch,
): Promise<PageStockHistoryList | { message: string }> {
  const token = await requireAccessToken();

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const url = new URL(`${baseURL}/stocks/histories`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(size));
  if (logisticsLocationId) {
    url.searchParams.set("logistics_location_id", logisticsLocationId);
  }
  if (search?.product_query?.trim()) {
    url.searchParams.set("product_query", search.product_query.trim());
  }
  if (search?.batch_code?.trim()) {
    url.searchParams.set("batch_code", search.batch_code.trim());
  }
  if (search?.reason?.trim()) {
    url.searchParams.set("reason", search.reason.trim());
  }
  if (search?.action_type?.trim()) {
    url.searchParams.set("action_type", search.action_type.trim());
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return { message: `재고 이력 조회 실패 (HTTP ${res.status})` };
  }

  return (await res.json()) as PageStockHistoryList;
}

export async function fetchProductsForStockSelect() {
  const token = await requireAccessToken();

  const { data } = await listProducts({
    query: { page: 1, size: 100 },
    headers: { Authorization: `Bearer ${token}` },
  });

  return data?.items || [];
}

export async function addStock(prevState: {}, formData: FormData) {
  const token = await requireAccessToken();

  const validatedFields = stockSchema.safeParse({
    logistics_location_id: formData.get("logistics_location_id"),
    product_id: formData.get("product_id"),
    quantity: formData.get("quantity"),
    batch_code: formData.get("batch_code"),
    stock_date: formData.get("stock_date") || undefined,
    expiration_date: formData.get("expiration_date"),
    condition: formData.get("condition") || "normal",
    memo: formData.get("memo") || undefined,
    product_barcode: formData.get("product_barcode") || undefined,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const {
    logistics_location_id,
    product_id,
    quantity,
    batch_code,
    stock_date,
    expiration_date,
    condition,
    memo,
    product_barcode,
  } =
    validatedFields.data;

  const { error } = await createStock({
    headers: { Authorization: `Bearer ${token}` },
    body: {
      logistics_location_id,
      product_id,
      quantity,
      batch_code,
      stock_date: stock_date || null,
      expiration_date,
      condition,
      memo: memo?.trim() || null,
      product_barcode: product_barcode?.trim() || null,
    },
  });

  if (error) {
    return { message: `${error.detail}` };
  }

  redirect("/stocks");
}

export async function restockStock(
  stockId: string,
  quantity: number,
  reason?: string | null,
) {
  const token = await requireAccessToken();

  const { error } = await restock({
    headers: { Authorization: `Bearer ${token}` },
    path: { stock_id: stockId },
    body: { quantity, reason: reason ?? undefined },
  });

  if (error) {
    return { message: `${error.detail}` };
  }

  revalidatePath("/stocks");
  return { success: true };
}

export async function updateStockAction(
  stockId: string,
  body: {
    logistics_location_id?: string | null;
    quantity?: number | null;
    batch_code?: string | null;
    stock_date?: string | null;
    expiration_date?: string | null;
    condition?: string | null;
    memo?: string | null;
    product_barcode?: string | null;
  },
) {
  const token = await requireAccessToken();

  const { error } = await updateStock({
    headers: { Authorization: `Bearer ${token}` },
    path: { stock_id: stockId },
    body: body as StockUpdate,
  });

  if (error) {
    return { message: `${error.detail}` };
  }

  revalidatePath("/stocks");
  return { success: true };
}

export async function releaseStockAction(
  stockId: string,
  quantity: number,
  reason?: string | null,
) {
  const token = await requireAccessToken();

  const { error } = await releaseStock({
    headers: { Authorization: `Bearer ${token}` },
    path: { stock_id: stockId },
    body: { quantity, reason: reason ?? undefined },
  });

  if (error) {
    return { message: `${error.detail}` };
  }

  revalidatePath("/stocks");
  return { success: true };
}

export async function changeStockConditionAction(
  stockId: string,
  quantity: number,
  toCondition: "normal" | "refurb" | "disposal" | "undecided",
  reason?: string | null,
) {
  const token = await requireAccessToken();

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const res = await fetch(`${baseURL}/stocks/${stockId}/change-condition`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      quantity,
      to_condition: toCondition,
      reason: reason ?? undefined,
    }),
  });

  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { detail?: string } | null;
    return { message: error?.detail ?? `상태 변경 실패 (HTTP ${res.status})` };
  }

  revalidatePath("/stocks");
  revalidatePath("/stocks/histories");
  return { success: true };
}

export async function transferStockAction(
  stockId: string,
  quantity: number,
  toLogisticsLocationId: string,
  reason?: string | null,
) {
  const token = await requireAccessToken();

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const res = await fetch(`${baseURL}/stocks/${stockId}/transfer`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      quantity,
      to_logistics_location_id: toLogisticsLocationId,
      reason: reason ?? undefined,
    }),
  });

  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { detail?: string } | null;
    return { message: error?.detail ?? `물류지 이동 실패 (HTTP ${res.status})` };
  }

  revalidatePath("/stocks");
  revalidatePath("/stocks/histories");
  return { success: true };
}

export async function fetchStockHistories(
  stockId: string,
  page: number = 1,
  size: number = 10,
) {
  const token = await requireAccessToken();

  const { data, error } = await listStockHistories({
    path: { stock_id: stockId },
    query: { page, size },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { message: error };
  }

  return data;
}

export async function removeStock(
  id: string,
  reason?: string | null,
) {
  const token = await requireAccessToken();

  const { error } = await deleteStock({
    headers: { Authorization: `Bearer ${token}` },
    path: { stock_id: id },
    query: { reason: reason ?? undefined },
  });

  if (error) {
    return { message: error };
  }

  revalidatePath("/stocks");
}
