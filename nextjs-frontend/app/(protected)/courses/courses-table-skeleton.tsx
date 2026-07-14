import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const COLUMNS: { label: string; className?: string }[] = [
  { label: "훈련기관명" },
  { label: "훈련과정명" },
  { label: "훈련과정차수", className: "w-24" },
  { label: "훈련시작일" },
  { label: "훈련종료일" },
  { label: "주소" },
  { label: "전화번호" },
  { label: "정원" },
  { label: "수강신청 인원" },
];

export function CoursesTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">과정 목록</h2>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((c) => (
                <TableHead key={c.label} className={c.className}>
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, r) => (
              <TableRow key={r}>
                {COLUMNS.map((c) => (
                  <TableCell key={c.label} className="text-center">
                    <Skeleton className="mx-auto h-4 w-full max-w-[120px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="my-4 flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-64" />
      </div>
    </>
  );
}
