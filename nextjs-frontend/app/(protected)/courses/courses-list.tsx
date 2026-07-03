import type { CourseListItem } from "@/app/openapi-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  items: CourseListItem[];
};

export function CoursesList({ items }: Props) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">과정 목록</h2>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>훈련과정명</TableHead>
              <TableHead>훈련기관명</TableHead>
              <TableHead>훈련시작일</TableHead>
              <TableHead>훈련종료일</TableHead>
              <TableHead>주소</TableHead>
              <TableHead>전화번호</TableHead>
              <TableHead className="text-right">정원</TableHead>
              <TableHead className="text-right">신청인원</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  조회 결과가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow
                  key={`${row.trainst_cst_id ?? ""}-${row.trpr_id ?? ""}-${row.trpr_degr ?? ""}`}
                >
                  <TableCell className="max-w-[240px]">
                    {row.title_link ? (
                      <a
                        href={row.title_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {row.course_name ?? "-"}
                      </a>
                    ) : (
                      row.course_name ?? "-"
                    )}
                  </TableCell>
                  <TableCell>{row.inst_name ?? "-"}</TableCell>
                  <TableCell>{row.tra_start_date ?? "-"}</TableCell>
                  <TableCell>{row.tra_end_date ?? "-"}</TableCell>
                  <TableCell className="max-w-[160px]">{row.address ?? "-"}</TableCell>
                  <TableCell>{row.tel_no ?? "-"}</TableCell>
                  <TableCell className="text-right">{row.yard_man ?? "-"}</TableCell>
                  <TableCell className="text-right">{row.reg_course_man ?? "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
