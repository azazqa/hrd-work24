import { Suspense } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogisticsLocationFilter } from "../dashboard/logistics-filter";
import {
  fetchAllStockHistories,
  type PageStockHistoryList,
} from "@/components/actions/stocks-action";
import { PagePagination } from "@/components/page-pagination";
import { PageSizeSelector } from "@/components/page-size-selector";
import { formatDateTimeInSeoul } from "@/lib/date-utils";
import { ProductCellWithPopover } from "@/app/(protected)/orders/ProductCellWithPopover";
import {
  StockHistorySearchForm,
  type StockHistorySearchInitial,
} from "./stock-history-search-form";

const ACTION_LABELS: Record<string, string> = {
  inbound: "입고",
  restock: "재입고",
  outbound: "출고",
  condition_change: "상태 변경",
  transfer: "물류지 이동",
  admin_edit: "관리자 수정",
  deleted: "삭제",
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    location?: string;
    product_query?: string;
    batch_code?: string;
    reason?: string;
    action_type?: string;
  }>;
}

export default async function StockHistoriesPage({ searchParams }: PageProps) {
  const p = await searchParams;
  const page = Number(p.page) || 1;
  const size = Number(p.size) || 20;
  const locationId =
    p.location && p.location.trim() ? p.location.trim() : undefined;
  const search: StockHistorySearchInitial = {
    product_query: p.product_query,
    batch_code: p.batch_code,
    reason: p.reason,
    action_type: p.action_type,
  };

  const [historyResult] = await Promise.all([
    fetchAllStockHistories(page, size, locationId, search),
  ]);
  const basePath = "/stocks/histories";
  const extraQueryParts: string[] = [];
  if (locationId) extraQueryParts.push(`location=${encodeURIComponent(locationId)}`);
  if (p.product_query?.trim())
    extraQueryParts.push(
      `product_query=${encodeURIComponent(p.product_query.trim())}`,
    );
  if (p.batch_code?.trim())
    extraQueryParts.push(`batch_code=${encodeURIComponent(p.batch_code.trim())}`);
  if (p.reason?.trim())
    extraQueryParts.push(`reason=${encodeURIComponent(p.reason.trim())}`);
  if (p.action_type?.trim())
    extraQueryParts.push(
      `action_type=${encodeURIComponent(p.action_type.trim())}`,
    );
  const extraQuery = extraQueryParts.join("&") || undefined;

  const data =
    "message" in historyResult ? null : (historyResult as PageStockHistoryList);
  const totalPages = data ? Math.max(1, data.pages || 1) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">재고 이력</h2>
        <p className="text-muted-foreground">
          입고·재입고·출고 등 재고 변동 이력을 조회합니다.
        </p>
      </div>

      <section className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-900">
        <Suspense
          fallback={
            <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
          }
        >
          <LogisticsLocationFilter />
        </Suspense>

        <StockHistorySearchForm
          size={size}
          initial={{
            product_query: p.product_query,
            batch_code: p.batch_code,
            reason: p.reason,
            action_type: p.action_type,
          }}
        />
      </section>

      <section className="p-6 bg-white rounded-lg shadow-lg mt-8 dark:bg-gray-900">
        <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>이력 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <p className="text-sm text-destructive">
              {(historyResult as { message: string }).message}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[168px]">
                      <span className="block">일시</span>
                    </TableHead>
                    <TableHead className="w-[200px] min-w-[180px]">
                      사용자
                    </TableHead>
                    <TableHead className="w-[100px]">유형</TableHead>
                    <TableHead>상품</TableHead>
                    <TableHead className="w-[120px]">물류지</TableHead>
                    <TableHead className="w-[120px]">배치코드</TableHead>
                    <TableHead className="w-[90px]">변동</TableHead>
                    <TableHead className="w-[90px]">잔여</TableHead>
                    <TableHead>사유</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data.items?.length ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        이력이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.items.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="whitespace-nowrap text-sm text-center">
                          {formatDateTimeInSeoul(h.created_at)}
                        </TableCell>
                        <TableCell className="text-sm break-all max-w-[240px] text-center">
                          {h.update_user_email?.trim()
                            ? h.update_user_email
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-center">
                          {ACTION_LABELS[h.action_type] ?? h.action_type}
                        </TableCell>
                        <TableCell>
                          <ProductCellWithPopover
                            product={h.product ?? undefined}
                            productId={h.product_id}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-center">
                          {h.logistics_location?.name ?? "-"}
                        </TableCell>
                        <TableCell className=" text-xs text-center">
                          {h.batch_code ?? "-"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            h.action_quantity > 0
                              ? "text-red-600"
                              : h.action_quantity < 0
                                ? "text-blue-600"
                                : ""
                          }`}
                        >
                          {h.action_quantity > 0 ? "+" : ""}
                          {Number(h.action_quantity).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(h.quantity).toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {h.reason ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <PagePagination
                currentPage={page}
                totalPages={totalPages}
                pageSize={size}
                totalItems={data.total ?? 0}
                basePath={basePath}
                extraQuery={extraQuery}
              />
            </>
          )}
        </CardContent>
        </Card>
      </section>
    </div>
  );
}
