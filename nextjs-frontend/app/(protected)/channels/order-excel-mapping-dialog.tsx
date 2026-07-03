"use client";

import { useEffect, useMemo, useState } from "react";
import readXlsxFile, { type Row } from "read-excel-file/browser";
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
import { ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG } from "@/lib/order-excel-mapping";

const NONE = "__none__";

function normHeader(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

/** 다이얼로그 오픈 시 엑셀 세션 초기화용: 매칭 전부 없음 */
function emptyFieldToExcel(): Record<string, string> {
  const o: Record<string, string> = {};
  for (const c of ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG) {
    o[c] = NONE;
  }
  return o;
}

function buildFieldToExcel(
  headers: string[],
  excelByCanonical: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const f of ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG) {
    next[f] = NONE;
  }
  const headerSet = new Set(headers.filter(Boolean));
  for (const canon of ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG) {
    const target = normHeader(canon);
    const hit = headers.find((h) => h && normHeader(h) === target);
    if (hit) next[canon] = hit;
  }
  for (const canon of ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG) {
    const ex = String(excelByCanonical[canon] ?? "").trim();
    if (ex && headerSet.has(ex)) {
      next[canon] = ex;
    }
  }
  return next;
}

function cellToStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

export type OrderExcelMappingApplyPayload = {
  headerRow: number;
  excelByCanonical: Record<string, string>;
  /** 엑셀 파일을 읽은 경우 헤더 행의 전체 열 이름(원본 순서) */
  sourceHeaders?: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headerRow: number;
  excelByCanonical: Record<string, string>;
  onApply: (payload: OrderExcelMappingApplyPayload) => void;
};

export function OrderExcelMappingDialog({
  open,
  onOpenChange,
  headerRow: headerRowProp,
  excelByCanonical: excelByCanonicalProp,
  onApply,
}: Props) {
  const [headerRow, setHeaderRow] = useState(1);
  const [fileError, setFileError] = useState<string | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [sampleCells, setSampleCells] = useState<string[]>([]);
  const [fieldToExcel, setFieldToExcel] = useState<Record<string, string>>({});
  /** 다이얼로그를 열 때마다 증가 → file input 리마운트로 선택 파일 초기화 */
  const [fileInputKey, setFileInputKey] = useState(0);

  const headerOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const h of excelHeaders) {
      if (h && !seen.has(h)) {
        seen.add(h);
        out.push(h);
      }
    }
    return out;
  }, [excelHeaders]);

  useEffect(() => {
    if (!open) return;
    setFileInputKey((k) => k + 1);
    setFileError(null);
    setHeaderRow(headerRowProp);
    setExcelHeaders([]);
    setSampleCells([]);
    setFieldToExcel(emptyFieldToExcel());
  }, [open, headerRowProp]);

  const onPickFile = async (file: File | null) => {
    setFileError(null);
    if (!file) return;
    try {
      const fileResult = await readXlsxFile(file);
      const firstSheet = fileResult[0];
      const rows = firstSheet?.data ?? [];
      const hr = Math.max(1, headerRow);
      const hIdx = hr - 1;
      if (rows.length <= hIdx) {
        setFileError(
          firstSheet
            ? `엑셀에 헤더 행(${hr})이 없습니다.`
            : "엑셀에 시트가 없습니다.",
        );
        setExcelHeaders([]);
        setSampleCells([]);
        return;
      }
      const headerCells: Row = rows[hIdx] ?? [];
      const headers = headerCells.map((c) => cellToStr(c));
      setExcelHeaders(headers);
      const sampleRow: Row | undefined = rows[hIdx + 1];
      const samples = sampleRow
        ? sampleRow.map((c) => cellToStr(c))
        : headers.map(() => "");
      while (samples.length < headers.length) samples.push("");
      setSampleCells(samples.slice(0, headers.length));
      setFieldToExcel(buildFieldToExcel(headers, excelByCanonicalProp));
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "엑셀을 읽지 못했습니다.");
      setExcelHeaders([]);
      setSampleCells([]);
    }
  };

  const applyMapping = () => {
    const out: Record<string, string> = { ...createEmptyForApply() };
    for (const canon of ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG) {
      const ex = fieldToExcel[canon];
      if (ex && ex !== NONE) {
        out[canon] = ex;
      }
    }
    if (excelHeaders.length > 0) {
      const used = new Set<string>();
      for (const canon of ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG) {
        const ex = out[canon];
        if (ex) {
          if (used.has(ex)) {
            setFileError("같은 열을 두 표준 필드에 매칭할 수 없습니다.");
            return;
          }
          used.add(ex);
        }
      }
    }
    onApply({
      headerRow: Math.max(1, Math.floor(headerRow) || 1),
      excelByCanonical: out,
      sourceHeaders: excelHeaders.length > 0 ? [...excelHeaders] : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          "flex max-h-[90vh] w-[min(720px,calc(100vw-2rem))] max-w-[min(720px,calc(100vw-2rem))] flex-col gap-4 overflow-hidden p-6"
        }
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>주문 양식 매칭 (엑셀에서 불러오기)</DialogTitle>
        </DialogHeader>

        <div className="p-1 grid min-h-0 min-w-0 flex-1 gap-4 overflow-y-auto">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="header-row">헤더 행 (1부터)</Label>
              <Input
                id="header-row"
                type="number"
                min={1}
                value={headerRow}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setHeaderRow(Number.isFinite(n) && n >= 1 ? n : 1);
                }}
              />
              <p className="text-muted-foreground text-xs">
                예: 3이면 3번째 행이 헤더, 4번째 행부터 주문 데이터입니다. 값을 바꾼 뒤에는 엑셀을 다시
                선택하세요.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="excel-file">엑셀 파일</Label>
              <Input
                key={fileInputKey}
                id="excel-file"
                type="file"
                accept=".xlsx,.xls"
                className="cursor-pointer"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  void onPickFile(f);
                }}
              />
            </div>
          </div>

          {fileError && <p className="text-destructive text-sm">{fileError}</p>}

          {headerOptions.length > 0 && (
            <div className="min-w-0 space-y-2">
              <Label>엑셀 열 미리보기 (헤더 + 샘플 1행)</Label>
              <div className="max-w-full overflow-x-auto rounded border">
                <table className="w-max text-left text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      {excelHeaders.map((h, i) => (
                        <th key={i} className="border-b px-2 py-1 font-medium whitespace-nowrap">
                          {h || `(열 ${i + 1})`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {excelHeaders.map((_, i) => (
                        <td key={i} className="border-b px-2 py-1 text-muted-foreground whitespace-nowrap">
                          {sampleCells[i] ?? ""}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {headerOptions.length > 0 && (
            <div className="space-y-3">
              <Label>표준 필드 ↔ 엑셀 열 (선택 시 아래 폼에 반영됩니다)</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG.map((canon) => (
                  <div key={canon} className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs">{canon}</span>
                    <Select
                      value={fieldToExcel[canon] ?? NONE}
                      onValueChange={(v) =>
                        setFieldToExcel((prev) => ({ ...prev, [canon]: v }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="열 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— 없음 —</SelectItem>
                        {headerOptions.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border pt-4 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <Button type="button" onClick={applyMapping}>
            폼에 반영
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function createEmptyForApply(): Record<string, string> {
  const o: Record<string, string> = {};
  for (const c of ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG) {
    o[c] = "";
  }
  return o;
}
