"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportQuery: string;
  onCreated?: () => void;
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

function summarizeConditions(exportQuery: string): string[] {
  const sp = new URLSearchParams(exportQuery);
  const parts: string[] = [];
  const ownedYear = sp.get("owned_year");
  if (ownedYear) {
    parts.push(`보유과정 ${ownedYear}년`);
    const ms = sp.get("min_score");
    if (ms && Number(ms) > 0) parts.push(`관련도 ≥ ${ms}`);
  } else {
    const st = sp.get("srch_tra_st_dt");
    const en = sp.get("srch_tra_end_dt");
    if (st || en) parts.push(`훈련시작일 ${st ?? "?"} ~ ${en ?? "?"}`);
    const organ = sp.get("srch_tra_organ_nm");
    if (organ) parts.push(`기관명 '${organ}'`);
    const proc = sp.get("srch_tra_process_nm");
    if (proc) parts.push(`과정명 '${proc}'`);
  }
  if (sp.get("has_reg_course_man") === "true") parts.push("수강신청 인원 있음");
  return parts;
}

function buildRequestBody(
  exportQuery: string,
  memo: string,
): Record<string, string | number | boolean | null> {
  const sp = new URLSearchParams(exportQuery);
  const body: Record<string, string | number | boolean | null> = {
    memo: memo.trim() ? memo.trim() : null,
  };
  const ownedYear = sp.get("owned_year");
  if (ownedYear) {
    body.owned_year = Number(ownedYear);
    const ms = sp.get("min_score");
    if (ms) body.min_score = Number(ms);
  } else {
    const st = sp.get("srch_tra_st_dt");
    const en = sp.get("srch_tra_end_dt");
    if (st) body.srch_tra_st_dt = st;
    if (en) body.srch_tra_end_dt = en;
    const organ = sp.get("srch_tra_organ_nm");
    if (organ) body.srch_tra_organ_nm = organ;
    const proc = sp.get("srch_tra_process_nm");
    if (proc) body.srch_tra_process_nm = proc;
  }
  if (sp.get("has_reg_course_man") === "true") body.has_reg_course_man = true;
  return body;
}

export function ExportCreateDialog({
  open,
  onOpenChange,
  exportQuery,
  onCreated,
}: Props) {
  const [memo, setMemo] = useState("");
  const [pending, setPending] = useState(false);

  const conditions = summarizeConditions(exportQuery);

  const handleOpenChange = (next: boolean) => {
    if (next) setMemo("");
    onOpenChange(next);
  };

  const handleCreate = async () => {
    setPending(true);
    try {
      const res = await fetch("/api/courses/export-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody(exportQuery, memo)),
      });
      if (!res.ok) {
        toast.error(await readApiError(res));
        return;
      }
      toast.success("내보내기 작업이 등록되었습니다. 잠시 후 다운로드 목록에서 확인하세요.");
      onOpenChange(false);
      onCreated?.();
    } catch {
      toast.error("작업 등록에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>과정 내보내기 파일 생성</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-1 font-medium">검색 조건</p>
            {conditions.length === 0 ? (
              <p className="text-muted-foreground">조건 없음 (전체)</p>
            ) : (
              <ul className="list-disc pl-5 text-muted-foreground">
                {conditions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label htmlFor="export-memo" className="mb-1 block font-medium">
              내용 (메모)
            </label>
            <Textarea
              id="export-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 7월 수도권 과정 목록"
              maxLength={1000}
              rows={3}
            />
          </div>
          <p className="text-muted-foreground">
            파일 생성은 백그라운드에서 처리됩니다. 완료되면 다운로드 목록에서
            내려받을 수 있습니다.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            취소
          </Button>
          <Button type="button" onClick={handleCreate} disabled={pending}>
            {pending ? "등록 중…" : "생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
