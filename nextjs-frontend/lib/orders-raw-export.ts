import type { OrderListSearch } from "@/components/actions/orders-action";

/**
 * orders 목록 화면의 search를 그대로 query로 직렬화한다.
 * (OrdersPage의 buildOrderSearchQuery와 동일한 규칙 유지)
 */
export function buildOrdersSearchParams(search: OrderListSearch): URLSearchParams {
  const p = new URLSearchParams();
  const add = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) p.set(k, t);
  };
  add("order_date_start", search.order_date_start);
  add("order_date_end", search.order_date_end);
  add("status", search.status);
  add("receiver_name", search.receiver_name);
  add("receiver_phone", search.receiver_phone);
  add("receiver_zip_code", search.receiver_zip_code);
  add("receiver_address", search.receiver_address);
  add("invoice_number", search.invoice_number);
  add("channel_id", search.channel_id);
  add("channel_name", search.channel_name);
  add("product_query", search.product_query);
  if (search.has_memos === true) p.set("has_memos", "true");
  return p;
}

export function buildChannelRawPreviewUrl(search: OrderListSearch, channelId: string): string {
  const p = buildOrdersSearchParams(search);
  p.set("channel_id", channelId);
  p.delete("channel_name");
  return `/api/orders/export/raw-by-channel/preview?${p.toString()}`;
}

export function buildChannelRawDownloadUrl(search: OrderListSearch, channelId: string): string {
  const p = buildOrdersSearchParams(search);
  p.set("channel_id", channelId);
  p.delete("channel_name");
  return `/api/orders/export/raw-by-channel?${p.toString()}`;
}

