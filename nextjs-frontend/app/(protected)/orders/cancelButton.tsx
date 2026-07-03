"use client";

import { useEffect, useMemo, useState } from "react";
import type { OrderListRead } from "@/app/openapi-client";
import { cancelOrder } from "@/components/actions/orders-action";
import { fetchShipmentsByOrderId, type ShipmentListRead } from "@/components/actions/shipments-action";
import { Button } from "@/components/ui/button";
import { ProductAliasProductDetailDialog } from "@/app/(protected)/product-alias-dicts/product-alias-product-detail-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Ban } from "lucide-react";

interface OrderCancelButtonProps {
  order: OrderListRead;
}

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

export function OrderCancelButton({ order }: OrderCancelButtonProps) {
  const status = (order.status as string | null | undefined) ?? null;
  const isCancelled = status === "cancelled";

  const [open, setOpen] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [shipments, setShipments] = useState<ShipmentListRead[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const orderItems = order.items ?? [];

  const orderProductsNode = (
    orderItems.length === 0 ? (
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
    )
  );

  const receiverAddress = useMemo(() => {
    const r = order.receiver;
    if (!r) return "-";
    return [r.address, r.address_detail].filter(Boolean).join(" ") || "-";
  }, [order.receiver]);

  useEffect(() => {
    if (!open) {
      setShipments(null);
      setError(null);
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
    return () => {
      cancelled = true;
    };
  }, [open, order.id]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground text-amber-700 hover:text-amber-800 hover:bg-accent disabled:opacity-40"
          title={isCancelled ? "이미 취소된 주문입니다." : "취소"}
          aria-label="취소"
          disabled={isCancelled || saving}
        >
          <Ban strokeWidth={2.5} className="w-4 h-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>주문 취소</DialogTitle>
          <DialogDescription>주문/발주 정보를 확인 후 취소를 진행합니다.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">주문 정보</h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted-foreground">주문 ID</dt>
              <dd className=" text-xs break-all">{order.id}</dd>

              <dt className="text-muted-foreground">주문일</dt>
              <dd>{formatDate(order.order_date ?? null)}</dd>

              <dt className="text-muted-foreground">주문 상태</dt>
              <dd>{status ?? "-"}</dd>

              <dt className="text-muted-foreground">채널</dt>
              <dd>{order.channel?.name ?? "-"}</dd>

              <dt className="text-muted-foreground">상품</dt>
              <dd>{orderProductsNode}</dd>

              <dt className="text-muted-foreground">쇼핑몰 상품명</dt>
              <dd>{order.mall_product_name ?? "-"}</dd>

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
            </dl>
          </section>

          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">발주/배송(Shipment) 정보</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">불러오는 중…</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : !shipments || shipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">연결된 발주/배송 정보가 없습니다.</p>
            ) : (
              <div className="grid gap-3">
                {shipments.map((s) => (
                  <div key={s.id} className="rounded-md border p-3">
                    <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
                      <dt className="text-muted-foreground">Shipment ID</dt>
                      <dd className=" text-xs break-all">{s.id}</dd>

                      <dt className="text-muted-foreground">배송번호</dt>
                      <dd className="">{s.invoice_number ?? "-"}</dd>

                      <dt className="text-muted-foreground">발주일</dt>
                      <dd>{formatDate(s.order_placed_date)}</dd>

                      <dt className="text-muted-foreground">배송일</dt>
                      <dd>{formatDate(s.shipping_date ?? null)}</dd>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            닫기
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={saving}
            onPointerDown={(e) => {
              // Prevent "pointerup" landing on the trigger after close (dialog flicker).
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setWarningOpen(true);
              setOpen(false);
            }}
          >
            주문 취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* 경고: 실제 취소 실행 전 최종 확인 */}
    <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>주문 취소 경고</DialogTitle>
          <DialogDescription>
            아래 수취인 정보를 확인한 후 취소를 진행합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          <div className="rounded-md border p-3">
            <dl className="grid gap-2 sm:grid-cols-[6rem_1fr]">
              <dt className="text-muted-foreground">수취인</dt>
              <dd className="font-medium">{order.receiver?.name ?? "-"}</dd>

              <dt className="text-muted-foreground">연락처</dt>
              <dd className=" text-xs">
                {order.receiver?.phone ?? "-"}
              </dd>

              <dt className="text-muted-foreground">상품</dt>
              <dd>{orderProductsNode}</dd>

              <dt className="text-muted-foreground">쇼핑몰 상품명</dt>
              <dd>{order.mall_product_name ?? "-"}</dd>
            </dl>
          </div>
          <p className="text-muted-foreground">
            확인 버튼을 누르면 주문 상태가 취소로 변경됩니다.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => setWarningOpen(false)}
          >
            돌아가기
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={saving}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setSaving(true);
              setWarningOpen(false);
              try {
                await cancelOrder(order.id);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "취소 중..." : "취소"}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  );
}

