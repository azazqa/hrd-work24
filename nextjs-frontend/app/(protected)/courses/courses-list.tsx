"use client";

import { useState } from "react";
import { Download, ListChecks } from "lucide-react";

import type { CourseListItem } from "@/app/openapi-client";
import { Button } from "@/components/ui/button";
import { formatNumberWithCommas } from "@/lib/format-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { CourseDetailDialog } from "./course-detail-dialog";
import { ExportCreateDialog } from "./export-create-dialog";
import { ExportListDialog } from "./export-list-dialog";

type Props = {
  items: CourseListItem[];
  exportQuery: string;
};

export function CoursesList({ items, exportQuery }: Props) {
  const [selected, setSelected] = useState<CourseListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const openDetail = (row: CourseListItem) => {
    setSelected(row);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setSelected(null);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">과정 목록</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Download className="mr-2 h-4 w-4" />
            과정 내보내기
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setListOpen(true)}
          >
            <ListChecks className="mr-2 h-4 w-4" />
            과정 다운로드 목록
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="[&_td]:text-center">
          <TableHeader>
            <TableRow>
              <TableHead>훈련기관명</TableHead>
              <TableHead>훈련과정명</TableHead>
              <TableHead className="w-24">훈련과정차수</TableHead>
              <TableHead>훈련시작일</TableHead>
              <TableHead>훈련종료일</TableHead>
              <TableHead>주소</TableHead>
              <TableHead>전화번호</TableHead>
              <TableHead>정원</TableHead>
              <TableHead>수강신청 인원</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  조회 결과가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow
                  key={`${row.trainst_cst_id ?? ""}-${row.trpr_id ?? ""}-${row.trpr_degr ?? ""}`}
                >
                  <TableCell>{row.inst_name ?? "-"}</TableCell>
                  <TableCell className="max-w-[240px]">
                    <button
                      type="button"
                      onClick={() => openDetail(row)}
                      className="text-primary hover:underline"
                    >
                      {row.course_name ?? "-"}
                    </button>
                  </TableCell>
                  <TableCell>{row.trpr_degr ?? "-"}</TableCell>
                  <TableCell>{row.tra_start_date ?? "-"}</TableCell>
                  <TableCell>{row.tra_end_date ?? "-"}</TableCell>
                  <TableCell className="max-w-[160px]">{row.address ?? "-"}</TableCell>
                  <TableCell>{row.tel_no ?? "-"}</TableCell>
                  <TableCell>{formatNumberWithCommas(row.yard_man)}</TableCell>
                  <TableCell>{formatNumberWithCommas(row.reg_course_man)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CourseDetailDialog
        course={selected}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
      />

      <ExportCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        exportQuery={exportQuery}
        onCreated={() => setListOpen(true)}
      />

      <ExportListDialog open={listOpen} onOpenChange={setListOpen} />
    </>
  );
}
