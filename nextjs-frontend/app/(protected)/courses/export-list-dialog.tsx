"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumberWithCommas } from "@/lib/format-utils";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { buildPageWindow } from "@/components/pagination-window";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ExportJob = {
  id: number;
  status: string;
  memo: string | null;
  conditions_summary: string | null;
  row_count: number | null;
  file_name: string | null;
  file_size: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type ExportJobPage = {
  items: ExportJob[];
  total?: number | null;
  page?: number | null;
  size?: number | null;
  pages?: number | null;
};

const DEFAULT_PAGE_SIZE = 10;
const DIALOG_PAGE_SIZES = PAGE_SIZE_OPTIONS.filter((n) => n <= 50);
const ACTIVE_STATUSES = new Set(["PENDING", "PROCESSING"]);

const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기",
  PROCESSING: "생성 중",
  SUCCEEDED: "완료",
  FAILED: "실패",
  CANCELLED: "취소",
};

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "SUCCEEDED") return "default";
  if (status === "FAILED" || status === "CANCELLED") return "destructive";
  return "secondary";
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { hour12: false });
}

export function ExportListDialog({ open, onOpenChange }: Props) {
  const [items, setItems] = useState<ExportJob[]>([]);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (pageNum: number, pageSize: number) => {
    try {
      const res = await fetch(
        `/api/courses/export-jobs?page=${pageNum}&size=${pageSize}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        toast.error("다운로드 목록을 불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as ExportJobPage;
      const nextItems = data.items ?? [];
      const nextTotal = data.total ?? nextItems.length;
      const nextPages = Math.max(
        1,
        data.pages ?? (Math.ceil(nextTotal / pageSize) || 1),
      );
      // 마지막 페이지를 넘어간 경우(삭제·완료 후 건수 감소) 보정
      if (pageNum > nextPages) {
        setPage(nextPages);
        return;
      }
      setItems(nextItems);
      setTotal(nextTotal);
      setTotalPages(nextPages);
    } catch {
      toast.error("다운로드 목록을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setPage(1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void load(page, size).finally(() => setLoading(false));
  }, [open, page, size, load]);

  useEffect(() => {
    if (!open) return;
    const hasActive = items.some((it) => ACTIVE_STATUSES.has(it.status));
    if (!hasActive) return;
    const timer = setInterval(() => {
      void load(page, size);
    }, 4000);
    return () => clearInterval(timer);
  }, [open, items, page, size, load]);

  const pages = buildPageWindow(page, totalPages);
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>과정 다운로드 목록</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">생성일</TableHead>
                <TableHead className="w-20 text-center">건수</TableHead>
                <TableHead>내용</TableHead>
                <TableHead className="w-20 text-center">상태</TableHead>
                <TableHead className="w-24 text-center">다운로드</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {loading ? "불러오는 중…" : "생성된 파일이 없습니다."}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(job.created_at)}
                    </TableCell>
                    <TableCell className="text-center">
                      {job.row_count != null
                        ? formatNumberWithCommas(String(job.row_count))
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {job.memo ? <div>{job.memo}</div> : null}
                        {job.conditions_summary ? (
                          <div className="text-xs text-muted-foreground">
                            {job.conditions_summary}
                          </div>
                        ) : null}
                        {job.status === "FAILED" && job.error_message ? (
                          <div className="text-xs text-destructive">
                            {job.error_message}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusVariant(job.status)}>
                        {STATUS_LABEL[job.status] ?? job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {job.status === "SUCCEEDED" ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/api/courses/export-jobs/${job.id}/download`} download>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            {total === 0 ? "전체 0건" : `전체 ${formatNumberWithCommas(String(total))}건`}
          </div>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn("h-9 w-9", !hasPrevious && "pointer-events-none opacity-50")}
                  disabled={!hasPrevious || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="이전 페이지"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </PaginationItem>
              {pages.map((p, idx) =>
                p === "ellipsis" ? (
                  <PaginationItem key={`e-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <Button
                      type="button"
                      variant={p === page ? "default" : "outline"}
                      size="icon"
                      className="h-9 w-9"
                      disabled={loading}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn("h-9 w-9", !hasNext && "pointer-events-none opacity-50")}
                  disabled={!hasNext || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="다음 페이지"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">페이지당:</span>
            <Select
              value={String(size)}
              onValueChange={(v) => {
                setSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIALOG_PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
