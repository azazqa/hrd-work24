"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { OwnedCourseImportResult } from "@/app/openapi-client";
import { CompanySelect } from "@/components/company-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";

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

export function ExcelImportDialog() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<OwnedCourseImportResult | null>(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("엑셀 파일을 선택하세요.");
      return;
    }
    if (!companyId) {
      toast.error("업체를 선택하세요.");
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("company_id", companyId);
      formData.append("file", file);
      const res = await fetch("/api/owned-courses/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        toast.error(await readApiError(res));
        return;
      }
      const data = (await res.json()) as OwnedCourseImportResult;
      setResult(data);
      toast.success(
        `등록 ${data.created}건, 수정 ${data.updated}건, 실패 ${data.failed}건`,
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
      setCompanyId("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">엑셀 일괄등록</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>엑셀 일괄등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            업체를 선택한 뒤 양식 데이터를 업로드하세요. 동일 업체·과정명·개발년도면
            수정하고, 없으면 새로 등록합니다.
          </p>
          <Field>
            <FieldLabel>업체</FieldLabel>
            <CompanySelect value={companyId} onValueChange={setCompanyId} />
          </Field>
          <Button variant="secondary" asChild>
            <a href="/api/owned-courses/import/template" download>
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
                등록 {result.created}건 · 수정 {result.updated}건 · 실패{" "}
                {result.failed}건
              </p>
              {result.errors.length > 0 && (
                <ul className="max-h-40 overflow-y-auto text-destructive text-xs space-y-1">
                  {result.errors.map((err) => (
                    <li key={`${err.row}-${err.message}`}>
                      {err.row}행: {err.message}
                    </li>
                  ))}
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
