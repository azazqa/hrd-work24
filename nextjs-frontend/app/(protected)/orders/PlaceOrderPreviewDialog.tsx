"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { placeOrderAction } from "@/components/actions/orders-action";
import type { OrderListRead, OrderItemListRead } from "@/app/openapi-client/types.gen";
import { fetchAllOrderStatusOrdersForPlaceOrder, fetchOrdersByStatus } from "@/components/actions/orders-action";
import type { PageOrderListRead } from "@/app/openapi-client";
import { cn } from "@/lib/utils";
import { ConsolidateOrdersDialog } from "./ConsolidateOrdersDialog";

/** rep 주문 + 합배송 하위 주문들의 상품(product_id)별 수량을 합산. */
function aggregatedItems(
  repOrder: OrderListRead,
  subOrders: OrderListRead[],
): Array<{ product_id: string; quantity: number; product?: OrderItemListRead["product"] }> {
  const map = new Map<
    string,
    { product_id: string; quantity: number; product?: OrderItemListRead["product"] }
  >();
  for (const o of [repOrder, ...subOrders]) {
    for (const it of o.items ?? []) {
      const existing = map.get(it.product_id);
      if (existing) {
        existing.quantity += it.quantity;
      } else {
        map.set(it.product_id, {
          product_id: it.product_id,
          quantity: it.quantity,
          product: it.product,
        });
      }
    }
  }
  return Array.from(map.values());
}

/** 주문 정보만 (채널, 수취인, 상품/수량) - 읽기 전용 */
function OrderBlock({
  className,
  order,
  subOrders = [],
}: {
  className: string;
  order: OrderListRead;
  subOrders?: OrderListRead[];
}) {
  const r = order.receiver;
  const items = subOrders.length
    ? aggregatedItems(order, subOrders)
    : (order.items ?? []).map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        product: i.product,
      }));

  return (
    <div className={cn("rounded border bg-muted/30 p-3 space-y-1.5 text-sm", className)}>
      <div className="grid grid-cols-1 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="flex gap-1.5">
            <span className="text-muted-foreground shrink-0">채널:</span>
            <span>{order.channel?.name ?? "-"}</span>
          </div>
          <div className="flex gap-1.5">
            <span className="text-muted-foreground shrink-0">쇼핑몰 상품명:</span>
            <span>{order.mall_product_name ?? "-"}</span>
          </div>
        </div>
        <div>
          {r && (
            <>
              <div className="flex gap-1.5">
                <span className="text-muted-foreground shrink-0">수취인:</span>
                <span>{r.name}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="text-muted-foreground shrink-0">연락처:</span>
                <span>{r.phone}</span>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="pt-1.5 border-t mt-1.5">
        <div className="text-muted-foreground text-xs mb-1">
          {subOrders.length > 0 ? "합산 상품 / 수량" : "상품 / 수량"}
        </div>
        <ul className="space-y-0.5">
          {items.length
            ? items.map((item, idx) => (
                <li key={`${item.product_id}-${idx}`} className="flex justify-between gap-2">
                  <span className="truncate">
                    {item.product?.name ?? item.product?.product_code ?? item.product_id}
                  </span>
                  <span className="shrink-0 ">{item.quantity}개</span>
                </li>
              ))
            : "-"}
        </ul>
      </div>
    </div>
  );
}

/** 주문 그룹(rep + subs)의 상품 옵션 (product_id -> 라벨) */
function groupProductOptions(
  repOrder: OrderListRead,
  subOrders: OrderListRead[],
): { value: string; label: string }[] {
  const agg = aggregatedItems(repOrder, subOrders);
  return agg.map((it) => ({
    value: it.product_id,
    label: it.product?.name ?? it.product?.product_code ?? it.product_id,
  }));
}

type ShipmentEdit = { items: { product_id: string; quantity: number }[] };

function ShipmentEditBlock({
  repOrder,
  shipment,
  shipmentIndex,
  productOptions,
  onUpdate,
  onRemove,
  onAddShipment,
  canRemove,
}: {
  repOrder: OrderListRead;
  shipment: ShipmentEdit;
  shipmentIndex: number;
  productOptions: { value: string; label: string }[];
  onUpdate: (s: ShipmentEdit) => void;
  onRemove: () => void;
  onAddShipment: () => void;
  canRemove: boolean;
}) {
  function addRow() {
    const firstId =
      productOptions[0]?.value ?? repOrder.items?.[0]?.product_id ?? "";
    onUpdate({
      items: [...shipment.items, { product_id: firstId, quantity: 1 }],
    });
  }
  function removeRow(idx: number) {
    onUpdate({
      items: shipment.items.filter((_, i) => i !== idx),
    });
  }
  function setRow(idx: number, field: "product_id" | "quantity", value: string | number) {
    const next = [...shipment.items];
    if (field === "quantity") next[idx] = { ...next[idx], quantity: Number(value) || 0 };
    else next[idx] = { ...next[idx], product_id: value as string };
    onUpdate({ items: next });
  }

  return (
    <div className="rounded border border-dashed bg-background/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">발주 {shipmentIndex + 1}</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={onAddShipment}
          >
            + 발주 추가
          </Button>
          <Button
            type="button"
            disabled={!canRemove}
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={onRemove}
          >
            발주 삭제
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        {shipment.items.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Select
              value={row.product_id}
              onValueChange={(v) => setRow(idx, "product_id", v)}
            >
              <SelectTrigger className="flex-1 min-w-0 h-8 text-sm">
                <SelectValue placeholder="상품" />
              </SelectTrigger>
              <SelectContent>
                {productOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label className="sr-only">수량</Label>
            <Input
              type="number"
              min={1}
              className="w-20 h-8 text-sm text-right"
              value={row.quantity}
              onChange={(e) => setRow(idx, "quantity", e.target.value)}
            />
            <span className="text-xs text-muted-foreground shrink-0">개</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => removeRow(idx)}
            >
              ×
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs" onClick={addRow}>
          + 상품 추가
        </Button>
      </div>
    </div>
  );
}

/** rep+subs 상품 합계와 발주 상품 합계가 일치하는지 검증 */
function validateGroupShipments(
  repOrder: OrderListRead,
  subOrders: OrderListRead[],
  shipments: ShipmentEdit[],
): boolean {
  const orderTotals = new Map<string, number>();
  for (const o of [repOrder, ...subOrders]) {
    for (const item of o.items ?? []) {
      orderTotals.set(item.product_id, (orderTotals.get(item.product_id) ?? 0) + item.quantity);
    }
  }
  const shipTotals = new Map<string, number>();
  for (const sh of shipments) {
    for (const it of sh.items) {
      shipTotals.set(it.product_id, (shipTotals.get(it.product_id) ?? 0) + it.quantity);
    }
  }
  if (orderTotals.size !== shipTotals.size) return false;
  for (const [pid, q] of orderTotals) {
    if (shipTotals.get(pid) !== q) return false;
  }
  return true;
}

interface PlaceOrderPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderListRead[];
  total?: number;
  pageSize?: number;
  onSuccess?: () => void;
}

const emptyShipment = (): ShipmentEdit => ({ items: [] });

function initialShipmentsForGroup(
  repOrder: OrderListRead,
  subOrders: OrderListRead[],
): ShipmentEdit[] {
  const items = aggregatedItems(repOrder, subOrders).map((i) => ({
    product_id: i.product_id,
    quantity: i.quantity,
  }));
  return items.length ? [{ items }] : [{ items: [] }];
}

type ConsolidationGroups = Record<string, string[]>;

export function PlaceOrderPreviewDialog({
  open,
  onOpenChange,
  orders,
  total = orders.length,
  pageSize = orders.length || 10,
  onSuccess,
}: PlaceOrderPreviewDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [orderShipments, setOrderShipments] = useState<Record<string, ShipmentEdit[]>>({});
  const [removedOrderIds, setRemovedOrderIds] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<ConsolidationGroups>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [pagedOrders, setPagedOrders] = useState<OrderListRead[]>(orders);
  const [consolidateTarget, setConsolidateTarget] = useState<string | null>(null);
  const [allOrdersCache, setAllOrdersCache] = useState<OrderListRead[] | null>(null);
  const [allOrdersLoading, setAllOrdersLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 10)));

  // 다른 그룹에 이미 속한 주문(rep 자신 제외한 sub ids 전체 합집합)
  const allLockedSubIds = useMemo(() => {
    const s = new Set<string>();
    for (const subs of Object.values(groups)) {
      for (const id of subs) s.add(id);
    }
    return s;
  }, [groups]);

  const repIdsSet = useMemo(() => new Set(Object.keys(groups)), [groups]);

  // 순회 시 "rep이 아닌 subs"는 숨긴다.
  const visibleOrders = useMemo(
    () =>
      pagedOrders.filter(
        (o) => !removedOrderIds.has(o.id) && !allLockedSubIds.has(o.id),
      ),
    [pagedOrders, removedOrderIds, allLockedSubIds],
  );

  const duplicateReceiverNameSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of visibleOrders) {
      const n = (o.receiver?.name ?? "").trim();
      if (!n) continue;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    const out = new Set<string>();
    for (const [n, c] of counts) {
      if (c > 1) out.add(n);
    }
    return out;
  }, [visibleOrders]);

  useEffect(() => {
    if (open && orders.length) {
      setCurrentPage(1);
      setPagedOrders(orders);
      const next: Record<string, ShipmentEdit[]> = {};
      for (const o of orders) {
        next[o.id] = initialShipmentsForGroup(o, []);
      }
      setOrderShipments(next);
      setRemovedOrderIds(new Set());
      setGroups({});
      setAllOrdersCache(null);
      setMessage(null);
    }
  }, [open, orders]);

  useEffect(() => {
    if (!open) return;
    if (currentPage === 1) {
      setPagedOrders(orders);
      return;
    }
    let cancelled = false;
    (async () => {
      setPageLoading(true);
      try {
        const res = await fetchOrdersByStatus(currentPage, pageSize, "order", {
          sort_by: "receiver_name",
          sort_dir: "asc",
        });
        if (cancelled) return;
        if ("message" in (res as any)) {
          setMessage("주문을 불러오지 못했습니다.");
          return;
        }
        const page = res as PageOrderListRead;
        const items = (page.items ?? []) as OrderListRead[];
        setPagedOrders(items);
        setOrderShipments((prev) => {
          const next = { ...prev };
          for (const o of items) {
            if (!next[o.id]) next[o.id] = initialShipmentsForGroup(o, []);
          }
          return next;
        });
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentPage, pageSize, orders]);

  async function ensureAllOrdersLoaded(): Promise<OrderListRead[] | null> {
    if (allOrdersCache) return allOrdersCache;
    setAllOrdersLoading(true);
    try {
      const res = await fetchAllOrderStatusOrdersForPlaceOrder();
      if ("message" in (res as any)) {
        setMessage((res as any).message ?? "주문을 불러오지 못했습니다.");
        return null;
      }
      const list = res as OrderListRead[];
      setAllOrdersCache(list);
      return list;
    } finally {
      setAllOrdersLoading(false);
    }
  }

  const addShipment = (orderId: string) => {
    setOrderShipments((prev) => ({
      ...prev,
      [orderId]: [...(prev[orderId] ?? []), emptyShipment()],
    }));
  };

  const removeShipment = (orderId: string, index: number) => {
    setOrderShipments((prev) => {
      const list = (prev[orderId] ?? []).filter((_, i) => i !== index);
      return list.length ? { ...prev, [orderId]: list } : prev;
    });
  };

  const updateShipment = (orderId: string, index: number, shipment: ShipmentEdit) => {
    setOrderShipments((prev) => {
      const list = [...(prev[orderId] ?? [])];
      list[index] = shipment;
      return { ...prev, [orderId]: list };
    });
  };

  /**
   * 합배송 다이얼로그에서 확정된 하위 주문 id 목록을 반영한다.
   * 기존 shipments 할당은 재구성(하위 주문 items를 포함해 1건 기본 발주로)된다.
   */
  function applyConsolidation(repOrderId: string, subOrderIds: string[]) {
    setGroups((prev) => {
      const next = { ...prev };
      if (subOrderIds.length === 0) {
        delete next[repOrderId];
      } else {
        next[repOrderId] = subOrderIds;
      }
      return next;
    });

    const rep =
      (allOrdersCache ?? pagedOrders).find((o) => o.id === repOrderId) ?? null;
    if (!rep) return;
    const subs: OrderListRead[] = [];
    for (const sid of subOrderIds) {
      const found = (allOrdersCache ?? pagedOrders).find((o) => o.id === sid);
      if (found) subs.push(found);
    }
    setOrderShipments((prev) => ({
      ...prev,
      [repOrderId]: initialShipmentsForGroup(rep, subs),
    }));
  }

  function scrollToOrder(orderId: string) {
    const el = document.getElementById(`order-block-${orderId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function handleRemoveOrder(orderId: string) {
    if (typeof window !== "undefined" && !window.confirm("이 주문을 발주 대상에서 제외하시겠습니까?")) return;
    setRemovedOrderIds((prev) => new Set([...prev, orderId]));
    // rep이면 그룹 해제, sub이면 해당 그룹에서 제거
    setGroups((prev) => {
      const next: ConsolidationGroups = {};
      for (const [rep, subs] of Object.entries(prev)) {
        if (rep === orderId) continue;
        const filtered = subs.filter((s) => s !== orderId);
        if (filtered.length) next[rep] = filtered;
      }
      return next;
    });
  }

  async function openConsolidateDialog(orderId: string) {
    const list = await ensureAllOrdersLoaded();
    if (!list) return;
    setConsolidateTarget(orderId);
  }

  // 개별 그룹에 속한 하위 주문 lookup 맵 (다른 그룹 판단용)
  function getOtherGroupLockedIds(forRepId: string): Set<string> {
    const s = new Set<string>();
    for (const [rep, subs] of Object.entries(groups)) {
      if (rep === forRepId) continue;
      for (const id of subs) s.add(id);
    }
    return s;
  }

  function getSubOrdersFor(repId: string): OrderListRead[] {
    const subIds = groups[repId] ?? [];
    if (!subIds.length) return [];
    const pool = allOrdersCache ?? pagedOrders;
    const res: OrderListRead[] = [];
    for (const sid of subIds) {
      const f = pool.find((o) => o.id === sid);
      if (f) res.push(f);
    }
    return res;
  }

  type ValidationErrorItem = { orderId: string; index: number; message: string };
  const validationErrors = useMemo(() => {
    const errs: ValidationErrorItem[] = [];
    visibleOrders.forEach((order, idx) => {
      const displayIndex = idx + 1;
      const subs = getSubOrdersFor(order.id);
      const list = orderShipments[order.id] ?? [];
      if (list.length === 0) {
        errs.push({ orderId: order.id, index: displayIndex, message: "최소 1건의 발주가 필요합니다." });
        return;
      }
      const withQty = list.map((s) => ({
        items: s.items.filter((i) => i.quantity > 0),
      }));
      const hasEmptyShipment = withQty.some((s) => s.items.length === 0);
      if (hasEmptyShipment) {
        errs.push({ orderId: order.id, index: displayIndex, message: "각 발주에 상품을 1개 이상 할당하세요." });
      }
      if (!validateGroupShipments(order, subs, withQty)) {
        errs.push({
          orderId: order.id,
          index: displayIndex,
          message: subs.length
            ? "합배송 그룹의 상품/수량 합계와 발주 할당이 일치하지 않습니다."
            : "주문 상품/수량과 발주 할당이 일치하지 않습니다.",
        });
      }
    });
    return errs;
    // getSubOrdersFor는 groups/allOrdersCache/pagedOrders에 의존
  }, [visibleOrders, orderShipments, groups, allOrdersCache, pagedOrders]);

  async function handleConfirm() {
    setLoading(true);
    setMessage("전체 발주 대상 주문을 불러오는 중…");
    const all = await fetchAllOrderStatusOrdersForPlaceOrder();
    if ("message" in (all as any)) {
      setLoading(false);
      setMessage((all as any).message ?? "주문을 불러오지 못했습니다.");
      return;
    }

    const allOrders = all as OrderListRead[];
    if (allOrders.length === 0) {
      setLoading(false);
      setMessage("발주할 주문이 없습니다.");
      return;
    }

    const errs: Array<{ index: number; message: string }> = [];
    const fullPayload: {
      order_id: string;
      shipments: { items: { product_id: string; quantity: number }[] }[];
      consolidated_sub_order_ids: string[];
    }[] = [];
    const filtered = allOrders.filter((o) => !removedOrderIds.has(o.id));
    const orderById = new Map<string, OrderListRead>(filtered.map((o) => [o.id, o]));

    // 합배송 하위 주문은 top-level에서 제외
    const allSubIds = new Set<string>();
    for (const [, subs] of Object.entries(groups)) {
      for (const s of subs) allSubIds.add(s);
    }

    const toProcess = filtered.filter((o) => !allSubIds.has(o.id));

    toProcess.forEach((order, idx) => {
      const displayIndex = idx + 1;
      const subIds = groups[order.id] ?? [];
      const subs: OrderListRead[] = [];
      for (const sid of subIds) {
        const s = orderById.get(sid);
        if (s) subs.push(s);
      }

      const edited = orderShipments[order.id];
      const shipments: ShipmentEdit[] =
        edited && edited.length > 0 ? edited : initialShipmentsForGroup(order, subs);

      const withQty = shipments.map((s) => ({
        items: s.items.filter((i) => i.quantity > 0),
      }));
      const hasEmpty = withQty.length === 0 || withQty.some((s) => s.items.length === 0);
      if (hasEmpty) {
        errs.push({ index: displayIndex, message: "각 발주에 상품을 1개 이상 할당하세요." });
        return;
      }
      if (!validateGroupShipments(order, subs, withQty)) {
        errs.push({
          index: displayIndex,
          message: subs.length
            ? "합배송 그룹의 상품/수량 합계와 발주 할당이 일치하지 않습니다."
            : "주문 상품/수량과 발주 할당이 일치하지 않습니다.",
        });
        return;
      }

      fullPayload.push({
        order_id: order.id,
        shipments: withQty,
        consolidated_sub_order_ids: subs.map((s) => s.id),
      });
    });

    if (errs.length > 0) {
      setLoading(false);
      setMessage(errs.map((e) => `주문 ${e.index}: ${e.message}`).join(" "));
      return;
    }

    if (fullPayload.length === 0) {
      setLoading(false);
      setMessage("발주할 주문이 없습니다.");
      return;
    }

    setMessage(null);
    const result = await placeOrderAction({ order_shipments: fullPayload });
    setLoading(false);
    if (result.message) {
      setMessage(result.message);
      return;
    }
    onOpenChange(false);
    onSuccess?.();
    router.refresh();
  }

  const consolidateRepOrder = consolidateTarget
    ? (allOrdersCache ?? pagedOrders).find((o) => o.id === consolidateTarget) ?? null
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1280px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>주문 · 발주 비교</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto min-h-0">
          <p className="text-xs text-muted-foreground">
            왼쪽: 주문 정보. 오른쪽: 생성될 발주(배송건)를 추가/삭제하고, 상품과 수량을 할당하세요.
            합배송 버튼으로 여러 주문을 하나로 묶을 수 있으며, (묶인) 주문 상품 합계와 발주 할당이 일치해야 합니다.
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              전체 {total.toLocaleString("ko-KR")}건 · 페이지 {currentPage} / {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pageLoading || currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                이전
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pageLoading || currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                다음
              </Button>
            </div>
          </div>
          {pageLoading && (
            <p className="text-xs text-muted-foreground">페이지를 불러오는 중…</p>
          )}
          {allOrdersLoading && (
            <p className="text-xs text-muted-foreground">합배송 대상 주문을 불러오는 중…</p>
          )}
          {visibleOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              발주 대상 주문이 없습니다. 다이얼로그를 닫고 다시 발주하기를 선택해 주세요.
            </p>
          ) : (
          visibleOrders.map((order, idx) => {
            const subs = getSubOrdersFor(order.id);
            const shipments = orderShipments[order.id] ?? [];
            const productOptions = groupProductOptions(order, subs);
            const receiverName = (order.receiver?.name ?? "").trim();
            const isDuplicateReceiverName =
              receiverName.length > 0 && duplicateReceiverNameSet.has(receiverName);
            const hasConsolidation = subs.length > 0;
            return (
              <div
                id={`order-block-${order.id}`}
                key={order.id}
                className={cn(
                  "rounded-md border border-primary bg-background/40 p-3 space-y-2 scroll-mt-4",
                  isDuplicateReceiverName &&
                    "border-amber-400 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-950/30",
                  hasConsolidation &&
                    "border-sky-400 bg-sky-50/60 dark:border-sky-500 dark:bg-sky-950/30",
                )}
              >
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground mb-1">
                  <span>
                    주문 {idx + 1} {order.id}
                    {hasConsolidation && (
                      <span className="ml-2 inline-flex items-center rounded bg-sky-100 dark:bg-sky-900 px-1.5 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-200">
                        합배송 {subs.length + 1}건(대표 포함)
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => openConsolidateDialog(order.id)}
                    >
                      합배송
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveOrder(order.id)}
                    >
                      주문 삭제
                    </Button>
                  </div>
                </div>
                {hasConsolidation && (
                  <div className="rounded border border-sky-200 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/20 p-2 text-xs space-y-1">
                    <div className="font-medium text-sky-800 dark:text-sky-200">
                      합배송된 하위 주문
                    </div>
                    <ul className="space-y-0.5">
                      {subs.map((s) => (
                        <li key={s.id} className="flex justify-between gap-2">
                          <span className="truncate">
                            {s.receiver?.name ?? "-"} · {s.receiver?.phone ?? "-"} ·{" "}
                            <span className="">{s.id.slice(0, 8)}…</span>
                          </span>
                          <span className="text-muted-foreground">
                            {(s.items ?? []).reduce((acc, it) => acc + it.quantity, 0)}개
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <OrderBlock className="col-span-2" order={order} subOrders={subs} />
                  <div className="space-y-2">
                    {shipments.map((shipment, si) => (
                      <ShipmentEditBlock
                        key={si}
                        repOrder={order}
                        shipment={shipment}
                        shipmentIndex={si}
                        productOptions={productOptions}
                        onUpdate={(s) => updateShipment(order.id, si, s)}
                        onRemove={() => removeShipment(order.id, si)}
                        onAddShipment={() => addShipment(order.id)}
                        canRemove={shipments.length > 1}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })
          )}
        </div>
        {message && (
          <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
        )}
        {validationErrors.length > 0 && !message && (
          <div className="text-sm text-amber-600 dark:text-amber-400 space-y-1">
            <span className="font-medium">검증:</span>
            {validationErrors.map((e, i) => (
              <p key={`${e.orderId}-${i}`}>
                <button
                  type="button"
                  className="underline hover:no-underline font-medium focus:outline-none"
                  onClick={() => scrollToOrder(e.orderId)}
                >
                  주문 {e.index}
                </button>
                {" : "}
                {e.message}
              </p>
            ))}
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              취소
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading || visibleOrders.length === 0 || validationErrors.length > 0}
          >
            {loading ? "처리 중…" : "발주 실행"}
          </Button>
        </DialogFooter>
      </DialogContent>
      {consolidateRepOrder && (
        <ConsolidateOrdersDialog
          open={consolidateTarget !== null}
          onOpenChange={(o) => {
            if (!o) setConsolidateTarget(null);
          }}
          repOrder={consolidateRepOrder}
          allOrders={(allOrdersCache ?? []).filter(
            (o) => !removedOrderIds.has(o.id),
          )}
          lockedOrderIds={getOtherGroupLockedIds(consolidateRepOrder.id)}
          otherRepIds={new Set(
            [...repIdsSet].filter((id) => id !== consolidateRepOrder.id),
          )}
          initialSubOrderIds={groups[consolidateRepOrder.id] ?? []}
          onConfirm={(subIds) => applyConsolidation(consolidateRepOrder.id, subIds)}
        />
      )}
    </Dialog>
  );
}
