"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, DownloadIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import type { OrderListRead } from "@/app/openapi-client";
import {
  fetchAllOrdersForExport,
  type OrderListSearch,
} from "@/components/actions/orders-action";
import {
  orderStatusLabelKo,
} from "@/lib/orders-export-csv";
import { OrderCancelButton } from "./cancelButton";
import { OrderProductCell } from "./OrderProductCell";
import { PlaceOrderButton } from "./PlaceOrderButton";
import { OrderDetailDialog } from "./order-detail-dialog";
import { OrderMemoDialog } from "./order-memo-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { TrackingLink } from "@/components/tracking/tracking-link";
import { cn } from "@/lib/utils";
import { channelExternalHref } from "@/lib/channel-external-href";
import { ExternalLink } from "lucide-react";
import { ChannelRawDownloadDialog } from "./channel-raw-download-dialog";

function orderStatusBadgeClass(status: string) {
  return (
    status === "order"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 hover:bg-green-100 hover:text-green-700"
      : status === "order_placed"
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-100 hover:text-indigo-700"
        : status === "shipping_waiting"
          ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200 hover:bg-amber-100 hover:text-amber-800"
          : status === "shipping"
            ? "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 hover:bg-sky-100 hover:text-sky-700"
            : status === "cancelled"
              ? "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300 hover:bg-slate-200 hover:text-slate-700"
              : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 hover:bg-sky-200 hover:text-sky-700"
  );
}


function formatDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

type Props = {
  items: OrderListRead[];
  search: OrderListSearch;
};

export function OrdersListWithExport({ items, search }: Props) {
  const [selected, setSelected] = useState<Map<string, OrderListRead>>(
    () => new Map(),
  );
  const [exportingAll, setExportingAll] = useState(false);
  const [channelDownloadOpen, setChannelDownloadOpen] = useState(false);

  const toggleOne = useCallback((order: OrderListRead, checked: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) next.set(order.id, order);
      else next.delete(order.id);
      return next;
    });
  }, []);

  const togglePageAll = useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = new Map(prev);
        for (const o of items) {
          if (checked) next.set(o.id, o);
          else next.delete(o.id);
        }
        return next;
      });
    },
    [items],
  );

  const pageIds = useMemo(() => items.map((o) => o.id), [items]);
  const allOnPage =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));

  const headerChecked: boolean | "indeterminate" = allOnPage
    ? true
    : someOnPage
      ? "indeterminate"
      : false;

  function filenameFromContentDisposition(cd: string | null): string | null {
    if (!cd) return null;
    const mStar = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (mStar?.[1]) {
      try {
        return decodeURIComponent(mStar[1]);
      } catch {
        return mStar[1];
      }
    }
    const m = cd.match(/filename\s*=\s*"?([^";]+)"?/i);
    return m?.[1] ?? null;
  }

  const handleExportSelected = async () => {
    if (selected.size === 0) {
      toast.warning("다운로드할 주문을 선택해 주세요.");
      return;
    }
    const list = Array.from(selected.values());
    try {
      const res = await fetch("/api/orders/export/excel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order_ids: list.map((o) => o.id) }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { detail?: string; message?: string };
        toast.error(
          typeof json.detail === "string"
            ? json.detail
            : typeof json.message === "string"
              ? json.message
              : "다운로드에 실패했습니다.",
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        filenameFromContentDisposition(res.headers.get("content-disposition")) ??
        `orders_selected_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`선택한 ${list.length}건을 다운로드했습니다.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "다운로드에 실패했습니다.");
    }
  };

  const handleExportAll = async () => {
    setExportingAll(true);
    try {
      const qs = new URLSearchParams();
      if (search.status?.trim()) qs.set("status", search.status.trim());
      if (search.channel_id?.trim()) qs.set("channel_id", search.channel_id.trim());
      if (search.channel_name?.trim()) qs.set("channel_name", search.channel_name.trim());
      if (search.receiver_name?.trim()) qs.set("receiver_name", search.receiver_name.trim());
      if (search.receiver_phone?.trim()) qs.set("receiver_phone", search.receiver_phone.trim());
      if (search.receiver_address?.trim()) qs.set("receiver_address", search.receiver_address.trim());
      if (search.invoice_number?.trim()) qs.set("invoice_number", search.invoice_number.trim());
      if (search.product_query?.trim()) qs.set("product_query", search.product_query.trim());
      if (search.order_date_start?.trim()) qs.set("order_date_start", search.order_date_start.trim());
      if (search.order_date_end?.trim()) qs.set("order_date_end", search.order_date_end.trim());
      if (search.has_memos === true) qs.set("has_memos", "true");

      const res = await fetch(`/api/orders/export/excel?${qs.toString()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order_ids: [] }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { detail?: string; message?: string };
        toast.error(
          typeof json.detail === "string"
            ? json.detail
            : typeof json.message === "string"
              ? json.message
              : "다운로드에 실패했습니다.",
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        filenameFromContentDisposition(res.headers.get("content-disposition")) ??
        `orders_all_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("전체 다운로드를 완료했습니다.");
    } finally {
      setExportingAll(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-semibold">주문 목록</h2>
          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant="default" className={orderStatusBadgeClass("order")}>
              주문
            </Badge>
            <Badge variant="default" className={orderStatusBadgeClass("order_placed")}>
              발주
            </Badge>
            <Badge variant="default" className={orderStatusBadgeClass("shipping_waiting")}>
              배송 대기
            </Badge>
            <Badge variant="default" className={orderStatusBadgeClass("shipping")}>
              배송
            </Badge>
            <Badge variant="default" className={orderStatusBadgeClass("cancelled")}>
              취소
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <Button
            type="button"
            className="text-lg px-4 py-2"
            onClick={handleExportSelected}
            disabled={selected.size === 0}
          >
            <DownloadIcon className=" h-4 w-4" />선택 다운로드
          </Button>
          <Button
            type="button"
            className="text-lg px-4 py-2 bg-green-700 text-white hover:bg-green-800"
            onClick={() => void handleExportAll()}
            disabled={exportingAll}
          >
            {exportingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                다운로드 중…
              </>
            ) : (
              <>
                <DownloadIcon className=" h-4 w-4" />전체 다운로드
              </>
            )}
          </Button>
          <Button
            type="button"
            className="text-lg px-4 py-2"
            variant="outline"
            onClick={() => setChannelDownloadOpen(true)}
          >
            <DownloadIcon className="h-4 w-4" />
            채널별 다운로드
          </Button>
          <Separator orientation="vertical" />
          <PlaceOrderButton />
          <Link href="/orders/add">
            <Button className="text-lg px-4 py-2">주문 등록</Button>
          </Link>
          <Link href="/orders/upload">
            <Button className="text-lg px-4 py-2 bg-green-700 text-white hover:bg-green-800">
              <UploadIcon className=" h-4 w-4" />주문 엑셀 업로드
            </Button>
          </Link>
        </div>
      </div>

      <ChannelRawDownloadDialog
        open={channelDownloadOpen}
        onOpenChange={setChannelDownloadOpen}
        search={search}
      />

      <Table className="min-w-full text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-center">
              <span className="sr-only">선택</span>
              <div className="flex justify-center">
                <Checkbox
                  checked={headerChecked}
                  onCheckedChange={(v) => togglePageAll(v === true)}
                  aria-label="현재 페이지 전체 선택"
                  className="border-2 border-primary-foreground/90 shadow-sm ring-offset-2 ring-offset-primary data-[state=checked]:border-primary-foreground data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
                />
              </div>
            </TableHead>
            <TableHead className="w-[80px] text-center">주문일</TableHead>
            <TableHead className="w-[70px] text-center">주문 상태</TableHead>
            <TableHead className="w-[120px] text-center">배송번호</TableHead>
            <TableHead className="w-[120px] text-center">채널</TableHead>
            <TableHead className="w-[200px] text-center">상품</TableHead>
            <TableHead className="w-[100px] text-center">이름</TableHead>
            <TableHead className="w-[150px] text-center">연락처</TableHead>
            <TableHead className="text-center">주소</TableHead>
            <TableHead className="w-[100px] text-center">금액</TableHead>
            <TableHead className="w-[40px] text-center">수량</TableHead>
            <TableHead className="w-[100px] text-center">메모</TableHead>
            <TableHead className="w-[100px] text-center">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!items.length ? (
            <TableRow>
              <TableCell colSpan={13} className="text-center">
                등록된 주문이 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            items.map((order) => {
              const memoCount = order.memo_count ?? 0;
              const hasAdminMemos = memoCount > 0;
              return (
              <TableRow
                key={order.id}
                className={cn(
                  hasAdminMemos &&
                    "border-l-4 border-amber-500/90 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/30",
                )}
              >
                <TableCell className="text-center align-middle">
                  <div className="flex justify-center">
                    <Checkbox
                      checked={selected.has(order.id)}
                      onCheckedChange={(v) => toggleOne(order, v === true)}
                      aria-label={`주문 선택 ${order.id}`}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {formatDate(order.order_date)}
                </TableCell>
                <TableCell className="text-center">
                  {(() => {
                    const status = order.status as string | undefined;
                    return (
                      <Badge
                        variant="default"
                        className={
                          status === "order"
                            ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 hover:bg-green-100 hover:text-green-700"
                            : status === "order_placed"
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-100 hover:text-indigo-700"
                              : status === "shipping_waiting"
                                ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200 hover:bg-amber-100 hover:text-amber-800"
                                : status === "shipping"
                                  ? "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 hover:bg-sky-100 hover:text-sky-700"
                                  : status === "cancelled"
                                    ? "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300 hover:bg-slate-200 hover:text-slate-700"
                                  : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 hover:bg-sky-200 hover:text-sky-700"
                        }
                      >
                        {orderStatusLabelKo(status ?? null) || status || "-"}
                      </Badge>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-center  text-sm">
                  {order.invoice_number ? (
                    <TrackingLink
                      invoiceNumber={order.invoice_number}
                      courierUrlTemplate={order.channel?.courier_url}
                      className="h-auto p-0  text-sm text-primary hover:underline"
                    />
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {(() => {
                    const ch = order.channel;
                    if (!ch?.name) return "-";
                    const href = channelExternalHref(ch.url);
                    if (!href) return ch.name;
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 text-primary hover:underline"
                      >
                        <span>{ch.name}</span>
                        <ExternalLink
                          className="h-3.5 w-3.5 shrink-0 opacity-70"
                          aria-hidden
                        />
                      </a>
                    );
                  })()}
                </TableCell>
                <TableCell className="">
                  <OrderProductCell order={order} />
                </TableCell>
                <TableCell className="text-center">
                  {order.receiver ? (
                    order.receiver.name
                  ) : (
                    <span className=" text-xs text-gray-500">
                      {order.receiver_id.slice(0, 8)}…
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {order.receiver?.phone ?? "-"}
                </TableCell>
                <TableCell className="text-left">
                  <div className="line-clamp-2">
                    {order.receiver
                      ? [order.receiver.address, order.receiver.address_detail]
                          .filter(Boolean)
                          .join(" ") || "-"
                      : "-"}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {Number(order.price).toLocaleString()}
                </TableCell>
                <TableCell className="text-center">{order.quantity}</TableCell>
                <TableCell className="text-gray-600">
                  {order.memo || "-"}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span
                      className={cn(
                        "tabular-nums text-xs min-w-5 text-center",
                        hasAdminMemos
                          ? "font-semibold text-amber-800 dark:text-amber-200"
                          : "text-muted-foreground",
                      )}
                      title="관리자 메모 건수"
                    >
                      {memoCount}
                    </span>
                    <OrderMemoDialog orderId={order.id} />
                    <OrderDetailDialog order={order} />
                    <OrderCancelButton order={order} />
                  </div>
                </TableCell>
              </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </>
  );
}
