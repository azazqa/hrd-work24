import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableHeader,
} from "@/components/ui/table";
import { fetchStocks } from "@/components/actions/stocks-action";
import { fetchLogisticsLocationsForSelect } from "@/components/actions/logistics-locations-action";
import { fetchCategoriesForSelect } from "@/components/actions/categories-action";
import { fetchProductsForStockSelect } from "@/components/actions/stocks-action";
import { StockActions } from "./stock-actions";
import { ProductCellWithPopover } from "@/app/(protected)/orders/ProductCellWithPopover";
import { PageStockListRead } from "@/app/openapi-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PagePagination } from "@/components/page-pagination";
import { StockSearchForm, type StockSearchInitial } from "./stock-search-form";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

function formatStockProductCategory(
  product:
    | {
        category_name?: string | null;
        parent_category_name?: string | null;
      }
    | null
    | undefined,
) {
  const leaf = product?.category_name?.trim();
  if (!leaf) return "-";
  const parent = product?.parent_category_name?.trim();
  return parent ? `${parent} > ${leaf}` : leaf;
}

const CONDITION_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  normal: {
    label: "정상",
    className:
      "bg-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-0",
  },
  refurb: {
    label: "리퍼",
    className:
      "bg-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-0",
  },
  disposal: {
    label: "폐기",
    className:
      "bg-red-200 text-red-800 dark:bg-red-950 dark:text-red-300 border-0",
  },
  undecided: {
    label: "미정",
    className:
      "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-0",
  },
};

function StockConditionBadge({ condition }: { condition: string }) {
  const cfg =
    CONDITION_BADGE[condition] ?? CONDITION_BADGE.undecided;
  return (
    <Badge
      variant="outline"
      className={`px-2 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </Badge>
  );
}

interface StocksPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    product_query?: string;
    logistics_location_name?: string;
    product_barcode?: string;
    batch_code?: string;
    memo?: string;
    condition?: string;
    category_id?: string;
  }>;
}

export default async function StocksPage({ searchParams }: StocksPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;

  const search: StockSearchInitial = {
    product_query: params.product_query,
    logistics_location_name: params.logistics_location_name,
    product_barcode: params.product_barcode,
    batch_code: params.batch_code,
    memo: params.memo,
    condition: params.condition,
    category_id: params.category_id,
  };

  const extraQuery = (() => {
    const parts: string[] = [];
    const add = (k: string, v: string | undefined) => {
      const t = v?.trim();
      if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
    };
    add("product_query", params.product_query);
    add("logistics_location_name", params.logistics_location_name);
    add("product_barcode", params.product_barcode);
    add("batch_code", params.batch_code);
    add("memo", params.memo);
    add("condition", params.condition);
    add("category_id", params.category_id);
    return parts.join("&");
  })();

  const [stocksResult, logisticsLocations, categoriesRaw, productsRaw] = await Promise.all([
    fetchStocks(page, size, search),
    fetchLogisticsLocationsForSelect(),
    fetchCategoriesForSelect(),
    fetchProductsForStockSelect(),
  ]);
  const stocks = stocksResult as PageStockListRead;
  const totalPages = Math.ceil((stocks.total || 0) / size);
  const locationList = Array.isArray(logisticsLocations)
    ? logisticsLocations
    : [];
  const categoryList = Array.isArray(categoriesRaw) ? categoriesRaw : [];
  const products = Array.isArray(productsRaw) ? productsRaw : [];
  const productOptions = products
    .map((p) => ({
      id: String(p.id),
      name: String(p.name ?? ""),
      code: p.product_code ? String(p.product_code) : undefined,
    }))
    .filter((p) => p.id && p.name);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        재고 관리
        <Tooltip>
          <TooltipTrigger className="inline-block ml-2">
            <CircleHelp className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>재고를 등록하고 입출고를 관리할 수 있습니다.</p>
          </TooltipContent>
        </Tooltip>
      </h2>

      <section className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-900">
        <StockSearchForm
          size={size}
          logisticsLocations={locationList}
          categories={categoryList}
          products={productOptions}
          initial={{
            product_query: params.product_query,
            logistics_location_name: params.logistics_location_name,
            product_barcode: params.product_barcode,
            batch_code: params.batch_code,
            memo: params.memo,
            condition: params.condition,
            category_id: params.category_id,
          }}
        />
      </section>

      <section className="p-6 bg-white rounded-lg shadow-lg mt-8 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">재고 목록</h2>
          <Link href="/stocks/add">
            <Button className="text-lg px-4 py-2">
              입고 등록
            </Button>
          </Link>
        </div>
        <Table className="min-w-full text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[88px]">상품 상태</TableHead>
              <TableHead className="w-[200px]">상품</TableHead>
              <TableHead className="w-[140px]">물류지</TableHead>
              <TableHead className="w-[100px]">상품바코드</TableHead>
              <TableHead className="w-[120px]">배치코드</TableHead>
              <TableHead className="w-[80px]">수량</TableHead>
              <TableHead className="w-[120px]">입고일</TableHead>
              <TableHead className="w-[120px]">유통기한</TableHead>
              <TableHead className="w-[160px]">비고</TableHead>
              <TableHead className="w-[120px]">상품 코드</TableHead>
              <TableHead className="w-[140px]">상품 카테고리</TableHead>
              <TableHead className="w-[80px]">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!stocks.items?.length ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center">
                  등록된 재고가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              stocks.items.map((stock) => (
                <TableRow key={stock.id}>
                  <TableCell className="text-center">
                    <StockConditionBadge
                      condition={stock.condition ?? "normal"}
                    />
                  </TableCell>
                  <TableCell>
                    <ProductCellWithPopover
                      product={stock.product ?? undefined}
                      productId={stock.product_id}
                      hideProductCodeInTrigger
                    />
                  </TableCell>
                  <TableCell className="text-gray-700 text-center">
                    {stock.logistics_location?.name ?? "-"}
                  </TableCell>

                  <TableCell className=" text-gray-600 text-center">
                    {stock.product_barcode ?? "-"}
                  </TableCell>
                  <TableCell className=" text-gray-600 text-center">
                    {stock.batch_code ?? "-"}
                  </TableCell>
                  <TableCell className="font-medium text-right">
                    {Number(stock.quantity).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    {formatDate(stock.stock_date)}
                  </TableCell>
                  <TableCell className="text-center">
                    {formatDate(stock.expiration_date)}
                  </TableCell>
                  <TableCell className="text-gray-600 max-w-[160px] truncate" title={stock.memo ?? undefined}>
                    {stock.memo ?? "-"}
                  </TableCell>
                  <TableCell className=" text-gray-700 text-center">
                    {stock.product?.product_code ?? "-"}
                  </TableCell>
                  <TableCell className="text-gray-700 text-center">
                    {formatStockProductCategory(stock.product)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StockActions
                      stock={stock}
                      logisticsLocations={locationList}
                    />
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
          totalItems={stocks.total || 0}
          basePath="/stocks"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}
