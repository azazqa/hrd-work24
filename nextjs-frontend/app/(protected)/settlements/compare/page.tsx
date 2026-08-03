import { compareOwnedSettlements } from "@/components/actions/settlements-action";

import { CompareOwnedClient } from "./compare-client";

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function CompareOwnedPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const yearRaw = params.year?.trim();
  const yearNum = yearRaw ? Number(yearRaw) : undefined;
  const year =
    yearNum != null && Number.isFinite(yearNum) && yearNum >= 2000 && yearNum <= 2100
      ? yearNum
      : undefined;

  let result = null;
  let error: string | null = null;
  if (year != null) {
    const data = await compareOwnedSettlements(year);
    if ("message" in data) {
      error = data.message;
    } else {
      result = data;
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">보유과정 정산 비교</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          개설된 보유과정과 정산을 비교하여 미정산·맵핑 누락을 확인합니다.
        </p>
      </div>

      <section className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <CompareOwnedClient year={year} result={result} error={error} />
      </section>
    </div>
  );
}
