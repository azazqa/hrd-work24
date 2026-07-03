import type { OrderListRead, OrderStatus } from "@/app/openapi-client";

export function orderStatusLabelKo(status?: OrderStatus | string | null): string {
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
    case "cancelled":
      return "취소";
    default:
      return String(status);
  }
}

export function formatOrderDateForExport(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

export function productSummaryForExport(order: OrderListRead): string {
  const items = order.items ?? [];
  return items
    .map((it) => {
      const p = it.product;
      const label = p ? `[${p.product_code}] ${p.name}` : it.product_id;
      return `${label} x ${it.quantity}`;
    })
    .join(" | ");
}

function csvEscape(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function row(cells: string[]): string {
  return cells.map(csvEscape).join(",");
}

const HEADERS = [
  "주문 ID",
  "주문일",
  "주문 상태",
  "배송번호",
  "채널",
  "택배사",
  "상품",
  "수취인",
  "연락처",
  "우편번호",
  "주소",
  "금액",
  "수량",
  "메모",
];

export function buildOrdersCsv(orders: OrderListRead[]): string {
  const lines = [row(HEADERS)];
  for (const o of orders) {
    const addr = o.receiver
      ? [o.receiver.address, o.receiver.address_detail].filter(Boolean).join(" ")
      : "";
    lines.push(
      row([
        o.id,
        formatOrderDateForExport(o.order_date ?? null),
        orderStatusLabelKo(o.status ?? null),
        o.invoice_number ?? "",
        o.channel?.name ?? "",
        o.channel?.courier_name ?? "",
        productSummaryForExport(o),
        o.receiver?.name ?? "",
        o.receiver?.phone ?? "",
        o.receiver?.zip_code ?? "",
        addr,
        String(o.price ?? ""),
        String(o.quantity ?? ""),
        o.memo ?? "",
      ]),
    );
  }
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, csvBody: string) {
  const blob = new Blob(["\uFEFF", csvBody], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportOrdersFilename(prefix: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${prefix}_${stamp}.csv`;
}
