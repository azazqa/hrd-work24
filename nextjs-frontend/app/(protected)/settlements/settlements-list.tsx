import type { SettlementListItem } from "@/components/actions/settlements-action";
import { formatNumberWithCommas } from "@/lib/format-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ExcelImportDialog } from "./excel-import-dialog";

export function SettlementsListHeader() {
  return (
    <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
      <h2 className="text-xl font-semibold">일반 정산 목록</h2>
      <div className="flex flex-wrap gap-2">
        <a
          href="/settlements/compare"
          className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
        >
          보유과정 비교
        </a>
        <a
          href="/settlements/mappings"
          className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
        >
          고객사 맵핑
        </a>
        <a
          href="/api/settlements/export"
          download
          className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
        >
          내보내기
        </a>
        <ExcelImportDialog />
      </div>
    </div>
  );
}

function formatAmount(value: string | number | null | undefined): string {
  if (value == null || value === "") return "-";
  return formatNumberWithCommas(String(value));
}

type Props = {
  items: SettlementListItem[];
};

export function SettlementsList({ items }: Props) {
  return (
    <div className="overflow-x-auto">
      <Table className="[&_td]:text-center">
        <TableHeader>
          <TableRow>
            <TableHead>매입년월</TableHead>
            <TableHead>매출년월</TableHead>
            <TableHead>고객사</TableHead>
            <TableHead>과정명</TableHead>
            <TableHead>교육기간</TableHead>
            <TableHead>인원</TableHead>
            <TableHead>기준수강료</TableHead>
            <TableHead>순매출액</TableHead>
            <TableHead>정산액</TableHead>
            <TableHead>영업대표</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                조회 결과가 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">{row.purchase_ym}</TableCell>
                <TableCell className="whitespace-nowrap">{row.sales_ym ?? "-"}</TableCell>
                <TableCell className="max-w-[140px]">{row.client_name}</TableCell>
                <TableCell className="max-w-[240px] text-left">
                  {row.course_name}
                </TableCell>
                <TableCell className="max-w-[140px] whitespace-nowrap">
                  {row.education_period ?? "-"}
                </TableCell>
                <TableCell>
                  {row.headcount != null
                    ? formatNumberWithCommas(String(row.headcount))
                    : "-"}
                </TableCell>
                <TableCell>{formatAmount(row.base_tuition)}</TableCell>
                <TableCell>{formatAmount(row.net_sales)}</TableCell>
                <TableCell>{formatAmount(row.settlement_amount)}</TableCell>
                <TableCell>{row.sales_rep ?? "-"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
