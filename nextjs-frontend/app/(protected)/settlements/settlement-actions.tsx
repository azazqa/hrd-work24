"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UploadResult = {
  updated?: number;
  skipped?: Array<{ order_id?: string | null; reason?: string }>;
  detail?: string;
  message?: string;
};

function filenameFromContentDisposition(cd: string | null): string | null {
  if (!cd) return null;
  const mStar = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (mStar?.[1]) {
    try {
      return decodeURIComponent(mStar[1]);
    } catch {
      return mStar[1];
    }
  }
  const m = cd.match(/filename\s*=\s*"?([^";]+)"?/i);
  return m?.[1] ?? null;
}

export function PendingSettlementExcelDownloadButton() {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/settlements/pending/excel", {
        cache: "no-store",
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          detail?: string;
          message?: string;
        };
        toast.error(
          typeof json.detail === "string"
            ? json.detail
            : typeof json.message === "string"
              ? json.message
              : "다운로드에 실패했습니다.",
        );
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        filenameFromContentDisposition(res.headers.get("content-disposition")) ??
        `settlements_pending_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("다운로드했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "다운로드에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" onClick={onClick} disabled={loading}>
      {loading ? "준비 중…" : "정산 대기 다운로드"}
    </Button>
  );
}

export function SettlementExcelUploadDialog({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const disabledReason = useMemo(() => {
    if (loading) return "업로드 중입니다.";
    if (!file) return "엑셀 파일을 선택해주세요.";
    return null;
  }, [file, loading]);

  async function onUpload() {
    if (disabledReason) {
      toast.warning(disabledReason);
      return;
    }
    if (!file) return;

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/settlements/settle/upload", {
        method: "POST",
        body: fd,
      });

      const json = (await res.json().catch(() => ({}))) as UploadResult;
      if (!res.ok) {
        toast.error(json.detail || json.message || "업로드에 실패했습니다.");
        return;
      }

      const updated = Number(json.updated ?? 0);
      const skipped = Array.isArray(json.skipped) ? json.skipped : [];

      if (updated < 1) {
        toast.warning("정산 처리된 건이 없습니다.");
        return;
      }

      if (skipped.length > 0) {
        const first = skipped[0];
        toast.warning(
          skipped.length > 1
            ? `스킵 ${skipped.length}건 (예: ${first?.reason ?? "사유 없음"})`
            : `스킵: ${first?.reason ?? "사유 없음"}`,
        );
      }

      toast.success(`정산 ${updated}건 처리 완료`);
      setOpen(false);
      setFile(null);
      onUploaded();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="bg-green-700 text-white hover:bg-green-800">
          정산 업로드
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>정산 업로드</DialogTitle>
          <DialogDescription>
            정산 대기에서 금액을 검토/수정 후 업로드하면 해당 건들이 <b>정산</b> 상태로 변경됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label>엑셀 파일(.xlsx)</Label>
            <Input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            닫기
          </Button>
          <Button onClick={onUpload} disabled={Boolean(disabledReason)}>
            {loading ? "업로드 중..." : "업로드"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

