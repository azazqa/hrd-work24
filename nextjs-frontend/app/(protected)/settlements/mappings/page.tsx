import { fetchClientMappings } from "@/components/actions/client-mappings-action";
import { PagePagination } from "@/components/page-pagination";

import { ClientMappingsList, ClientMappingsListHeader } from "./mappings-list";
import { MappingsSearchForm } from "./mappings-search-form";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    q?: string;
  }>;
}

function buildExtraQuery(p: Awaited<PageProps["searchParams"]>): string {
  const parts: string[] = [];
  const add = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
  };
  add("q", p.q);
  return parts.join("&");
}

export default async function ClientMappingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;
  const extraQuery = buildExtraQuery(params);

  const data = await fetchClientMappings(page, size, params.q);

  const totalItems = "message" in data ? 0 : (data.total ?? 0);
  const totalPages =
    "message" in data
      ? 0
      : (data.pages ?? Math.max(1, Math.ceil(totalItems / size) || 1));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">고객사 맵핑</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Work24 훈련기관명과 정산 고객사명을 맵핑합니다.
        </p>
      </div>

      <section className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <MappingsSearchForm size={size} initial={{ q: params.q }} />
      </section>

      <section className="mt-8 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <ClientMappingsListHeader />
        {"message" in data ? (
          <p className="text-sm text-destructive">{data.message}</p>
        ) : (
          <ClientMappingsList items={data.items ?? []} />
        )}

        <PagePagination
          currentPage={page}
          totalPages={Math.max(1, totalPages)}
          pageSize={size}
          totalItems={totalItems}
          basePath="/settlements/mappings"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}
