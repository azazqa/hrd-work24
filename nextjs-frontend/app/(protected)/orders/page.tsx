import { fetchOrders, type OrderListSearch } from "@/components/actions/orders-action";
import { PageOrderListRead } from "@/app/openapi-client";
import { PagePagination } from "@/components/page-pagination";
import { OrderSearchForm } from "./order-search-form";
import { OrdersListWithExport } from "./orders-list-with-export";
import { CircleHelp } from "lucide-react";
import { redirect } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"


interface OrdersPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    status?: string;
    channel_id?: string;
    channel_ids?: string;
    receiver_name?: string;
    receiver_phone?: string;
    receiver_address?: string;
    invoice_number?: string;
    product_query?: string;
    order_date_start?: string;
    order_date_end?: string;
    has_memos?: string;
  }>;
}

function buildOrderSearchQuery(
  p: Awaited<OrdersPageProps["searchParams"]>,
): string {
  const parts: string[] = [];
  const add = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
  };
  add("order_date_start", p.order_date_start);
  add("order_date_end", p.order_date_end);
  add("status", p.status);
  add("receiver_name", p.receiver_name);
  add("receiver_phone", p.receiver_phone);
  add("receiver_address", p.receiver_address);
  add("invoice_number", p.invoice_number);
  add("channel_id", p.channel_id);
  add("channel_ids", p.channel_ids);
  add("product_query", p.product_query);
  if (p.has_memos === "true" || p.has_memos === "1") {
    parts.push(`${encodeURIComponent("has_memos")}=true`);
  }
  return parts.join("&");
}

function searchFromParams(
  p: Awaited<OrdersPageProps["searchParams"]>,
): OrderListSearch {
  return {
    status: p.status,
    channel_ids: p.channel_ids
      ? p.channel_ids
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
    channel_id: p.channel_id,
    receiver_name: p.receiver_name,
    receiver_phone: p.receiver_phone,
    receiver_address: p.receiver_address,
    invoice_number: p.invoice_number,
    product_query: p.product_query,
    order_date_start: p.order_date_start,
    order_date_end: p.order_date_end,
    has_memos:
      p.has_memos === "true" || p.has_memos === "1" ? true : undefined,
  };
}

function ymdInSeoul(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;

  // 최초 진입(/orders) 시에도 주문일 기본값을 쿼리로 전달한다.
  if (!params.order_date_start || !params.order_date_end) {
    const today = ymdInSeoul(new Date());
    const q = new URLSearchParams();
    q.set("page", String(Number(params.page) || 1));
    q.set("size", String(Number(params.size) || 10));
    q.set("order_date_start", (params.order_date_start ?? today).trim() || today);
    q.set("order_date_end", (params.order_date_end ?? today).trim() || today);
    if (params.status?.trim()) q.set("status", params.status.trim());
    if (params.channel_ids?.trim()) q.set("channel_ids", params.channel_ids.trim());
    else if (params.channel_id?.trim()) q.set("channel_id", params.channel_id.trim());
    if (params.receiver_name?.trim()) q.set("receiver_name", params.receiver_name.trim());
    if (params.receiver_phone?.trim()) q.set("receiver_phone", params.receiver_phone.trim());
    if (params.receiver_address?.trim()) q.set("receiver_address", params.receiver_address.trim());
    if (params.invoice_number?.trim()) q.set("invoice_number", params.invoice_number.trim());
    if (params.product_query?.trim()) q.set("product_query", params.product_query.trim());
    if (params.has_memos === "true" || params.has_memos === "1") q.set("has_memos", "true");
    redirect(`/orders?${q.toString()}`);
  }

  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;

  const extraQuery = buildOrderSearchQuery(params);
  const search = searchFromParams(params);

  const orders = (await fetchOrders(page, size, search)) as
    | PageOrderListRead
    | { message: string };
  const totalPages =
    "message" in orders ? 0 : Math.ceil((orders.total || 0) / size);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        주문 관리
        <Tooltip>
          <TooltipTrigger className="inline-block ml-2">
            <CircleHelp className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>주문 정보를 등록하고 관리할 수 있습니다. 주문 등록 시 수취인 정보도 함께 입력합니다.</p>
          </TooltipContent>
        </Tooltip>
      </h2>

      <section className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-900">
        <OrderSearchForm
          size={size}
          initial={{
            status: params.status,
            receiver_name: params.receiver_name,
            receiver_phone: params.receiver_phone,
            receiver_address: params.receiver_address,
            invoice_number: params.invoice_number,
            channel_id: params.channel_id,
            product_query: params.product_query,
            order_date_start: params.order_date_start,
            order_date_end: params.order_date_end,
            has_memos:
              params.has_memos === "true" || params.has_memos === "1",
          }}
        />
      </section>

      <section className="p-6 bg-white rounded-lg shadow-lg mt-8 dark:bg-gray-900">
        {"message" in orders ? (
          <p className="text-sm text-destructive">{orders.message}</p>
        ) : (
          <OrdersListWithExport items={orders.items ?? []} search={search} />
        )}

        <PagePagination
          currentPage={page}
          totalPages={Math.max(1, totalPages)}
          pageSize={size}
          totalItems={"message" in orders ? 0 : orders.total || 0}
          basePath="/orders"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}
