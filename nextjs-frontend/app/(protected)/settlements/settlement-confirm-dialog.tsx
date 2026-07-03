"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleHelp } from "lucide-react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from "@radix-ui/react-icons";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchChannelsForExcelSelect,
  type ChannelOption,
} from "@/components/actions/orders-excel-action";

type SettlementRow = {
  id: string;
  order_id: string;
  channel_name?: string | null;
  mall_product_name?: string | null;
  order_price: number;
  price: number;
  created_at: string;
};

type PageResult = {
  items?: SettlementRow[];
  total?: number;
  page?: number;
  size?: number;
  pages?: number;
};

type ActionResponse =
  | { ok: true; settlement: SettlementRow }
  | { ok?: false; detail?: string; message?: string };

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export function SettlementConfirmDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [channelQuery, setChannelQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [acting, setActing] = useState<"complete" | "reject" | null>(null);
  const [selected, setSelected] = useState<Map<string, SettlementRow>>(
    () => new Map(),
  );

  const channelTrim = useMemo(() => channelQuery.trim(), [channelQuery]);
  const productTrim = useMemo(() => productQuery.trim(), [productQuery]);
  const channelValue = useMemo(
    () => (channelTrim ? channelTrim : "__all__"),
    [channelTrim],
  );

  const toggleOne = useCallback((r: SettlementRow, checked: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) next.set(r.id, r);
      else next.delete(r.id);
      return next;
    });
  }, []);

  const togglePageAll = useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = new Map(prev);
        for (const r of rows) {
          if (checked) next.set(r.id, r);
          else next.delete(r.id);
        }
        return next;
      });
    },
    [rows],
  );

  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));
  const headerChecked: boolean | "indeterminate" = allOnPage
    ? true
    : someOnPage
      ? "indeterminate"
      : false;

  const load = useCallback(
    async (opts?: {
      page?: number;
      pageSize?: number;
      clearSelection?: boolean;
      channelName?: string;
      productName?: string;
    }) => {
      const targetPage = opts?.page ?? page;
      const targetSize = opts?.pageSize ?? pageSize;
      const clearSelection = opts?.clearSelection ?? false;
      const channelName = (opts?.channelName ?? channelTrim).trim();
      const productName = (opts?.productName ?? productTrim).trim();

      setLoading(true);
      try {
        const sp = new URLSearchParams();
        sp.set("page", String(targetPage));
        sp.set("size", String(targetSize));
        sp.set("state", "settled");
        if (channelName) sp.set("channel_name", channelName);
        if (productName) sp.set("mall_product_name", productName);

        const res = await fetch(`/api/settlements?${sp.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(t || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as PageResult;
        const items = Array.isArray(json.items) ? json.items : [];
        setRows(items);
        const t = json.total ?? 0;
        setTotal(t);
        const size = json.size ?? targetSize;
        const pagesFromApi = json.pages;
        const computedPages =
          t === 0
            ? 0
            : typeof pagesFromApi === "number" && pagesFromApi >= 0
              ? pagesFromApi
              : Math.max(1, Math.ceil(t / Math.max(1, size)));
        setTotalPages(computedPages);
        setPage(json.page ?? targetPage);
        setPageSize(size);
        if (clearSelection) setSelected(new Map());
      } catch (e) {
        setRows([]);
        setTotal(0);
        setTotalPages(0);
        setSelected(new Map());
        toast.error(e instanceof Error ? e.message : "정산 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [channelTrim, productTrim, page, pageSize],
  );

  const validateSearch = useCallback((): boolean => {
    if (productTrim.length === 1) {
      toast.warning("상품명(별칭)은 2글자 이상 입력해 주세요.");
      return false;
    }
    return true;
  }, [productTrim]);

  const runSearch = useCallback(() => {
    if (!validateSearch()) return;
    void load({ page: 1, clearSelection: true });
  }, [load, validateSearch]);

  useEffect(() => {
    if (!open) return;
    if (channels.length > 0) return;
    let cancelled = false;
    setChannelsLoading(true);
    fetchChannelsForExcelSelect()
      .then((list) => {
        if (cancelled) return;
        setChannels(Array.isArray(list) ? list : []);
      })
      .finally(() => {
        if (cancelled) return;
        setChannelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, channels.length]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);

      if (nextOpen) {
        // open 시: 검색 초기화 + 목록 호출
        setChannelQuery("");
        setProductQuery("");
        setSelected(new Map());
        setActing(null);
        void load({
          page: 1,
          pageSize,
          clearSelection: true,
          channelName: "",
          productName: "",
        });
        return;
      }

      // close 시: 검색 초기화 + 목록/상태 비움
      setChannelQuery("");
      setProductQuery("");
      setRows([]);
      setSelected(new Map());
      setActing(null);
      setLoading(false);
      setTotal(0);
      setTotalPages(0);
      setPage(1);
    },
    [load, pageSize],
  );

  async function postAction(id: string, action: "complete" | "reject") {
    try {
      const res = await fetch(`/api/settlements/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as ActionResponse & {
        detail?: string;
        message?: string;
      };
      if (!res.ok) {
        toast.error(json.detail || json.message || "처리에 실패했습니다.");
        return;
      }
      toast.success(action === "complete" ? "완료 처리했습니다." : "반려 처리했습니다.");
      await load({ clearSelection: true });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리에 실패했습니다.");
    }
  }

  async function bulkAction(action: "complete" | "reject") {
    if (selected.size < 1) {
      toast.warning("처리할 정산을 선택해 주세요.");
      return;
    }
    if (acting) return;
    setActing(action);
    const ids = Array.from(selected.keys());
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(
            `/api/settlements/${encodeURIComponent(id)}/${action}`,
            { method: "POST", cache: "no-store" },
          );
          if (res.ok) return { ok: true as const, id };
          const json = (await res.json().catch(() => ({}))) as {
            detail?: string;
            message?: string;
          };
          return {
            ok: false as const,
            id,
            reason: json.detail || json.message || `HTTP ${res.status}`,
          };
        }),
      );

      const okCount = results.filter((r) => r.ok).length;
      const fails = results.filter((r) => !r.ok) as Array<{
        ok: false;
        id: string;
        reason: string;
      }>;

      if (okCount > 0) {
        toast.success(
          action === "complete"
            ? `완료 ${okCount}건 처리했습니다.`
            : `반려 ${okCount}건 처리했습니다.`,
        );
      }
      if (fails.length > 0) {
        toast.warning(
          fails.length > 1
            ? `실패 ${fails.length}건 (예: ${fails[0].reason})`
            : `실패: ${fails[0].reason}`,
        );
      }

      await load({ clearSelection: true });
      router.refresh();
    } finally {
      setActing(null);
    }
  }

  async function allAction(action: "complete" | "reject") {
    if (acting) return;
    setActing(action);
    try {
      const sp = new URLSearchParams();
      if (channelTrim) sp.set("channel_name", channelTrim);
      if (productTrim) sp.set("mall_product_name", productTrim);

      const endpoint =
        action === "complete"
          ? `/api/settlements/settled/complete-all?${sp.toString()}`
          : `/api/settlements/settled/reject-all?${sp.toString()}`;

      const res = await fetch(endpoint, { method: "POST", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        updated?: number;
        detail?: string;
        message?: string;
      };
      if (!res.ok) {
        toast.error(json.detail || json.message || "처리에 실패했습니다.");
        return;
      }
      const updated = Number(json.updated ?? 0);
      toast.success(
        action === "complete"
          ? `전체 완료 ${updated}건 처리했습니다.`
          : `전체 반려 ${updated}건 처리했습니다.`,
      );
      await load({ clearSelection: true });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      setActing(null);
    }
  }

  const hasNextPage = totalPages > 0 && page < totalPages;
  const hasPreviousPage = page > 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          정산 확인
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-360 w-full">
        <DialogHeader>
          <DialogTitle>
            <span className="inline-flex items-center gap-2">
              정산 확인
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex items-center"
                    // When the dialog opens, focus moves to the first focusable element.
                    // If this trigger is focusable, the tooltip can appear immediately.
                    tabIndex={-1}
                    aria-label="정산 확인 도움말"
                  >
                    <CircleHelp className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>
                    <b>정산 상태</b>인 건들을 확인하고 완료/반려 처리합니다.
                  </p>
                </TooltipContent>
              </Tooltip>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-1 flex-wrap gap-3 min-w-0">
            <div className="grid gap-1 w-[220px]">
              <Label>채널</Label>
              <Select
                value={channelValue}
                onValueChange={(v) => {
                  setChannelQuery(v === "__all__" ? "" : v);
                }}
              >
                <SelectTrigger className="w-full" disabled={channelsLoading}>
                  {channelsLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        로딩 중
                      </span>
                    </div>
                  ) : (
                    <SelectValue placeholder="전체" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">전체</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1 flex-1 min-w-[260px]">
              <Label>상품명(별칭)</Label>
              <Input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="쇼핑몰 상품명(별칭)"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  runSearch();
                }}
              />
            </div>
          </div>

          <div className="flex items-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setChannelQuery("");
                setProductQuery("");
                void load({ page: 1, pageSize, clearSelection: true });
              }}
              disabled={loading}
            >
              초기화
            </Button>
            <Button
              type="button"
              onClick={runSearch}
              disabled={loading}
            >
              {loading ? "로딩…" : "검색"}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm text-muted-foreground">
            선택 {selected.size.toLocaleString("ko-KR")}건 · 전체 {total.toLocaleString("ko-KR")}건
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="bg-indigo-700 text-white hover:bg-indigo-800"
              onClick={() => void bulkAction("complete")}
              disabled={selected.size < 1 || acting !== null}
            >
              {acting === "complete" ? "처리 중…" : "선택완료"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void bulkAction("reject")}
              disabled={selected.size < 1 || acting !== null}
            >
              {acting === "reject" ? "처리 중…" : "선택반려"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void allAction("complete")}
              disabled={acting !== null}
            >
              {acting === "complete" ? "처리 중…" : "전체 완료"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void allAction("reject")}
              disabled={acting !== null}
            >
              {acting === "reject" ? "처리 중…" : "전체 반려"}
            </Button>
          </div>
        </div>

        <div className="rounded border">
          <Table>
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
                <TableHead className="w-[140px] text-center">채널</TableHead>
                <TableHead className="w-[260px] text-center">상품명(별칭)</TableHead>
                <TableHead className="w-[110px] text-center">주문금액</TableHead>
                <TableHead className="w-[110px] text-center">정산금액</TableHead>
                <TableHead className="w-[140px] text-center">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length < 1 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    표시할 정산이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-center align-middle">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={(v) => toggleOne(r, v === true)}
                          aria-label={`정산 선택 ${r.id}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{r.channel_name ?? "-"}</TableCell>
                    <TableCell className="max-w-[260px] text-left">{r.mall_product_name ?? "-"}</TableCell>
                    <TableCell className="text-right">{Number(r.order_price ?? 0).toLocaleString("ko-KR")}</TableCell>
                    <TableCell className="text-right font-medium">{Number(r.price ?? 0).toLocaleString("ko-KR")}</TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-indigo-700 text-white hover:bg-indigo-800"
                          onClick={() => void postAction(r.id, "complete")}
                          disabled={acting !== null}
                        >
                          완료
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void postAction(r.id, "reject")}
                          disabled={acting !== null}
                        >
                          반려
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between my-2">
          <div className="text-sm text-muted-foreground">
            {total < 1 ? (
              <>표시 0건</>
            ) : (
              <>
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} /{" "}
                {total.toLocaleString("ko-KR")}건
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPreviousPage || loading}
              onClick={() => void load({ page: 1 })}
              aria-label="첫 페이지"
            >
              <DoubleArrowLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPreviousPage || loading}
              onClick={() => void load({ page: page - 1 })}
              aria-label="이전 페이지"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            {totalPages > 0 && (
              <span className="text-sm font-medium px-2 tabular-nums">
                Page {page} of {totalPages}
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNextPage || loading}
              onClick={() => void load({ page: page + 1 })}
              aria-label="다음 페이지"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNextPage || loading}
              onClick={() => void load({ page: totalPages })}
              aria-label="마지막 페이지"
            >
              <DoubleArrowRightIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground shrink-0">페이지당</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                const next = Number.parseInt(v, 10);
                if (!Number.isFinite(next)) return;
                void load({ page: 1, pageSize: next, clearSelection: true });
              }}
              disabled={loading}
            >
              <SelectTrigger className="w-18 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

