"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { OrderListRead, OrderStatus } from "@/app/openapi-client";
import { fetchShipmentsByOrderId, type ShipmentListRead } from "@/components/actions/shipments-action";
import { ProductAliasProductDetailDialog } from "@/app/(protected)/product-alias-dicts/product-alias-product-detail-dialog";
import { TrackingLink } from "@/components/tracking/tracking-link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

function orderStatusLabelKo(status?: OrderStatus | string | null): string {
  if (!status) return "-";
  const raw = String(status);
  const key = raw.replace(/^.*\./, "").toLowerCase();
  switch (key) {
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
      return raw;
  }
}

function orderHistoryActionTypeLabelKo(actionType?: string | null): string {
  if (!actionType) return "-";
  const raw = String(actionType);
  const key = raw.replace(/^.*\./, "").toLowerCase();
  switch (key) {
    case "created":
      return "생성";
    case "updated":
      return "수정";
    case "status_changed":
      return "상태 변경";
    case "placed":
      return "발주";
    case "shipping_waiting":
      return "배송 대기";
    case "shipping":
      return "배송";
    case "cancelled":
      return "취소";
    case "deleted":
      return "삭제";
    default:
      return raw;
  }
}

function orderHistoryReasonLabelKo(reason?: string | null): string {
  const r = (reason ?? "").trim();
  if (!r) return "-";
  const key = r.replace(/^.*\./, "").toLowerCase();
  switch (key) {
    case "create_order":
      return "주문 생성";
    case "update_order":
      return "주문 수정";
    case "delete_order":
      return "주문 삭제";
    case "place_order":
      return "발주 처리";
    case "place_order(consolidated)":
      return "발주 처리(합배송)";
    case "order_placed_excel_download":
      return "발주서 다운로드";
    case "mark_shipping_waiting":
      return "배송대기 일괄 전환";
    case "invoice_upload":
      return "송장 업로드";
    default:
      return r;
  }
}

export function OrderDetailDialog({ order }: { order: OrderListRead }) {
  const [open, setOpen] = useState(false);
  const [shipments, setShipments] = useState<ShipmentListRead[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [histories, setHistories] = useState<
    Array<{
      id: string;
      created_at?: string;
      action_type?: string;
      reason?: string | null;
      from_status?: string | null;
      to_status?: string | null;
    }>
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setShipments(null);
      setError(null);
      setHistories([]);
      setHistoryError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchShipmentsByOrderId(order.id).then((res) => {
      if (cancelled) return;
      if (Array.isArray(res)) {
        setShipments(res);
      } else {
        setError(res.message);
        setShipments(null);
      }
      setLoading(false);
    });

    setHistoryLoading(true);
    setHistoryError(null);
    void fetch(`/api/orders/${encodeURIComponent(order.id)}/histories?page=1&size=20`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          throw new Error(t || `Failed to load histories (HTTP ${r.status})`);
        }
        const json = (await r.json()) as { items?: any[] };
        const items = Array.isArray(json.items) ? json.items : [];
        setHistories(
          items.map((it) => ({
            id: String(it.id),
            created_at: it.created_at ? String(it.created_at) : undefined,
            action_type: it.action_type ? String(it.action_type) : undefined,
            reason: it.reason ?? null,
            from_status: it.from_status ?? null,
            to_status: it.to_status ?? null,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setHistoryError("이력을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, order.id]);

  const receiverAddress = useMemo(() => {
    const r = order.receiver;
    if (!r) return "-";
    return [r.address, r.address_detail].filter(Boolean).join(" ") || "-";
  }, [order.receiver]);

  const orderItems = order.items ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="상세"
          aria-label="상세"
        >
          <Search className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>주문 상세</DialogTitle>
          <DialogDescription>주문 정보와 배송(Shipment) 정보를 확인합니다.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 max-h-[75vh] overflow-y-auto">
          {order.consolidated_to_order_id && (
            <div className="rounded border border-sky-400 bg-sky-50/70 dark:border-sky-500 dark:bg-sky-950/30 p-3 text-sm">
              <span className="font-medium text-sky-800 dark:text-sky-200">합배송</span>
              <span className="ml-2 text-muted-foreground">
                이 주문은 대표 주문
              </span>
              <span className="ml-1  text-xs break-all">
                {order.consolidated_to_order_id}
              </span>
              <span className="ml-1 text-muted-foreground">의 하위 주문으로 묶였습니다.</span>
            </div>
          )}
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">주문 정보</h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted-foreground">주문 ID</dt>
              <dd className=" break-all">{order.id}</dd>

              <dt className="text-muted-foreground">주문일</dt>
              <dd>{formatDate(order.order_date ?? null)}</dd>

              <dt className="text-muted-foreground">주문 상태</dt>
              <dd>{orderStatusLabelKo(order.status ?? null)}</dd>

              <dt className="text-muted-foreground">배송번호</dt>
              <dd className="">
                {order.invoice_number ? (
                  <TrackingLink
                    invoiceNumber={order.invoice_number}
                    courierUrlTemplate={order.channel?.courier_url}
                    className="h-auto p-0  text-sm text-primary hover:underline"
                  />
                ) : (
                  "-"
                )}
              </dd>

              <dt className="text-muted-foreground">채널</dt>
              <dd>{order.channel?.name ?? "-"}</dd>

              <dt className="text-muted-foreground">쇼핑몰 상품명</dt>
              <dd>{order.mall_product_name ?? "-"}</dd>

              <dt className="text-muted-foreground">택배사</dt>
              <dd>{order.channel?.courier_name?.trim() ? order.channel.courier_name : "-"}</dd>

              <dt className="text-muted-foreground">상품</dt>
              <dd>
                {orderItems.length === 0 ? (
                  "-"
                ) : (
                  <ul className="space-y-2">
                    {orderItems.map((it, idx) => {
                      const p = it.product;
                      const label = p
                        ? `[${p.product_code}] ${p.name} × ${it.quantity}`
                        : `${it.product_id} × ${it.quantity}`;
                      return (
                        <li key={`${it.product_id}-${idx}`}>
                          {p ? (
                            <ProductAliasProductDetailDialog
                              productId={it.product_id}
                              label={label}
                            />
                          ) : (
                            <span className=" text-xs">{label}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </dd>

              <dt className="text-muted-foreground">수취인</dt>
              <dd>{order.receiver?.name ?? "-"}</dd>

              <dt className="text-muted-foreground">연락처</dt>
              <dd>{order.receiver?.phone ?? "-"}</dd>

              <dt className="text-muted-foreground">우편번호</dt>
              <dd>{order.receiver?.zip_code ?? "-"}</dd>

              <dt className="text-muted-foreground">주소</dt>
              <dd className="wrap-break-word">{receiverAddress}</dd>

              <dt className="text-muted-foreground">금액</dt>
              <dd>{Number(order.price).toLocaleString()}</dd>

              <dt className="text-muted-foreground">총 수량</dt>
              <dd>{order.quantity}</dd>

              <dt className="text-muted-foreground">메모</dt>
              <dd className="wrap-break-word">{order.memo ?? "-"}</dd>
            </dl>
          </section>

          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">주문 이력</h3>
            {historyLoading ? (
              <p className="text-sm text-muted-foreground">불러오는 중…</p>
            ) : historyError ? (
              <p className="text-sm text-destructive">{historyError}</p>
            ) : histories.length === 0 ? (
              <p className="text-sm text-muted-foreground">이력이 없습니다.</p>
            ) : (
              <div className="grid gap-2">
                {histories.map((h) => (
                  <div key={h.id} className="rounded-md border p-3">
                    <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
                      <dt className="text-muted-foreground">일시</dt>
                      <dd>{formatDate(h.created_at ?? null)}</dd>
                      <dt className="text-muted-foreground">유형</dt>
                      <dd className="">
                        {orderHistoryActionTypeLabelKo(h.action_type)}
                      </dd>
                      <dt className="text-muted-foreground">상태</dt>
                      <dd className="">
                        {h.from_status || h.to_status
                          ? `${orderStatusLabelKo(h.from_status)} → ${orderStatusLabelKo(h.to_status)}`
                          : "-"}
                      </dd>
                      <dt className="text-muted-foreground">사유</dt>
                      <dd className="wrap-break-word">
                        {orderHistoryReasonLabelKo(h.reason)}
                      </dd>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">배송 정보</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">불러오는 중…</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : !shipments || shipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">연결된 배송 정보가 없습니다.</p>
            ) : (
              <div className="grid gap-3">
                {shipments.map((s) => (
                  <div key={s.id} className="rounded-md border p-3">
                    <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
                      <dt className="text-muted-foreground">배송번호</dt>
                      <dd className="">{s.invoice_number ?? "-"}</dd>

                      <dt className="text-muted-foreground">발주일</dt>
                      <dd>{formatDate(s.order_placed_date)}</dd>

                      <dt className="text-muted-foreground">배송일</dt>
                      <dd>{formatDate(s.shipping_date ?? null)}</dd>

                      <dt className="text-muted-foreground">상품</dt>
                      <dd>
                        {(s.items ?? []).length === 0 ? (
                          "-"
                        ) : (
                          <ul className="space-y-2">
                            {s.items.map((it, idx) => (
                              <li key={`${it.product.id}-${idx}`}>
                                <ProductAliasProductDetailDialog
                                  productId={it.product.id}
                                  label={`[${it.product.product_code}] ${it.product.name} × ${it.quantity}`}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </dd>

                      <dt className="text-muted-foreground">수량</dt>
                      <dd>{Number(s.total_quantity ?? 0).toLocaleString()}</dd>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
