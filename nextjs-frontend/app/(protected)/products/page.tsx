import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableHeader,
} from "@/components/ui/table";
import {
  fetchProducts,
  fetchCategoriesForSelect,
  type ProductListSearch,
} from "@/components/actions/products-action";
import { ProductDeleteButton } from "./deleteButton";
import { ProductEditDialog } from "./product-edit-dialog";
import { PageProductRead } from "@/app/openapi-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PagePagination } from "@/components/page-pagination";
import { ProductSearchForm } from "./product-search-form";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { canServer } from "@/lib/server-permissions";

const stateLabel: Record<string, string> = {
  active: "판매중",
  inactive: "비활성",
  discontinued: "단종",
};

interface ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    product_code?: string;
    name?: string;
    description?: string;
    is_tax?: string;
    tax_rate_min?: string;
    tax_rate_max?: string;
    max_shipping_min?: string;
    max_shipping_max?: string;
    state?: string;
  }>;
}

function buildProductSearchQuery(
  p: Awaited<ProductsPageProps["searchParams"]>,
): string {
  const parts: string[] = [];
  const add = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
  };
  add("product_code", p.product_code);
  add("name", p.name);
  add("description", p.description);
  if (p.is_tax === "true" || p.is_tax === "false") {
    add("is_tax", p.is_tax);
  }
  add("tax_rate_min", p.tax_rate_min);
  add("tax_rate_max", p.tax_rate_max);
  add("max_shipping_min", p.max_shipping_min);
  add("max_shipping_max", p.max_shipping_max);
  if (
    p.state === "active" ||
    p.state === "inactive" ||
    p.state === "discontinued"
  ) {
    add("state", p.state);
  }
  return parts.join("&");
}

function searchFromParams(
  p: Awaited<ProductsPageProps["searchParams"]>,
): ProductListSearch {
  return {
    product_code: p.product_code,
    name: p.name,
    description: p.description,
    is_tax: p.is_tax,
    tax_rate_min: p.tax_rate_min,
    tax_rate_max: p.tax_rate_max,
    max_shipping_min: p.max_shipping_min,
    max_shipping_max: p.max_shipping_max,
    state: p.state,
  };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;
  const extraQuery = buildProductSearchQuery(params);

  const products = (await fetchProducts(page, size, searchFromParams(params))) as
    | PageProductRead
    | { message: string };
  const totalPages =
    "message" in products
      ? 0
      : Math.ceil((products.total || 0) / size);
  const canCreate = await canServer("products", "create");
  const canUpdate = await canServer("products", "update");
  const canDelete = await canServer("products", "delete");
  const categories = canUpdate ? await fetchCategoriesForSelect() : [];
  const showManage = canUpdate || canDelete;

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        상품 관리
        <Tooltip>
          <TooltipTrigger className="inline-block ml-2">
            <CircleHelp className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>상품을 등록하고 관리할 수 있습니다.</p>
          </TooltipContent>
        </Tooltip>
      </h2>

      <section className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-900">
        <ProductSearchForm
          size={size}
          initial={{
            product_code: params.product_code,
            name: params.name,
            description: params.description,
            is_tax: params.is_tax,
            state: params.state,
            tax_rate_min: params.tax_rate_min,
            tax_rate_max: params.tax_rate_max,
            max_shipping_min: params.max_shipping_min,
            max_shipping_max: params.max_shipping_max,
          }}
        />
      </section>

      <section className="p-6 bg-white rounded-lg shadow-lg mt-8 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">상품 목록</h2>
          <div className="flex flex-wrap items-center gap-3">
            {canCreate && (
              <Link href="/products/add">
                <Button className="text-lg px-4 py-2 bg-primary text-primary-foreground">
                  상품 등록
                </Button>
              </Link>
            )}
          </div>
        </div>

        {"message" in products ? (
          <p className="text-sm text-destructive">{products.message}</p>
        ) : (
          <>
            <Table className="min-w-full text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">상품코드</TableHead>
                  <TableHead className="w-[200px]">상품명</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead className="text-center w-[90px]">가격</TableHead>
                  <TableHead className="text-center w-[70px]">과세</TableHead>
                  <TableHead className="text-center w-[80px]">세율</TableHead>
                  <TableHead className="text-center w-[120px]">최대 배송</TableHead>
                  <TableHead className="text-center w-[100px]">상태</TableHead>
                  {showManage && <TableHead className="text-center w-[110px]">관리</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!products.items?.length ? (
                  <TableRow>
                    <TableCell colSpan={showManage ? 9 : 8} className="text-center">
                      등록된 상품이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.items.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="">
                        {product.product_code ?? "-"}
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-gray-600">
                        {product.description || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {product.price != null ? product.price : 0}
                      </TableCell>
                      <TableCell className="text-center">
                        {product.is_tax ? "과세" : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {product.tax_rate != null ? `${product.tax_rate}%` : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {product.max_shipping_number != null
                          ? product.max_shipping_number
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {stateLabel[product.state ?? "active"] ?? product.state}
                      </TableCell>
                      {showManage && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {canUpdate && (
                              <ProductEditDialog product={product} categories={categories} />
                            )}
                            {canDelete && <ProductDeleteButton productId={product.id} />}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <PagePagination
              currentPage={page}
              totalPages={Math.max(1, totalPages)}
              pageSize={size}
              totalItems={products.total || 0}
              basePath="/products"
              extraQuery={extraQuery}
            />
          </>
        )}
      </section>
    </div>
  );
}
