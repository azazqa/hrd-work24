"use client";

import { useRouter } from "next/navigation";

import type { SettlementListRead } from "@/components/actions/settlements-action";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeInSeoul } from "@/lib/date-utils";

import {
  PendingSettlementExcelDownloadButton,
  SettlementExcelUploadDialog,
} from "./settlement-actions";
import { SettlementConfirmDialog } from "./settlement-confirm-dialog";

function stateLabelKo(state: string) {
  switch (state) {
    case "pending":
      return "대기";
    case "settled":
      return "정산";
    case "completed":
      return "완료";
    case "reject":
      return "반려";
    case "cancelled":
      return "취소";
    default:
      return state;
  }
}

function stateBadgeClass(state: string) {
  switch (state) {
    case "pending":
      return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 hover:bg-green-100 hover:text-green-700";
    case "settled":
      return "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200 hover:bg-amber-100 hover:text-amber-800";
    case "completed":
      return "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 hover:bg-sky-100 hover:text-sky-700";
    case "reject":
      return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 hover:bg-red-100 hover:text-red-700";
    case "cancelled":
      return "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200 hover:bg-gray-200 hover:text-gray-700";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200 hover:bg-gray-200 hover:text-gray-700";
  }
}

export function SettlementTable({ items }: { items: SettlementListRead[] }) {
  const router = useRouter();

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-semibold">정산 목록</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <PendingSettlementExcelDownloadButton />
          <SettlementExcelUploadDialog onUploaded={() => router.refresh()} />
          <SettlementConfirmDialog />
        </div>
      </div>

      <Table className="min-w-full text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[90px] text-center">상태</TableHead>
            <TableHead className="w-[140px] text-center">채널</TableHead>
            <TableHead className="text-center">상품명(별칭)</TableHead>
            <TableHead className="w-[80px] text-center">수량</TableHead>
            <TableHead className="w-[120px] text-right">주문금액</TableHead>
            <TableHead className="w-[120px] text-right">정산금액</TableHead>
            <TableHead className="w-[160px] text-center">정산일</TableHead>
            <TableHead className="w-[160px] text-center">정산완료일</TableHead>
            <TableHead className="w-[160px] text-center">생성일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!items?.length ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center">
                등록된 정산이 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            items.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-center">
                  <Badge variant="default" className={stateBadgeClass(s.state)}>
                    {stateLabelKo(s.state)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">{s.channel_name ?? "-"}</TableCell>
                <TableCell className="max-w-[520px] truncate">
                  {s.mall_product_name ?? "-"}
                </TableCell>
                <TableCell className="text-center">
                  {s.quantity?.toLocaleString?.("ko-KR") ?? s.quantity ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  {Number(s.order_price ?? 0).toLocaleString("ko-KR")}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {Number(s.price ?? 0).toLocaleString("ko-KR")}
                </TableCell>
                <TableCell className="text-center">
                  {s.settled_at ? formatDateTimeInSeoul(s.settled_at) : "-"}
                </TableCell>
                <TableCell className="text-center">
                  {s.completed_at ? formatDateTimeInSeoul(s.completed_at) : "-"}
                </TableCell>
                <TableCell className="text-center">
                  {formatDateTimeInSeoul(s.created_at)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}

