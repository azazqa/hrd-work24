"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StockByProductChart } from "./stock-by-product-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type ConditionKey = "all" | "normal" | "refurb" | "disposal" | "undecided";

type Row = {
  product_id: string;
  condition: Exclude<ConditionKey, "all">;
  quantity: number;
  batch_code?: string | null;
  expiration_date: string;
  product?: { product_code: string; name: string } | null;
};

type Point = {
  label: string;
  normal: number;
  refurb: number;
  disposal: number;
  undecided: number;
};

function formatDateYMD(iso: string | undefined | null): string {
  if (!iso) return "";
  const idx = iso.indexOf("T");
  if (idx === -1) return iso.slice(0, 10);
  return iso.slice(0, idx);
}

function filterAndSortRows(rows: Row[], condition: ConditionKey): Row[] {
  const filtered = rows.filter((r) =>
    condition === "all" ? true : r.condition === condition
  );

  filtered.sort((a, b) => {
    const codeA = a.product?.product_code ?? "";
    const codeB = b.product?.product_code ?? "";
    if (codeA !== codeB) return codeA.localeCompare(codeB);
    const batchA = a.batch_code ?? "";
    const batchB = b.batch_code ?? "";
    if (batchA !== batchB) return batchA.localeCompare(batchB);
    return (a.expiration_date ?? "").localeCompare(b.expiration_date ?? "");
  });

  return filtered;
}

function buildChartData(rows: Row[], condition: ConditionKey): Point[] {
  const filtered = filterAndSortRows(rows, condition);
  const grouped = new Map<string, Point>();

  for (const r of filtered) {
    const productLabel = r.product
      ? `[${r.product.product_code}] ${r.product.name}`
      : r.product_id.slice(0, 8) + "…";
    const exp = formatDateYMD(r.expiration_date) || "-";
    const key = `${r.product_id}::${exp}`;

    const prev = grouped.get(key) ?? {
      label: productLabel,
      normal: 0,
      refurb: 0,
      disposal: 0,
      undecided: 0,
    };
    prev[r.condition] += Number(r.quantity ?? 0);
    grouped.set(key, prev);
  }

  return Array.from(grouped.values());
}

function computeRowSpan(rows: Row[]): number[] {
  const spans = new Array<number>(rows.length).fill(0);
  let i = 0;
  while (i < rows.length) {
    const start = i;
    const pid = rows[i].product_id;
    while (i < rows.length && rows[i].product_id === pid) i += 1;
    spans[start] = i - start;
  }
  return spans;
}

export function StockByProductPanel({
  initialRows,
  locationId,
}: {
  initialRows: Row[];
  locationId?: string;
}) {
  const [rows, setRows] = React.useState<Row[]>(initialRows);
  const [condition, setCondition] = React.useState<ConditionKey>("all");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const data = React.useMemo(
    () => buildChartData(rows, condition),
    [rows, condition]
  );
  const visibleRows = React.useMemo(
    () => filterAndSortRows(rows, condition),
    [rows, condition]
  );
  const rowSpans = React.useMemo(() => computeRowSpan(visibleRows), [visibleRows]);

  React.useEffect(() => {
    setRows(initialRows);
  }, [initialRows, locationId]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = locationId
        ? `?location=${encodeURIComponent(locationId)}`
        : "";
      const res = await fetch(`/dashboard/stock-summary${query}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.message ?? `Failed to refresh (HTTP ${res.status})`);
        return;
      }
      setRows(Array.isArray(json) ? (json as Row[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={condition}
          onValueChange={(v) => setCondition(v as ConditionKey)}
        >
          <ToggleGroupItem value="all">전체</ToggleGroupItem>
          <ToggleGroupItem value="normal">정상</ToggleGroupItem>
          <ToggleGroupItem value="refurb">리퍼</ToggleGroupItem>
          <ToggleGroupItem value="disposal">폐기</ToggleGroupItem>
          <ToggleGroupItem value="undecided">미정</ToggleGroupItem>
        </ToggleGroup>

        <Button type="button" variant="outline" onClick={refresh} disabled={loading}>
          {loading ? "새로고침 중..." : "새로고침"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <StockByProductChart data={data} />

      <div className="pt-2">
        <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
          재고 데이터 테이블
        </h3>
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">상품명</TableHead>
                <TableHead className="w-[200px] text-center">배치번호</TableHead>
                <TableHead className="w-[150px] text-center">유통기한</TableHead>
                <TableHead className="w-[80px] text-center">수량</TableHead>
                <TableHead className="w-[80px] text-center">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!visibleRows.length ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-16 text-center text-sm text-muted-foreground"
                  >
                    데이터 없음
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((r, idx) => (
                  <TableRow
                    key={`${r.product_id}-${r.batch_code}-${r.expiration_date}-${idx}`}
                  >
                    {rowSpans[idx] > 0 && (
                      <TableCell className="text-sm align-middle" rowSpan={rowSpans[idx]}>
                        {r.product
                          ? `[${r.product.product_code}] ${r.product.name}`
                          : r.product_id.slice(0, 8) + "…"}
                      </TableCell>
                    )}
                    <TableCell className="text-center  text-xs text-gray-700 dark:text-gray-300">
                      {r.batch_code ?? "-"}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {formatDateYMD(r.expiration_date) || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(r.quantity).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge condition={r.condition} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ condition }: { condition: Row["condition"] }) {
  const map: Record<Row["condition"], { label: string; className: string }> = {
    normal: {
      label: "정상",
      className:
        "bg-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-0",
    },
    refurb: {
      label: "리퍼",
      className:
        "bg-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-0",
    },
    disposal: {
      label: "폐기",
      className:
        "bg-red-200 text-red-800 dark:bg-red-950 dark:text-red-300 border-0",
    },
    undecided: {
      label: "미정",
      className:
        "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-0",
    },
  };

  const cfg = map[condition];

  return (
    <Badge
      variant="outline"
      className={`px-2 py-0.5 text-xs font-medium border-none ${cfg.className}`}
    >
      {cfg.label}
    </Badge>
  );
}

