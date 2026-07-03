"use client";

import { useCallback, useMemo, useState } from "react";
import { DownloadIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { ShipmentListRead, ShipmentListSearch } from "@/components/actions/shipments-action";
import {
  downloadAllShipmentsExcel,
  downloadSelectedShipmentsExcel,
} from "@/components/actions/shipments-action";
import { shipmentStatusLabelKo } from "@/lib/shipments-export-csv";
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
import { TrackingLink } from "@/components/tracking/tracking-link";
import { formatDateTimeInSeoul } from "@/lib/date-utils";
import { channelExternalHref } from "@/lib/channel-external-href";
import { ExternalLink } from "lucide-react";
import { OrderPlacedExcelDownloadButton } from "./OrderPlacedExcelDownloadButton";
import { InvoiceExcelUploadButton } from "./InvoiceExcelUploadButton";

type Props = {
  items: ShipmentListRead[];
  search: ShipmentListSearch;
};

function addressText(r: ShipmentListRead["receiver"]) {
  if (!r) return "-";
  const addr = `${r.address} ${r.address_detail ?? ""}`.trim();
  return addr || "-";
}

function productsText(items: ShipmentListRead["items"]) {
  if (!items?.length) return "-";
  return items
    .map((it) => `[${it.product.product_code}] ${it.product.name} x ${it.quantity}`)
    .join("\n");
}

function orderStatusBadgeClass(status: string) {
  return (
    status === "order"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 hover:bg-red-100 hover:text-red-700"
      : status === "order_placed"
        ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 hover:bg-cyan-100 hover:text-cyan-700"
        : status === "shipping_waiting"
          ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200 hover:bg-amber-100 hover:text-amber-800"
          : status === "shipping"
            ? "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 hover:bg-sky-100 hover:text-sky-700"
            : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 hover:bg-sky-200 hover:text-sky-700"
  );
}

export function ShipmentsListWithExport({ items, search }: Props) {
  const [selected, setSelected] = useState<Map<string, ShipmentListRead>>(
    () => new Map(),
  );
  const [exportingAll, setExportingAll] = useState(false);

  const toggleOne = useCallback((s: ShipmentListRead, checked: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) next.set(s.id, s);
      else next.delete(s.id);
      return next;
    });
  }, []);

  const togglePageAll = useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = new Map(prev);
        for (const s of items) {
          if (checked) next.set(s.id, s);
          else next.delete(s.id);
        }
        return next;
      });
    },
    [items],
  );

  const pageIds = useMemo(() => items.map((s) => s.id), [items]);
  const allOnPage =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));
  const headerChecked: boolean | "indeterminate" = allOnPage
    ? true
    : someOnPage
      ? "indeterminate"
      : false;

  const handleExportSelected = () => {
    if (selected.size === 0) {
      toast.warning("다운로드할 배송을 선택해 주세요.");
      return;
    }
    const ids = Array.from(selected.keys());
    void (async () => {
      const res = await downloadSelectedShipmentsExcel(ids);
      if ("message" in res) {
        toast.error(res.message);
        return;
      }
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`선택한 ${ids.length}건을 다운로드했습니다.`);
    })();
  };

  const handleExportAll = async () => {
    setExportingAll(true);
    try {
      const res = await downloadAllShipmentsExcel(search);
      if ("message" in res) {
        toast.error(res.message);
        return;
      }
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
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
        <h2 className="text-xl font-semibold">배송 목록</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            className="text-lg px-4 py-2"
            onClick={handleExportSelected}
            disabled={selected.size === 0}
          >
            <DownloadIcon className=" h-4 w-4" />
            선택 다운로드
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
                <DownloadIcon className=" h-4 w-4" />
                전체 다운로드
              </>
            )}
          </Button>
          <OrderPlacedExcelDownloadButton />
          <InvoiceExcelUploadButton />
        </div>
      </div>

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
            <TableHead className="w-[120px] text-center">주문 상태</TableHead>
            <TableHead className="w-[140px] text-center">배송번호</TableHead>
            <TableHead className="w-[120px] text-center">채널</TableHead>
            <TableHead className="w-[100px] text-center">이름</TableHead>
            <TableHead className="w-[140px] text-center">연락처</TableHead>
            <TableHead className="w-[90px] text-center">우편번호</TableHead>
            <TableHead className="text-center">주소</TableHead>
            <TableHead className="w-[250px] text-center">상품</TableHead>
            <TableHead className="w-[70px] text-center">수량</TableHead>
            <TableHead className="w-[110px] text-center">메모</TableHead>
            <TableHead className="w-[110px] text-center">주문일</TableHead>
            <TableHead className="w-[110px] text-center">발주일</TableHead>
            <TableHead className="w-[110px] text-center">배송일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!items?.length ? (
            <TableRow>
              <TableCell colSpan={14} className="text-center">
                등록된 배송이 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            items.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-center align-middle">
                  <div className="flex justify-center">
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={(v) => toggleOne(s, v === true)}
                      aria-label={`배송 선택 ${s.id}`}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="default"
                    className={orderStatusBadgeClass(s.order_status)}
                  >
                    {shipmentStatusLabelKo(s.order_status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {s.invoice_number ? (
                    <TrackingLink
                      invoiceNumber={s.invoice_number}
                      courierUrlTemplate={s.channel?.courier_url}
                      className="h-auto p-0  text-sm text-primary hover:underline"
                    />
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {(() => {
                    const ch = s.channel;
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
                <TableCell className="text-center">
                  {s.receiver?.name ?? "-"}
                </TableCell>
                <TableCell className="text-center">
                  {s.receiver?.phone ?? "-"}
                </TableCell>
                <TableCell className="text-center">
                  {s.receiver?.zip_code ?? "-"}
                </TableCell>
                <TableCell className="whitespace-pre-line text-sm text-gray-700">
                  {addressText(s.receiver)}
                </TableCell>
                <TableCell className="whitespace-pre-line text-sm">
                  {productsText(s.items)}
                </TableCell>
                <TableCell className="text-center font-medium">
                  {s.total_quantity?.toLocaleString?.("ko-KR") ?? s.total_quantity}
                </TableCell>
                <TableCell className="whitespace-pre-line text-sm">
                  {s.memo ?? "-"}
                </TableCell>
                <TableCell className="text-center">
                  {formatDateTimeInSeoul(s.order_date)}
                </TableCell>
                <TableCell className="text-center">
                  {formatDateTimeInSeoul(s.order_placed_date)}
                </TableCell>
                <TableCell className="text-center">
                  {formatDateTimeInSeoul(s.shipping_date)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}

