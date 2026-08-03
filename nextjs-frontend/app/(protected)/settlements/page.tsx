import { fetchSettlements } from "@/components/actions/settlements-action";
import { PagePagination } from "@/components/page-pagination";

import { SettlementsList, SettlementsListHeader } from "./settlements-list";
import { SettlementsSearchForm } from "./settlements-search-form";

interface SettlementsPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    year?: string;
    client_name?: string;
    course_name?: string;
  }>;
}

function buildExtraQuery(p: Awaited<SettlementsPageProps["searchParams"]>): string {
  const parts: string[] = [];
  const add = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
  };
  add("year", p.year);
  add("client_name", p.client_name);
  add("course_name", p.course_name);
  return parts.join("&");
}

export default async function SettlementsPage({ searchParams }: SettlementsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;
  const extraQuery = buildExtraQuery(params);

  const yearRaw = params.year?.trim();
  const yearNum = yearRaw ? Number(yearRaw) : undefined;
  const year =
    yearNum != null && Number.isFinite(yearNum) ? yearNum : undefined;

  const data = await fetchSettlements(page, size, {
    year,
    client_name: params.client_name,
    course_name: params.course_name,
  });

  const totalItems = "message" in data ? 0 : (data.total ?? 0);
  const totalPages =
    "message" in data
      ? 0
      : (data.pages ?? Math.max(1, Math.ceil(totalItems / size) || 1));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">정산</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          정산 엑셀을 년도별로 업로드하고 고객사·과정명으로 조회합니다.
        </p>
      </div>

      <section className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <SettlementsSearchForm
          size={size}
          initial={{
            year: params.year,
            client_name: params.client_name,
            course_name: params.course_name,
          }}
        />
      </section>

      <section className="mt-8 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <SettlementsListHeader />
        {"message" in data ? (
          <p className="text-sm text-destructive">{data.message}</p>
        ) : (
          <SettlementsList items={data.items ?? []} />
        )}

        <PagePagination
          currentPage={page}
          totalPages={Math.max(1, totalPages)}
          pageSize={size}
          totalItems={totalItems}
          basePath="/settlements"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}
