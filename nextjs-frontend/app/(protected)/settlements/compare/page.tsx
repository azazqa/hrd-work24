import {
  compareOwnedSettlements,
  fetchCompareOwnedItems,
  type OwnedSettlementCompareStatus,
} from "@/components/actions/settlements-action";
import { getSettlementCompareYearOptions } from "@/lib/date-utils";
import { redirect } from "next/navigation";

import { CompareOwnedClient } from "./compare-client";

const TABS: OwnedSettlementCompareStatus[] = [
  "unsettled",
  "partial",
  "unmapped",
  "matched",
];

interface PageProps {
  searchParams: Promise<{
    year?: string;
    tab?: string;
    page?: string;
    size?: string;
  }>;
}

export default async function CompareOwnedPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const yearOptions = getSettlementCompareYearOptions();
  const defaultYear = yearOptions[0] ?? new Date().getFullYear();
  const yearRaw = params.year?.trim();
  const yearNum = yearRaw ? Number(yearRaw) : undefined;
  const year =
    yearNum != null && Number.isFinite(yearNum) && yearOptions.includes(yearNum)
      ? yearNum
      : defaultYear;

  if (!yearRaw || yearNum !== year) {
    const q = new URLSearchParams();
    q.set("year", String(year));
    q.set("tab", "unsettled");
    q.set("page", "1");
    q.set("size", params.size?.trim() || "50");
    redirect(`/settlements/compare?${q.toString()}`);
  }

  const tabRaw = (params.tab ?? "unsettled").trim();
  const tab: OwnedSettlementCompareStatus = TABS.includes(
    tabRaw as OwnedSettlementCompareStatus,
  )
    ? (tabRaw as OwnedSettlementCompareStatus)
    : "unsettled";

  const pageRaw = Number(params.page ?? "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const sizeRaw = Number(params.size ?? "50");
  const size =
    Number.isFinite(sizeRaw) && sizeRaw >= 1
      ? Math.min(Math.floor(sizeRaw), 500)
      : 50;

  let result = null;
  let itemsPage = null;
  let error: string | null = null;

  const data = await compareOwnedSettlements(year);
  if ("message" in data) {
    error = data.message;
  } else {
    result = data;
    if (data.has_result || data.cache_hit) {
      const items = await fetchCompareOwnedItems(year, tab, page, size);
      if ("message" in items) {
        error = items.message;
      } else {
        itemsPage = items;
      }
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
        <CompareOwnedClient
          year={year}
          tab={tab}
          page={page}
          size={size}
          result={result}
          itemsPage={itemsPage}
          error={error}
        />
      </section>
    </div>
  );
}
