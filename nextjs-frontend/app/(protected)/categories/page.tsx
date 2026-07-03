import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableHeader,
} from "@/components/ui/table";
import { fetchCategories } from "@/components/actions/categories-action";
import { CategoryDeleteButton } from "./deleteButton";
import { PageCategoryRead } from "@/app/openapi-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageSizeSelector } from "@/components/page-size-selector";
import { PagePagination } from "@/components/page-pagination";
import { CategorySearchForm } from "./category-search-form";
import { CircleHelp, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { canServer } from "@/lib/server-permissions";

interface CategoriesPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    name?: string;
    description?: string;
  }>;
}

function buildCategorySearchQuery(
  p: Awaited<CategoriesPageProps["searchParams"]>,
): string {
  const parts: string[] = [];
  const add = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
  };
  add("name", p.name);
  add("description", p.description);
  return parts.join("&");
}

export default async function CategoriesPage({
  searchParams,
}: CategoriesPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;
  const extraQuery = buildCategorySearchQuery(params);

  const categories = (await fetchCategories(page, size, undefined, {
    name: params.name,
    description: params.description,
  })) as PageCategoryRead;
  const totalPages = Math.ceil((categories.total || 0) / size);
  const canCreate = await canServer("categories", "create");
  const canUpdate = await canServer("categories", "update");
  const canDelete = await canServer("categories", "delete");

  const displayName = (c: { name: string; parent_id?: string | null; parent_name?: string | null }) => {
    const parent = c.parent_name?.trim();
    if (c.parent_id && parent) return `${parent} - ${c.name}`;
    return c.name;
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        카테고리 관리
        <Tooltip>
          <TooltipTrigger className="inline-block ml-2">
            <CircleHelp className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>상품 카테고리를 등록하고 관리할 수 있습니다.</p>
          </TooltipContent>
        </Tooltip>
      </h2>

      <section className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-900">
        <CategorySearchForm
          size={size}
          initial={{ name: params.name, description: params.description }}
        />
      </section>

      <section className="p-6 bg-white rounded-lg shadow-lg mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">카테고리 목록</h2>
          {canCreate && (
            <Link href="/categories/add">
              <Button variant="outline" className="text-lg px-4 py-2 bg-primary text-white hover:bg-primary/90 hover:text-white">
                카테고리 등록
              </Button>
            </Link>
          )}
        </div>

        <Table className="min-w-full text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">카테고리명</TableHead>
              <TableHead>설명</TableHead>
              {(canUpdate || canDelete) && (
                <TableHead className="text-center w-[140px]">관리</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!categories.items?.length ? (
              <TableRow>
                <TableCell colSpan={canUpdate || canDelete ? 3 : 2} className="text-center">
                  등록된 카테고리가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              categories.items.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{displayName(category)}</TableCell>
                  <TableCell className="text-gray-600">
                    {category.description || "-"}
                  </TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canUpdate && (
                          <Link href={`/categories/${category.id}/edit`} title="수정">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-blue-600 hover:bg-accent"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}
                        {canDelete && <CategoryDeleteButton categoryId={category.id} />}
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
          totalPages={totalPages}
          pageSize={size}
          totalItems={categories.total || 0}
          basePath="/categories"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}
