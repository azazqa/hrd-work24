import { fetchOwnedCourses } from "@/components/actions/owned-courses-action";
import { PagePagination } from "@/components/page-pagination";
import { loadCompanyNameById } from "@/lib/company-name-map";

import { OwnedCoursesList, OwnedCoursesListHeader } from "./owned-courses-list";
import { OwnedCoursesSearchForm } from "./owned-courses-search-form";

interface OwnedCoursesPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    company_id?: string;
    q?: string;
    dev_year?: string;
    division?: string;
    is_active?: string;
  }>;
}

function buildExtraQuery(p: Awaited<OwnedCoursesPageProps["searchParams"]>): string {
  const parts: string[] = [];
  const add = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
  };
  add("company_id", p.company_id);
  add("q", p.q);
  add("dev_year", p.dev_year);
  add("division", p.division);
  add("is_active", p.is_active);
  return parts.join("&");
}

export default async function OwnedCoursesPage({ searchParams }: OwnedCoursesPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;
  const extraQuery = buildExtraQuery(params);

  const isActiveParam = params.is_active?.trim();
  const is_active =
    isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
  const devYearRaw = params.dev_year?.trim();
  const dev_year = devYearRaw ? Number(devYearRaw) : undefined;
  const companyIdRaw = params.company_id?.trim();
  const company_id = companyIdRaw ? Number(companyIdRaw) : undefined;

  const data = await fetchOwnedCourses(page, size, {
    company_id:
      company_id != null && Number.isFinite(company_id) ? company_id : undefined,
    q: params.q,
    is_active,
    dev_year: dev_year != null && Number.isFinite(dev_year) ? dev_year : undefined,
    division: params.division,
  });
  const companyNameById = await loadCompanyNameById();

  const totalItems = "message" in data ? 0 : (data.total ?? 0);
  const totalPages =
    "message" in data
      ? 0
      : (data.pages ?? Math.max(1, Math.ceil(totalItems / size)));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">보유 과정</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          자사 보유 과정 마스터를 등록·조회·관리합니다.
        </p>
      </div>

      <section className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <OwnedCoursesSearchForm
          size={size}
          initial={{
            company_id: params.company_id,
            q: params.q,
            dev_year: params.dev_year,
            division: params.division,
            is_active: params.is_active,
          }}
        />
      </section>

      <section className="mt-8 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <OwnedCoursesListHeader />
        {"message" in data ? (
          <p className="text-sm text-destructive">{data.message}</p>
        ) : (
          <OwnedCoursesList
            items={data.items ?? []}
            companyNameById={companyNameById}
          />
        )}

        <PagePagination
          currentPage={page}
          totalPages={Math.max(1, totalPages)}
          pageSize={size}
          totalItems={totalItems}
          basePath="/owned-courses"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}
