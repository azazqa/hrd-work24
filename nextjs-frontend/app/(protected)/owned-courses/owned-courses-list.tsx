import type { OwnedCourseListItem } from "@/app/openapi-client";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ExcelImportDialog } from "./excel-import-dialog";

export function OwnedCoursesListHeader() {
  return (
    <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
      <h2 className="text-xl font-semibold">보유 과정 목록</h2>
      <div className="flex flex-wrap gap-2">
        <ExcelImportDialog />
        <Button asChild>
          <Link href="/owned-courses/add">등록</Link>
        </Button>
      </div>
    </div>
  );
}

type Props = {
  items: OwnedCourseListItem[];
};

export function OwnedCoursesList({ items }: Props) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20 text-center">ID</TableHead>
            <TableHead className="w-24 text-center">개발년도</TableHead>
            <TableHead className="w-28 text-center">구분</TableHead>
            <TableHead className="text-center">과정명</TableHead>
            <TableHead className="w-24 text-center">사용여부</TableHead>
            <TableHead className="w-20 text-center">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                조회 결과가 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-center">{row.id}</TableCell>
                <TableCell className="text-center">{row.dev_year ?? "-"}</TableCell>
                <TableCell className="text-center">{row.division ?? "-"}</TableCell>
                <TableCell className="max-w-[360px]">{row.course_name}</TableCell>
                <TableCell className="text-center">
                  <span
                    className={
                      row.is_active
                        ? "text-green-700 dark:text-green-400"
                        : "text-muted-foreground"
                    }
                  >
                    {row.is_active ? "사용" : "미사용"}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/owned-courses/${row.id}/edit`}>수정</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
