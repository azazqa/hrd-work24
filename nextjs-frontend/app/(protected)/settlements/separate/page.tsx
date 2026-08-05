import { fetchSeparateSettlements } from "@/components/actions/settlements-action";
import { PagePagination } from "@/components/page-pagination";

import {
  SeparateSettlementsList,
  SeparateSettlementsListHeader,
} from "./separate-settlements-list";
import { SeparateSettlementsSearchForm } from "./separate-settlements-search-form";

interface SeparateSettlementsPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    year?: string;
    client_name?: string;
    course_name?: string;
  }>;
}

function buildExtraQuery(
  p: Awaited<SeparateSettlementsPageProps["searchParams"]>,
): string {
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

export default async function SeparateSettlementsPage({
  searchParams,
}: SeparateSettlementsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;
  const extraQuery = buildExtraQuery(params);

  const yearRaw = params.year?.trim();
  const yearNum = yearRaw ? Number(yearRaw) : undefined;
  const year =
    yearNum != null && Number.isFinite(yearNum) ? yearNum : undefined;

  const data = await fetchSeparateSettlements(page, size, {
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
        <h2 className="text-2xl font-semibold">별도 정산</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          임대 과정 등 별도 정산 엑셀을 업로드하고 고객사·과정명으로 조회합니다.
          업로드 시 기존 데이터가 전체 교체됩니다.
        </p>
      </div>

      <section className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <SeparateSettlementsSearchForm
          size={size}
          initial={{
            year: params.year,
            client_name: params.client_name,
            course_name: params.course_name,
          }}
        />
      </section>

      <section className="mt-8 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <SeparateSettlementsListHeader />
        {"message" in data ? (
          <p className="text-sm text-destructive">{data.message}</p>
        ) : (
          <SeparateSettlementsList items={data.items ?? []} />
        )}

        <PagePagination
          currentPage={page}
          totalPages={Math.max(1, totalPages)}
          pageSize={size}
          totalItems={totalItems}
          basePath="/settlements/separate"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}
