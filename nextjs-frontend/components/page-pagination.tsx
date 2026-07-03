import { Button } from "@/components/ui/button";
import { PageSizeSelector } from "@/components/page-size-selector";
import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from "@radix-ui/react-icons";

interface PagePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  basePath?: string;
  /** 추가 쿼리 (예: location=uuid). `&` 없이 key=value&key2=value 형태 */
  extraQuery?: string;
}

export function PagePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  basePath = "/dashboard",
  extraQuery,
}: PagePaginationProps) {
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  const suffix = extraQuery?.trim() ? `&${extraQuery.trim()}` : "";

  const buildUrl = (page: number) =>
    `${basePath}?page=${page}&size=${pageSize}${suffix}`;

  return (
    <div className="flex items-center justify-between my-4">
      <div className="text-sm text-gray-600">
        {totalItems === 0 ? (
          <>Showing 0 of 0 results</>
        ) : (
          <>
            전체 {totalItems}건
          </>
        )}
      </div>

      <div className="flex items-center space-x-2">
        {/* First Page */}
        <Link
          href={buildUrl(1)}
          className={!hasPreviousPage ? "pointer-events-none opacity-50" : ""}
        >
          <Button variant="outline" size="sm" disabled={!hasPreviousPage}>
            <DoubleArrowLeftIcon className="h-4 w-4" />
          </Button>
        </Link>

        {/* Previous Page */}
        <Link
          href={buildUrl(currentPage - 1)}
          className={!hasPreviousPage ? "pointer-events-none opacity-50" : ""}
        >
          <Button variant="outline" size="sm" disabled={!hasPreviousPage}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
        </Link>

        {/* Page Info */}
        {totalPages > 0 && (
          <span className="text-sm font-medium">
            Page {currentPage} of {totalPages}
          </span>
        )}

        {/* Next Page */}
        <Link
          href={buildUrl(currentPage + 1)}
          className={hasNextPage ? "" : "pointer-events-none opacity-50"}
        >
          <Button variant="outline" size="sm" disabled={!hasNextPage}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </Link>

        {/* Last Page */}
        <Link
          href={buildUrl(totalPages)}
          className={hasNextPage ? "" : "pointer-events-none opacity-50"}
        >
          <Button variant="outline" size="sm" disabled={!hasNextPage}>
            <DoubleArrowRightIcon className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <PageSizeSelector currentSize={pageSize} basePath={basePath} extraQuery={extraQuery} />
    </div>
  );
}
