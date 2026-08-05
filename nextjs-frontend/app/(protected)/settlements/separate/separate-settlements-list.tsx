import type { SeparateSettlementListItem } from "@/components/actions/settlements-action";
import { formatNumberWithCommas } from "@/lib/format-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { SeparateExcelImportDialog } from "./excel-import-dialog";

export function SeparateSettlementsListHeader() {
  return (
    <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
      <h2 className="text-xl font-semibold">별도 정산 목록</h2>
      <div className="flex flex-wrap gap-2">
        <a
          href="/api/settlements/separate/export"
          download
          className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
        >
          내보내기
        </a>
        <SeparateExcelImportDialog />
      </div>
    </div>
  );
}

function formatAmount(value: string | number | null | undefined): string {
  if (value == null || value === "") return "-";
  return formatNumberWithCommas(String(value));
}

function formatRate(row: SeparateSettlementListItem): string {
  if (row.settlement_rate_raw) return row.settlement_rate_raw;
  if (row.settlement_rate == null || row.settlement_rate === "") return "-";
  return String(row.settlement_rate);
}

type Props = {
  items: SeparateSettlementListItem[];
};

export function SeparateSettlementsList({ items }: Props) {
  return (
    <div className="overflow-x-auto">
      <Table className="[&_td]:text-center">
        <TableHeader>
          <TableRow>
            <TableHead>구분</TableHead>
            <TableHead>계산서(수취)마감일</TableHead>
            <TableHead>고객사</TableHead>
            <TableHead>과정명</TableHead>
            <TableHead>계약기간</TableHead>
            <TableHead>기준매출액</TableHead>
            <TableHead>정산율</TableHead>
            <TableHead>산출정산액</TableHead>
            <TableHead>차감액</TableHead>
            <TableHead>최종정산액</TableHead>
            <TableHead>총액</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-muted-foreground">
                조회 결과가 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.category ?? "-"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.invoice_deadline_date ?? "-"}
                </TableCell>
                <TableCell className="max-w-[140px]">{row.client_name}</TableCell>
                <TableCell className="max-w-[240px] text-left">
                  {row.course_name}
                </TableCell>
                <TableCell className="max-w-[160px] whitespace-nowrap">
                  {row.contract_period ?? "-"}
                </TableCell>
                <TableCell>{formatAmount(row.base_revenue)}</TableCell>
                <TableCell>{formatRate(row)}</TableCell>
                <TableCell>{formatAmount(row.calculated_amount)}</TableCell>
                <TableCell>{formatAmount(row.deduction_amount)}</TableCell>
                <TableCell>{formatAmount(row.final_amount)}</TableCell>
                <TableCell>{formatAmount(row.total_amount)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
