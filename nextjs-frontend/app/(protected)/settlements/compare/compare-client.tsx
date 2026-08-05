"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { createClientMappingAction } from "@/components/actions/client-mappings-action";
import {
  fetchOwnedCourseOpeningRefreshJob,
  refreshOwnedCourseOpenings,
  runOwnedSettlementCompare,
  type OwnedSettlementCompareItem,
  type OwnedSettlementCompareItemsPage,
  type OwnedSettlementCompareResult,
  type OwnedSettlementCompareStatus,
} from "@/components/actions/settlements-action";
import { PagePagination } from "@/components/page-pagination";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTimeInSeoul, getSettlementCompareYearOptions } from "@/lib/date-utils";

type Props = {
  year?: number;
  tab: OwnedSettlementCompareStatus;
  page: number;
  size: number;
  result?: OwnedSettlementCompareResult | null;
  itemsPage?: OwnedSettlementCompareItemsPage | null;
  error?: string | null;
};

function CompareTable({
  items,
  showClient,
  onAddMapping,
}: {
  items: OwnedSettlementCompareItem[];
  showClient: boolean;
  onAddMapping?: (institutionName: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">해당 항목이 없습니다.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table className="[&_td]:text-center">
        <TableHeader>
          <TableRow>
            <TableHead>훈련기관명</TableHead>
            {showClient ? <TableHead>고객사명</TableHead> : null}
            <TableHead>과정명</TableHead>
            <TableHead>훈련시작일</TableHead>
            <TableHead>훈련종료일</TableHead>
            <TableHead>수강신청 인원</TableHead>
            {!showClient ? <TableHead className="w-28">맵핑</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row, idx) => (
            <TableRow
              key={`${row.institution_name}-${row.course_name}-${row.tra_start_date}-${idx}`}
            >
              <TableCell className="text-left">
                {row.institution_name ?? "-"}
              </TableCell>
              {showClient ? (
                <TableCell className="text-left">{row.client_name ?? "-"}</TableCell>
              ) : null}
              <TableCell className="text-left">{row.course_name ?? "-"}</TableCell>
              <TableCell>{row.tra_start_date ?? "-"}</TableCell>
              <TableCell>{row.tra_end_date ?? "-"}</TableCell>
              <TableCell>{row.reg_course_man ?? "-"}</TableCell>
              {!showClient ? (
                <TableCell>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!row.institution_name}
                    onClick={() =>
                      row.institution_name && onAddMapping?.(row.institution_name)
                    }
                  >
                    맵핑 추가
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CompareOwnedClient({
  year,
  tab,
  page,
  size,
  result,
  itemsPage,
  error,
}: Props) {
  const router = useRouter();
  const yearOptions = useMemo(() => getSettlementCompareYearOptions(), []);
  const defaultYear = yearOptions[0] ?? new Date().getFullYear();
  const initialYear =
    year != null && yearOptions.includes(year) ? year : defaultYear;
  const [yearInput, setYearInput] = useState(String(initialYear));
  const [mapInst, setMapInst] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [mapError, setMapError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const hasResult = Boolean(result?.has_result || result?.cache_hit);

  const summary = useMemo(() => {
    if (!result || !hasResult) return null;
    return [
      { label: "전체", value: result.total },
      { label: "정산됨", value: result.matched },
      { label: "일부 정산", value: result.partial ?? 0 },
      { label: "별도 정산", value: result.separate ?? 0 },
      { label: "미정산", value: result.unsettled },
      { label: "맵핑 없음", value: result.unmapped },
    ];
  }, [result, hasResult]);

  const buildCompareUrl = (
    next: {
      year?: number;
      tab?: OwnedSettlementCompareStatus;
      page?: number;
      size?: number;
    },
  ) => {
    const y = next.year ?? year ?? Number(yearInput);
    const t = next.tab ?? tab;
    const p = next.page ?? 1;
    const s = next.size ?? size;
    const q = new URLSearchParams();
    q.set("year", String(y));
    q.set("tab", t);
    q.set("page", String(p));
    q.set("size", String(s));
    return `/settlements/compare?${q.toString()}`;
  };

  const onYearChange = (value: string) => {
    setYearInput(value);
    const y = Number(value);
    if (!yearOptions.includes(y)) return;
    setCompareError(null);
    setRefreshError(null);
    setRefreshMessage(null);
    router.push(buildCompareUrl({ year: y, tab: "unsettled", page: 1 }));
  };

  const onCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    const y = Number(yearInput);
    if (!yearOptions.includes(y)) return;
    setComparing(true);
    setCompareError(null);
    setRefreshError(null);
    setRefreshMessage(null);
    const res = await runOwnedSettlementCompare(y);
    setComparing(false);
    if ("message" in res) {
      setCompareError(res.message);
      return;
    }
    router.push(buildCompareUrl({ year: y, tab: "unsettled", page: 1 }));
    router.refresh();
  };

  const onTabChange = (value: string) => {
    const next = value as OwnedSettlementCompareStatus;
    if (!yearOptions.includes(Number(yearInput)) && year == null) return;
    const y = year ?? Number(yearInput);
    router.push(buildCompareUrl({ year: y, tab: next, page: 1 }));
  };

  const onRefresh = async () => {
    const y = Number(yearInput);
    if (!yearOptions.includes(y)) return;
    setRefreshing(true);
    setRefreshError(null);
    setRefreshMessage(null);

    const enqueued = await refreshOwnedCourseOpenings(y);
    if ("message" in enqueued) {
      setRefreshing(false);
      setRefreshError(enqueued.message);
      return;
    }

    setRefreshMessage(`${y}년 추출을 요청했습니다. 처리 중…`);

    let job = enqueued;
    const terminal = new Set(["SUCCEEDED", "FAILED"]);
    const started = Date.now();
    const maxWaitMs = 30 * 60 * 1000;

    while (!terminal.has(job.status)) {
      if (Date.now() - started > maxWaitMs) {
        setRefreshing(false);
        setRefreshError("추출 대기 시간이 초과되었습니다. 잠시 후 다시 확인해 주세요.");
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
      const polled = await fetchOwnedCourseOpeningRefreshJob(job.id);
      if ("message" in polled) {
        setRefreshing(false);
        setRefreshError(polled.message);
        return;
      }
      job = polled;
      setRefreshMessage(
        job.status === "PROCESSING"
          ? `${y}년 추출 처리 중…`
          : `${y}년 추출 대기 중…`,
      );
    }

    setRefreshing(false);
    if (job.status === "FAILED") {
      setRefreshError(job.error_message || "추출에 실패했습니다.");
      return;
    }

    setRefreshMessage(
      `${job.year}년 개설 보유과정 ${(job.row_count ?? 0).toLocaleString()}건을 추출했습니다. 「비교」로 결과를 갱신하세요.`,
    );
    router.push(buildCompareUrl({ year: y, tab, page: 1 }));
    router.refresh();
  };

  const onCreateMapping = async () => {
    if (!mapInst) return;
    setPending(true);
    setMapError(null);
    const res = await createClientMappingAction({
      institution_name: mapInst,
      client_name: clientName.trim(),
    });
    setPending(false);
    if (!res.ok) {
      setMapError(res.message);
      return;
    }
    setMapInst(null);
    setClientName("");
    router.refresh();
  };

  const items = itemsPage?.items ?? [];
  const totalItems = itemsPage?.total ?? 0;
  const totalPages = Math.max(1, itemsPage?.pages ?? 1);
  const paginationExtra =
    year != null ? `year=${year}&tab=${tab}` : undefined;

  return (
    <div className="space-y-6">
      <form onSubmit={onCompare} className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="year">비교 연도</Label>
          <Select value={yearInput} onValueChange={onYearChange}>
            <SelectTrigger id="year" className="w-40">
              <SelectValue placeholder="연도 선택" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={comparing}>
          {comparing ? "비교 중…" : "비교"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? "추출 중…" : "추출/갱신"}
        </Button>
        {hasResult && year != null ? (
          <Button type="button" variant="outline" asChild>
            <a
              href={`/api/settlements/compare-owned/export?year=${year}`}
              download
            >
              내보내기
            </a>
          </Button>
        ) : null}
        <Button type="button" variant="outline" asChild>
          <Link href="/settlements/mappings">고객사 맵핑 관리</Link>
        </Button>
      </form>

      {result?.compared_at ? (
        <p className="text-sm text-muted-foreground">
          마지막 비교: {formatDateTimeInSeoul(result.compared_at)}
          {result.extracted_at
            ? ` · 추출: ${formatDateTimeInSeoul(result.extracted_at)}`
            : null}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          저장된 비교 결과가 없습니다. 「비교」를 실행하면 결과가 저장됩니다.
          {!result?.extracted_at
            ? " (추출 캐시가 없으면 먼저 「추출/갱신」이 필요합니다.)"
            : null}
        </p>
      )}

      {compareError ? (
        <p className="text-sm text-destructive">{compareError}</p>
      ) : null}
      {refreshError ? (
        <p className="text-sm text-destructive">{refreshError}</p>
      ) : null}
      {refreshMessage ? (
        <p className="text-sm text-muted-foreground">{refreshMessage}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {summary ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {summary.map((s) => (
            <div key={s.label} className="rounded-md border px-4 py-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-semibold">
                {s.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {hasResult && result ? (
        <Tabs value={tab} onValueChange={onTabChange}>
          <TabsList>
            <TabsTrigger value="unsettled">
              미정산 ({result.unsettled})
            </TabsTrigger>
            <TabsTrigger value="partial">
              일부 정산 ({result.partial ?? 0})
            </TabsTrigger>
            <TabsTrigger value="separate">
              별도 정산 ({result.separate ?? 0})
            </TabsTrigger>
            <TabsTrigger value="matched">정산됨 ({result.matched})</TabsTrigger>
            <TabsTrigger value="unmapped">
              맵핑 없음 ({result.unmapped})
            </TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4 space-y-2">
            <CompareTable
              items={items}
              showClient={tab !== "unmapped"}
              onAddMapping={
                tab === "unmapped"
                  ? (name) => {
                      setMapInst(name);
                      setClientName("");
                      setMapError(null);
                    }
                  : undefined
              }
            />
            {totalItems > 0 ? (
              <PagePagination
                currentPage={page}
                totalPages={totalPages}
                pageSize={size}
                totalItems={totalItems}
                basePath="/settlements/compare"
                extraQuery={paginationExtra}
              />
            ) : null}
          </TabsContent>
        </Tabs>
      ) : null}

      <Dialog
        open={mapInst != null}
        onOpenChange={(open) => {
          if (!open) {
            setMapInst(null);
            setMapError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>고객사 맵핑 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>훈련기관명</Label>
              <Input value={mapInst ?? ""} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="map_client">고객사명</Label>
              <Input
                id="map_client"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="정산 고객사명"
              />
            </div>
            {mapError ? <p className="text-sm text-destructive">{mapError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMapInst(null)}>
              취소
            </Button>
            <Button type="button" onClick={onCreateMapping} disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
