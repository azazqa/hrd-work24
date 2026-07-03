import type { ShipmentListRead } from "@/components/actions/shipments-action";
import { downloadCsv } from "@/lib/orders-export-csv";

function csvEscape(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function row(cells: string[]): string {
  return cells.map(csvEscape).join(",");
}

export function formatDateTimeForExport(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

export function shipmentStatusLabelKo(status?: string | null): string {
  if (!status) return "";
  switch (status) {
    case "order":
      return "주문";
    case "order_placed":
      return "발주";
    case "shipping_waiting":
      return "배송 대기";
    case "shipping":
      return "배송";
    default:
      return String(status);
  }
}

export function productsSummaryForExport(s: ShipmentListRead): string {
  const items = s.items ?? [];
  return items
    .map((it) => `[${it.product.product_code}] ${it.product.name} x ${it.quantity}`)
    .join(" | ");
}

const HEADERS = [
  "배송 ID",
  "주문 ID",
  "발주일",
  "배송일",
  "주문일",
  "주문 상태",
  "배송번호",
  "채널",
  "택배사",
  "수취인",
  "연락처",
  "우편번호",
  "주소",
  "상품",
  "수량",
  "메모",
];

export function buildShipmentsCsv(list: ShipmentListRead[]): string {
  const lines = [row(HEADERS)];
  for (const s of list) {
    const r = s.receiver;
    const addr = r
      ? [r.address, r.address_detail].filter(Boolean).join(" ")
      : "";
    lines.push(
      row([
        s.id,
        s.order_id,
        formatDateTimeForExport(s.order_placed_date),
        formatDateTimeForExport(s.shipping_date ?? null),
        formatDateTimeForExport(s.order_date),
        shipmentStatusLabelKo(s.order_status),
        s.invoice_number ?? "",
        s.channel?.name ?? "",
        s.channel?.courier_name ?? "",
        r?.name ?? "",
        r?.phone ?? "",
        r?.zip_code ?? "",
        addr,
        productsSummaryForExport(s),
        String(s.total_quantity ?? ""),
        s.memo ?? "",
      ]),
    );
  }
  return lines.join("\r\n");
}

export function exportShipmentsFilename(prefix: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${prefix}_${stamp}.csv`;
}

export function downloadShipmentsCsv(prefix: string, csvBody: string) {
  downloadCsv(exportShipmentsFilename(prefix), csvBody);
}

