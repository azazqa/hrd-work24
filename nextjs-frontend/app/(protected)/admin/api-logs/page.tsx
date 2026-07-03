"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PagePagination } from "@/components/page-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeInSeoul } from "@/lib/date-utils";

interface Work24ApiLogRow {
  id: number;
  requested_at: string;
  method: string;
  url: string;
  request_headers: Record<string, unknown> | null;
  response_status: number | null;
  response_headers: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
}

interface Work24ApiLogPage {
  items: Work24ApiLogRow[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

const SOURCE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "courses_index", label: "테스트 색인" },
  { value: "legacy_course_index", label: "과거 색인" },
];

async function readApiError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { detail?: string | { msg?: string }[] };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail.map((d) => (typeof d === "object" && d?.msg ? d.msg : String(d))).join(", ");
    }
  } catch {
    /* ignore */
  }
  return text || `요청 실패 (HTTP ${res.status})`;
}

function contextSource(ctx: Record<string, unknown> | null): string {
  const s = ctx?.source;
  return typeof s === "string" ? s : "-";
}

function contextMonth(ctx: Record<string, unknown> | null): string {
  const m = ctx?.month;
  return typeof m === "string" ? m : "-";
}

export default function AdminApiLogsPage() {
  const router = useRouter();
  const params = useSearchParams();

  const page = Number(params.get("page")) || 1;
  const size = Number(params.get("size")) || 20;
  const source = params.get("source") ?? "";
  const responseStatus = params.get("response_status") ?? "";
  const month = params.get("month") ?? "";

  const [filterSource, setFilterSource] = useState(source || "__all__");
  const [filterStatus, setFilterStatus] = useState(responseStatus);
  const [filterMonth, setFilterMonth] = useState(month);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Work24ApiLogPage>({
    items: [],
    total: 0,
    page: 1,
    size: 20,
    pages: 1,
  });

  useEffect(() => {
    setFilterSource(source || "__all__");
    setFilterStatus(responseStatus);
    setFilterMonth(month);
  }, [source, responseStatus, month]);

  const extraQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (source) q.set("source", source);
    if (responseStatus) q.set("response_status", responseStatus);
    if (month) q.set("month", month);
    return q.toString();
  }, [source, responseStatus, month]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("size", String(size));
    if (source) sp.set("source", source);
    if (responseStatus.trim()) sp.set("response_status", responseStatus.trim());
    if (month.trim()) sp.set("month", month.trim());
    try {
      const res = await fetch(`/api/admin/work24-api-logs?${sp.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await readApiError(res));
      setResult((await res.json()) as Work24ApiLogPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "API 로그 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [page, size, source, responseStatus, month]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const applyFilters = () => {
    const q = new URLSearchParams();
    q.set("page", "1");
    q.set("size", String(size));
    const src = filterSource === "__all__" ? "" : filterSource;
    if (src) q.set("source", src);
    if (filterStatus.trim()) q.set("response_status", filterStatus.trim());
    if (filterMonth.trim()) q.set("month", filterMonth.trim());
    router.push(`/admin/api-logs?${q.toString()}`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-lg">
        <h1 className="mb-2 text-2xl font-semibold">API 조회 로그</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Work24 Open API 호출 이력입니다. 요청·응답 헤더만 저장되며, 과정 색인 작업에서
          발생한 호출을 확인할 수 있습니다.
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="source">출처</Label>
            <select
              id="source"
              className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value || "__all__"} value={o.value || "__all__"}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="response_status">HTTP 상태</Label>
            <Input
              id="response_status"
              type="number"
              placeholder="예: 200"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-28"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="month">월 (YYYY-MM)</Label>
            <Input
              id="month"
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-44"
            />
          </div>
          <Button type="button" variant="secondary" onClick={applyFilters}>
            조회
          </Button>
        </div>

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>요청 시각</TableHead>
                <TableHead>출처</TableHead>
                <TableHead>월</TableHead>
                <TableHead className="w-20">상태</TableHead>
                <TableHead>URL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    불러오는 중...
                  </TableCell>
                </TableRow>
              ) : result.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    로그가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                result.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTimeInSeoul(row.requested_at)}
                    </TableCell>
                    <TableCell className="text-sm">{contextSource(row.context)}</TableCell>
                    <TableCell className="text-sm">{contextMonth(row.context)}</TableCell>
                    <TableCell>{row.response_status ?? "-"}</TableCell>
                    <TableCell className="max-w-md truncate text-xs" title={row.url}>
                      {row.url}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <PagePagination
          currentPage={page}
          totalPages={Math.max(1, result.pages)}
          pageSize={size}
          totalItems={result.total}
          basePath="/admin/api-logs"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}
