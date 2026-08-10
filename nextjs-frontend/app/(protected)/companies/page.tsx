import { fetchCompanies } from "@/components/actions/companies-action";
import { PagePagination } from "@/components/page-pagination";

import { CompaniesList, CompaniesListHeader } from "./companies-list";
import { CompaniesSearchForm } from "./companies-search-form";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    q?: string;
    is_active?: string;
  }>;
}

function buildExtraQuery(p: Awaited<PageProps["searchParams"]>): string {
  const parts: string[] = [];
  const add = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
  };
  add("q", p.q);
  add("is_active", p.is_active);
  return parts.join("&");
}

export default async function CompaniesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;
  const extraQuery = buildExtraQuery(params);

  const isActiveParam = params.is_active?.trim();
  const is_active =
    isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;

  const data = await fetchCompanies(page, size, {
    q: params.q,
    is_active,
  });

  const totalItems = "message" in data ? 0 : (data.total ?? 0);
  const totalPages =
    "message" in data
      ? 0
      : (data.pages ?? Math.max(1, Math.ceil(totalItems / size) || 1));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">업체 관리</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          보유과정·정산·비교를 분리할 업체를 등록·관리합니다.
        </p>
      </div>

      <section className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <CompaniesSearchForm
          size={size}
          initial={{ q: params.q, is_active: params.is_active }}
        />
      </section>

      <section className="mt-8 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <CompaniesListHeader />
        {"message" in data ? (
          <p className="text-sm text-destructive">{data.message}</p>
        ) : (
          <CompaniesList items={data.items ?? []} />
        )}

        <PagePagination
          currentPage={page}
          totalPages={Math.max(1, totalPages)}
          pageSize={size}
          totalItems={totalItems}
          basePath="/companies"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}
