import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

type SkeletonTableBodyRowsProps = {
  rows?: number;
  columns?: number;
};

/** `TableBody` 안에만 넣어 사용 — 헤더는 고정, 데이터 영역만 스켈레톤 */
export function SkeletonTableBodyRows({
  rows = 5,
  columns = 3,
}: SkeletonTableBodyRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <TableRow key={ri}>
          {Array.from({ length: columns }).map((_, ci) => (
            <TableCell key={ci}>
              <Skeleton
                className={
                  ci === 0 ? "h-4 w-full max-w-[min(100%,20rem)]" : "mx-auto h-4 w-16"
                }
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** 테이블 없이 단독 블록용(레거시/간단한 자리표시) */
export function SkeletonTable() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2 p-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div className="flex gap-4" key={index}>
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
