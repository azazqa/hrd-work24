import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchShipments, PageShipmentListRead } from "@/components/actions/shipments-action";
import { PageSizeSelector } from "@/components/page-size-selector";
import { PagePagination } from "@/components/page-pagination";
import { formatDateTimeInSeoul } from "@/lib/date-utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TrackingLink } from "@/components/tracking/tracking-link";
import { channelExternalHref } from "@/lib/channel-external-href";
import { CircleHelp, ExternalLink } from "lucide-react";
import { ShipmentSearchForm } from "./shipment-search-form";
import { ShipmentsListWithExport } from "./shipments-list-with-export";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ShipmentsPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    order_status?: string;
    channel_id?: string;
    channel_ids?: string;
    invoice_number?: string;
    receiver_name?: string;
    receiver_phone?: string;
    receiver_zip_code?: string;
    receiver_address?: string;
    product_query?: string;
    order_date_start?: string;
    order_date_end?: string;
    order_placed_date_start?: string;
    order_placed_date_end?: string;
    shipping_date_start?: string;
    shipping_date_end?: string;
  }>;
}

function buildShipmentSearchQuery(
  p: Awaited<ShipmentsPageProps["searchParams"]>,
): string {
  const parts: string[] = [];
  const add = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
  };
  add("order_status", p.order_status);
  add("channel_id", p.channel_id);
  add("channel_ids", p.channel_ids);
  add("invoice_number", p.invoice_number);
  add("receiver_name", p.receiver_name);
  add("receiver_phone", p.receiver_phone);
  add("receiver_zip_code", p.receiver_zip_code);
  add("receiver_address", p.receiver_address);
  add("product_query", p.product_query);
  add("order_date_start", p.order_date_start);
  add("order_date_end", p.order_date_end);
  add("order_placed_date_start", p.order_placed_date_start);
  add("order_placed_date_end", p.order_placed_date_end);
  add("shipping_date_start", p.shipping_date_start);
  add("shipping_date_end", p.shipping_date_end);
  return parts.join("&");
}

export default async function ShipmentsPage({ searchParams }: ShipmentsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;

  const extraQuery = buildShipmentSearchQuery(params);

  const shipments = (await fetchShipments(page, size, {
    order_status: params.order_status,
    channel_ids: params.channel_ids
      ? params.channel_ids
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
    channel_id: params.channel_id,
    invoice_number: params.invoice_number,
    receiver_name: params.receiver_name,
    receiver_phone: params.receiver_phone,
    receiver_zip_code: params.receiver_zip_code,
    receiver_address: params.receiver_address,
    product_query: params.product_query,
    order_date_start: params.order_date_start,
    order_date_end: params.order_date_end,
    order_placed_date_start: params.order_placed_date_start,
    order_placed_date_end: params.order_placed_date_end,
    shipping_date_start: params.shipping_date_start,
    shipping_date_end: params.shipping_date_end,
  })) as PageShipmentListRead;
  const totalPages = Math.ceil((shipments.total || 0) / size);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        배송 관리
        <Tooltip>
          <TooltipTrigger className="inline-block ml-2">
            <CircleHelp className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>발주/배송(Shipment) 목록을 확인할 수 있습니다.</p>
          </TooltipContent>
        </Tooltip>
      </h2>

      <section className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-900">
        <ShipmentSearchForm
          size={size}
          initial={{
            order_status: params.order_status,
            channel_ids: params.channel_ids,
            channel_id: params.channel_id,
            invoice_number: params.invoice_number,
            receiver_name: params.receiver_name,
            receiver_phone: params.receiver_phone,
            receiver_zip_code: params.receiver_zip_code,
            receiver_address: params.receiver_address,
            product_query: params.product_query,
            order_date_start: params.order_date_start,
            order_date_end: params.order_date_end,
            order_placed_date_start: params.order_placed_date_start,
            order_placed_date_end: params.order_placed_date_end,
            shipping_date_start: params.shipping_date_start,
            shipping_date_end: params.shipping_date_end,
          }}
        />
      </section>

      <section className="p-6 bg-white rounded-lg shadow-lg mt-8 dark:bg-gray-900">
        <ShipmentsListWithExport
          items={shipments.items ?? []}
          search={{
            order_status: params.order_status,
            channel_id: params.channel_id,
            invoice_number: params.invoice_number,
            receiver_name: params.receiver_name,
            receiver_phone: params.receiver_phone,
            receiver_zip_code: params.receiver_zip_code,
            receiver_address: params.receiver_address,
            product_query: params.product_query,
            order_date_start: params.order_date_start,
            order_date_end: params.order_date_end,
            order_placed_date_start: params.order_placed_date_start,
            order_placed_date_end: params.order_placed_date_end,
            shipping_date_start: params.shipping_date_start,
            shipping_date_end: params.shipping_date_end,
          }}
        />

        <PagePagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={size}
          totalItems={shipments.total || 0}
          basePath="/shipments"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}

