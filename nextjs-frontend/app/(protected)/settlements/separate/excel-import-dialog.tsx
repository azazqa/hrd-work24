"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type SeparateSettlementImportResult = {
  deleted: number;
  created: number;
  failed: number;
  errors: { row: number; message: string }[];
};

async function readApiError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { detail?: string | { msg?: string }[] };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((d) => (typeof d === "object" && d?.msg ? d.msg : String(d)))
        .join(", ");
    }
  } catch {
    /* ignore */
  }
  return text || `요청 실패 (HTTP ${res.status})`;
}

export function SeparateExcelImportDialog() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SeparateSettlementImportResult | null>(
    null,
  );

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("엑셀 파일을 선택하세요.");
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/settlements/separate/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        toast.error(await readApiError(res));
        return;
      }
      const data = (await res.json()) as SeparateSettlementImportResult;
      setResult(data);
      toast.success(
        `기존 ${data.deleted}건 삭제, 등록 ${data.created}건, 실패 ${data.failed}건`,
      );
      router.refresh();
    } catch {
      toast.error("업로드에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setResult(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">엑셀 업로드</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>별도 정산 엑셀 업로드</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            엑셀을 업로드하면 기존 별도 정산 데이터가{" "}
            <strong>전부 삭제된 뒤</strong> 엑셀 내용으로 교체됩니다.
          </p>
          <Button variant="secondary" asChild>
            <a href="/api/settlements/separate/import/template" download>
              양식 다운로드
            </a>
          </Button>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm"
              className="block w-full text-sm"
            />
          </div>
          {result && (
            <div className="rounded-md border p-3 space-y-2">
              <p>
                삭제 {result.deleted}건 · 등록 {result.created}건 · 실패{" "}
                {result.failed}건
              </p>
              {result.errors.length > 0 && (
                <ul className="max-h-40 overflow-y-auto text-destructive text-xs space-y-1">
                  {result.errors.slice(0, 50).map((err) => (
                    <li key={`${err.row}-${err.message}`}>
                      {err.row}행: {err.message}
                    </li>
                  ))}
                  {result.errors.length > 50 ? (
                    <li>… 외 {result.errors.length - 50}건</li>
                  ) : null}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            닫기
          </Button>
          <Button onClick={handleUpload} disabled={pending}>
            업로드
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
