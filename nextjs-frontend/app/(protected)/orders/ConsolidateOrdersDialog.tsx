"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { OrderListRead } from "@/app/openapi-client/types.gen";

interface ConsolidateOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 현재 발주하기 다이얼로그에 로드된 대표 주문 (이 주문의 합배송 그룹을 편집) */
  repOrder: OrderListRead;
  /** 발주 대상 전체 주문 목록 (ORDER 상태) */
  allOrders: OrderListRead[];
  /** 다른 rep에 이미 포함되어 있어 선택 불가능한 주문 ids */
  lockedOrderIds: Set<string>;
  /** repOrder의 기존 그룹(편집 시 초기 체크 상태) */
  initialSubOrderIds: string[];
  /** repOrder로 쓰일 수 없는 주문 ids (이미 다른 그룹의 대표인 경우 등) */
  otherRepIds: Set<string>;
  onConfirm: (subOrderIds: string[]) => void;
}

function normalize(s?: string | null) {
  return (s ?? "").trim().toLowerCase();
}

function isSameReceiverName(a: OrderListRead, b: OrderListRead): boolean {
  const an = normalize(a.receiver?.name);
  const bn = normalize(b.receiver?.name);
  if (!an || !bn) return false;
  return an === bn;
}

export function ConsolidateOrdersDialog({
  open,
  onOpenChange,
  repOrder,
  allOrders,
  lockedOrderIds,
  initialSubOrderIds,
  otherRepIds,
  onConfirm,
}: ConsolidateOrdersDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSubOrderIds));
      setQuery("");
      setAppliedQuery("");
    }
  }, [open, initialSubOrderIds]);

  function handleSearch() {
    setAppliedQuery(query);
  }

  function handleResetSearch() {
    setQuery("");
    setAppliedQuery("");
  }

  const candidates = useMemo(() => {
    // rep 자신 제외
    const list = allOrders.filter((o) => o.id !== repOrder.id);

    // 정렬 규칙:
    // 1) 대표 주문과 동일한 수취인명인 주문은 수취인 정렬과 무관하게 항상 최상단
    // 2) 그 외 주문은 수취인명 오름차순(없으면 후순위), 이름이 같으면 전화번호 오름차순
    const collator = new Intl.Collator("ko", { sensitivity: "base" });
    const sameReceiver: OrderListRead[] = [];
    const others: OrderListRead[] = [];
    for (const o of list) {
      if (isSameReceiverName(repOrder, o)) sameReceiver.push(o);
      else others.push(o);
    }
    const byReceiver = (a: OrderListRead, b: OrderListRead) => {
      const an = (a.receiver?.name ?? "").trim();
      const bn = (b.receiver?.name ?? "").trim();
      if (!an && bn) return 1;
      if (an && !bn) return -1;
      const byName = collator.compare(an, bn);
      if (byName !== 0) return byName;
      const ap = (a.receiver?.phone ?? "").trim();
      const bp = (b.receiver?.phone ?? "").trim();
      return collator.compare(ap, bp);
    };
    sameReceiver.sort(byReceiver);
    others.sort(byReceiver);
    return [...sameReceiver, ...others];
  }, [allOrders, repOrder]);

  const filtered = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((o) => {
      const hay = [
        o.id,
        o.receiver?.name ?? "",
        o.receiver?.phone ?? "",
        o.receiver?.address ?? "",
        o.mall_product_name ?? "",
        o.channel?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [candidates, appliedQuery]);

  function toggle(id: string, disabled: boolean) {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    onConfirm(Array.from(selected));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            합배송 — 대표 주문 {repOrder.id.slice(0, 8)}… ({repOrder.receiver?.name ?? "-"})
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 overflow-hidden flex flex-col min-h-0">
          <p className="text-xs text-muted-foreground">
            대표 주문과 합칠 하위 주문을 선택하세요. 대표 주문과 동일한 수취인명의 주문이 정렬과 관계없이 항상 최상단에 표시됩니다.
            이미 다른 그룹에 포함되었거나 대표로 지정된 주문은 선택할 수 없습니다.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex items-center gap-2"
          >
            <Input
              placeholder="수취인명, 연락처, 상품명, 주문 id로 검색…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleResetSearch}
              disabled={query === "" && appliedQuery === ""}
            >
              초기화
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs">
              검색
            </Button>
          </form>
          <div className="flex-1 overflow-y-auto min-h-0 border rounded">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                해당하는 주문이 없습니다.
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((o) => {
                  const lockedByOther = lockedOrderIds.has(o.id);
                  const isOtherRep = otherRepIds.has(o.id);
                  const disabled = lockedByOther || isOtherRep;
                  const checked = selected.has(o.id);
                  const highlight = isSameReceiverName(repOrder, o);
                  return (
                    <li
                      key={o.id}
                      className={cn(
                        "flex items-start gap-2 p-2 text-sm",
                        disabled && "opacity-50",
                        highlight && "bg-amber-50/60 dark:bg-amber-950/30",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => toggle(o.id, disabled)}
                        className="mt-1"
                      />
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggle(o.id, disabled)}
                        className="flex-1 text-left space-y-0.5 disabled:cursor-not-allowed"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">
                            {o.receiver?.name ?? "-"}{" "}
                            <span className="text-muted-foreground font-normal">
                              {o.receiver?.phone ?? ""}
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground ">
                            {o.id.slice(0, 8)}…
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {o.channel?.name ? `[${o.channel.name}] ` : ""}
                          {o.mall_product_name ?? "-"}
                        </div>
                        {disabled && (
                          <div className="text-xs text-amber-600 dark:text-amber-400">
                            {isOtherRep
                              ? "다른 그룹의 대표 주문"
                              : "다른 합배송 그룹에 이미 포함됨"}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            선택됨: {selected.size.toLocaleString("ko-KR")}건
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              취소
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleConfirm}>
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
