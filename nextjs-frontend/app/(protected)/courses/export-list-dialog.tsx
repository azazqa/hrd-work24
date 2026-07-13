"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumberWithCommas } from "@/lib/format-utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
};

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
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/courses/export-jobs?page=1&size=50", {
        cache: "no-store",
      });
      if (!res.ok) {
        toast.error("다운로드 목록을 불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as ExportJobPage;
      setItems(data.items ?? []);
    } catch {
      toast.error("다운로드 목록을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const hasActive = items.some((it) => ACTIVE_STATUSES.has(it.status));
    if (!hasActive) return;
    const timer = setInterval(() => {
      void load();
    }, 4000);
    return () => clearInterval(timer);
  }, [open, items, load]);

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
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
