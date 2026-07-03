import { CircleHelp } from "lucide-react";

import { fetchSettlements, type SettlementListSearch } from "@/components/actions/settlements-action";
import { PagePagination } from "@/components/page-pagination";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SettlementSearchForm } from "./settlement-search-form";
import { SettlementTable } from "@/app/(protected)/settlements/settlement-table";

interface SettlementsPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    state?: string;
    channel_ids?: string;
    mall_product_name?: string;
    invoice_number?: string;
    settled_date_start?: string;
    settled_date_end?: string;
    completed_date_start?: string;
    completed_date_end?: string;
  }>;
}

function buildSearchQuery(p: Awaited<SettlementsPageProps["searchParams"]>): string {
  const parts: string[] = [];
  const add = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
  };
  add("state", p.state);
  add("channel_ids", p.channel_ids);
  add("mall_product_name", p.mall_product_name);
  add("invoice_number", p.invoice_number);
  add("settled_date_start", p.settled_date_start);
  add("settled_date_end", p.settled_date_end);
  add("completed_date_start", p.completed_date_start);
  add("completed_date_end", p.completed_date_end);
  return parts.join("&");
}

function searchFromParams(p: Awaited<SettlementsPageProps["searchParams"]>): SettlementListSearch {
  return {
    state: p.state as SettlementListSearch["state"],
    channel_ids: p.channel_ids
      ? p.channel_ids
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
    mall_product_name: p.mall_product_name,
    invoice_number: p.invoice_number,
    settled_date_start: p.settled_date_start,
    settled_date_end: p.settled_date_end,
    completed_date_start: p.completed_date_start,
    completed_date_end: p.completed_date_end,
  };
}

export default async function SettlementsPage({ searchParams }: SettlementsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;

  const extraQuery = buildSearchQuery(params);
  const search = searchFromParams(params);

  const settlements = await fetchSettlements(page, size, search);
  const totalPages =
    "message" in settlements ? 0 : Math.ceil((settlements.total || 0) / size);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        정산 관리
        <Tooltip>
          <TooltipTrigger className="inline-block ml-2">
            <CircleHelp className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>배송(송장 업로드)된 주문만 정산 대상으로 관리합니다.</p>
          </TooltipContent>
        </Tooltip>
      </h2>

      <section className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-900">
        <SettlementSearchForm
          size={size}
          initial={{
            state: params.state,
            channel_ids: params.channel_ids,
            mall_product_name: params.mall_product_name,
            invoice_number: params.invoice_number,
            settled_date_start: params.settled_date_start,
            settled_date_end: params.settled_date_end,
            completed_date_start: params.completed_date_start,
            completed_date_end: params.completed_date_end,
          }}
        />
      </section>

      <section className="p-6 bg-white rounded-lg shadow-lg mt-8 dark:bg-gray-900">
        {"message" in settlements ? (
          <p className="text-sm text-destructive">{settlements.message}</p>
        ) : (
          <SettlementTable items={settlements.items ?? []} />
        )}

        <PagePagination
          currentPage={page}
          totalPages={Math.max(1, totalPages)}
          pageSize={size}
          totalItems={"message" in settlements ? 0 : settlements.total || 0}
          basePath="/settlements"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}

