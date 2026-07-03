"use server";

import { requireAccessToken } from "@/components/actions/auth-token";
import {
  listOrders,
  createOrder,
  createReceiver,
  deleteOrder,
  updateOrder,
  placeOrder,
  listProducts,
  listChannels,
} from "@/app/clientService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { orderFormSchema, receiverSchema } from "@/lib/definitions";
import { z } from "zod";
import type { OrderListRead, PageOrderListRead } from "@/app/openapi-client";

export type OrderListSearch = {
  status?: string;
  channel_ids?: string[];
  channel_id?: string; // backward-compatible
  channel_name?: string;
  receiver_name?: string;
  receiver_phone?: string;
  receiver_zip_code?: string;
  receiver_address?: string;
  invoice_number?: string;
  product_query?: string;
  order_date_start?: string;
  order_date_end?: string;
  /** true일 때 관리자 메모가 1건 이상인 주문만 */
  has_memos?: boolean;
};

function buildOrderListQuery(
  page: number,
  size: number,
  search?: OrderListSearch,
): Record<string, unknown> {
  const query: Record<string, unknown> = { page, size };
  if (search?.status?.trim()) query.status = search.status.trim();
  const channelIds = (search?.channel_ids ?? []).map((s) => s.trim()).filter(Boolean);
  if (channelIds.length > 0) query.channel_ids = channelIds.join(",");
  else if (search?.channel_id?.trim()) query.channel_id = search.channel_id.trim();
  if (search?.channel_name?.trim()) query.channel_name = search.channel_name.trim();
  if (search?.receiver_name?.trim()) query.receiver_name = search.receiver_name.trim();
  if (search?.receiver_phone?.trim()) query.receiver_phone = search.receiver_phone.trim();
  if (search?.receiver_zip_code?.trim()) query.receiver_zip_code = search.receiver_zip_code.trim();
  if (search?.receiver_address?.trim()) query.receiver_address = search.receiver_address.trim();
  if (search?.invoice_number?.trim()) query.invoice_number = search.invoice_number.trim();
  if (search?.product_query?.trim()) query.product_query = search.product_query.trim();
  if (search?.order_date_start?.trim()) query.order_date_start = search.order_date_start.trim();
  if (search?.order_date_end?.trim()) query.order_date_end = search.order_date_end.trim();
  if (search?.has_memos === true) query.has_memos = true;
  return query;
}

export async function fetchOrders(
  page: number = 1,
  size: number = 10,
  search?: OrderListSearch,
) {
  const token = await requireAccessToken();

  const query = buildOrderListQuery(page, size, search);

  const { data, error } = await listOrders({
    query: query as any,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { message: error };
  }

  return data;
}

/** 검색 조건에 맞는 주문 전체 (페이지네이션 반복, size는 API 최대 100) */
export async function fetchAllOrdersForExport(
  search?: OrderListSearch,
): Promise<OrderListRead[] | { message: string }> {
  const token = await requireAccessToken();
  const pageSize = 100;
  const all: OrderListRead[] = [];
  let page = 1;

  for (;;) {
    const { data, error } = await listOrders({
      query: buildOrderListQuery(page, pageSize, search) as any,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) {
      return { message: String((error as { detail?: string })?.detail ?? error) };
    }
    const items = (data?.items ?? []) as OrderListRead[];
    all.push(...items);
    if (items.length < pageSize) break;
    page += 1;
    if (page > 10_000) {
      return { message: "다운로드 한도를 초과했습니다. 검색 조건을 좁혀 주세요." };
    }
  }

  return all;
}

/** 발주 기능 전용: ORDER 상태 주문 전체(최대 1,000건) */
export async function fetchAllOrderStatusOrdersForPlaceOrder(): Promise<
  OrderListRead[] | { message: string }
> {
  const token = await requireAccessToken();
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { message: "API_BASE_URL is not configured" };

  const res = await fetch(`${baseURL}/orders/order/all`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail: string | undefined;
    try {
      const j = (await res.json()) as { detail?: unknown };
      if (typeof j?.detail === "string") detail = j.detail;
    } catch {
      // ignore
    }
    return { message: detail ?? `주문을 불러오지 못했습니다. (HTTP ${res.status})` };
  }

  try {
    return (await res.json()) as OrderListRead[];
  } catch {
    return { message: "주문 응답 형식이 올바르지 않습니다." };
  }
}

export async function fetchOrdersByStatus(
  page: number,
  size: number,
  status: "order" | "order_placed" | "shipping",
  sort?: { sort_by: "created_at" | "order_date" | "updated_at" | "receiver_name"; sort_dir: "asc" | "desc" },
) {
  const token = await requireAccessToken();

  const { data, error } = await listOrders({
    query: { page, size, status, ...(sort ?? {}) } as any,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) return { message: error };
  return data as PageOrderListRead;
}

/** 주문 등록용: ACTIVE 상태 상품만 반환 */
export async function fetchProductsForOrderSelect() {
  const token = await requireAccessToken();

  const { data, error } = await listProducts({
    query: { page: 1, size: 100, state: "active" },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) return [];
  const items = data?.items ?? [];
  return items.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.product_code ?? undefined,
  }));
}

export async function fetchChannelsForOrderSelect() {
  const token = await requireAccessToken();

  const { data, error } = await listChannels({
    query: { page: 1, size: 100 },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) return [];
  return data?.items ?? [];
}

export async function addOrder(prevState: {}, formData: FormData) {
  const token = await requireAccessToken();

  const receiverResult = receiverSchema.safeParse({
    name: formData.get("receiver_name"),
    phone: formData.get("receiver_phone"),
    zip_code: formData.get("receiver_zip_code"),
    address: formData.get("receiver_address"),
    address_detail: formData.get("receiver_address_detail"),
    email: formData.get("receiver_email"),
  });

  const orderResult = orderFormSchema.safeParse({
    channel_id: formData.get("channel_id"),
    price: formData.get("price"),
    memo: formData.get("memo"),
    items_json: formData.get("items_json"),
  });

  const receiverErrors = receiverResult.success
    ? {}
    : (() => {
        const fieldErrors = receiverResult.error.flatten().fieldErrors;
        const prefixed: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(fieldErrors)) {
          prefixed[`receiver_${k}`] = v ?? [];
        }
        return prefixed;
      })();
  const orderErrors = orderResult.success
    ? {}
    : orderResult.error.flatten().fieldErrors;

  if (!receiverResult.success || !orderResult.success) {
    return { errors: { ...receiverErrors, ...orderErrors } };
  }

  const { data: receiver, error: receiverError } = await createReceiver({
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name: receiverResult.data.name,
      phone: receiverResult.data.phone,
      zip_code: receiverResult.data.zip_code,
      address: receiverResult.data.address,
      address_detail: receiverResult.data.address_detail || null,
      email: receiverResult.data.email || null,
    },
  });

  if (receiverError || !receiver) {
    return { message: receiverError ? `${receiverError.detail}` : "수취인 등록에 실패했습니다." };
  }

  const { channel_id, price, memo, items_json } = orderResult.data;

  let items: Array<{ product_id: string; quantity: number }> = [];
  try {
    const parsed = JSON.parse(items_json) as unknown;
    const itemsSchema = z
      .array(
        z.object({
          product_id: z.string().min(1, { message: "상품을 선택해주세요" }),
          quantity: z
            .number()
            .int()
            .positive({ message: "수량은 1 이상의 정수여야 합니다" }),
        }),
      )
      .min(1, { message: "상품을 한 개 이상 추가해주세요" });
    const parsedResult = itemsSchema.safeParse(parsed);
    if (!parsedResult.success) {
      const fieldErrors = parsedResult.error.flatten().fieldErrors as unknown as Record<
        string,
        string[] | undefined
      >;
      return {
        errors: {
          ...receiverErrors,
          ...orderErrors,
          items: fieldErrors[""] ?? ["상품/수량 정보를 확인해주세요"],
        },
      };
    }
    items = parsedResult.data;
  } catch {
    return {
      errors: {
        ...receiverErrors,
        ...orderErrors,
        items: ["상품/수량 정보를 확인해주세요"],
      },
    };
  }

  const { error: orderError } = await createOrder({
    headers: { Authorization: `Bearer ${token}` },
    body: {
      channel_id,
      receiver_id: receiver.id,
      price: Number(price),
      memo: memo || null,
      items: items.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
      })),
    },
  });

  if (orderError) {
    return { message: `${orderError.detail}` };
  }

  redirect("/orders");
}

export async function removeOrder(id: string) {
  const token = await requireAccessToken();

  const { error } = await deleteOrder({
    headers: { Authorization: `Bearer ${token}` },
    path: { order_id: id },
  });

  if (error) {
    return { message: error };
  }

  revalidatePath("/orders");
}

export async function cancelOrder(id: string) {
  const token = await requireAccessToken();

  const { error } = await updateOrder({
    headers: { Authorization: `Bearer ${token}` },
    path: { order_id: id },
    body: { status: "cancelled" as any },
  });

  if (error) {
    const err = error as any;
    return { message: String(err?.detail ?? error) };
  }

  revalidatePath("/orders");
}

export type PlaceOrderResult = { message?: string };

export type PlaceOrderShipmentPayload = {
  items: { product_id: string; quantity: number }[];
};
export type PlaceOrderOrderShipmentsPayload = {
  order_id: string;
  shipments: PlaceOrderShipmentPayload[];
};

export async function placeOrderAction(
  payload:
    | { order_ids: string[] }
    | { order_shipments: PlaceOrderOrderShipmentsPayload[] },
): Promise<PlaceOrderResult> {
  const token = await requireAccessToken();

  const body =
    "order_shipments" in payload && payload.order_shipments.length > 0
      ? { order_shipments: payload.order_shipments }
      : "order_ids" in payload && payload.order_ids.length > 0
        ? { order_ids: payload.order_ids }
        : null;
  if (!body) {
    return { message: "발주할 주문을 선택해 주세요." };
  }

  const { error } = await placeOrder({
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    const err = error as unknown as { detail?: unknown };
    const detail = typeof err.detail === "string" ? err.detail : String(error);
    return { message: detail ?? "발주 처리에 실패했습니다." };
  }

  revalidatePath("/orders");
  return {};
}
