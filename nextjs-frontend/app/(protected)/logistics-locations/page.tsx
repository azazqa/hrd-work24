import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableHeader,
} from "@/components/ui/table";
import { fetchLogisticsLocations } from "@/components/actions/logistics-locations-action";
import { LogisticsLocationDeleteButton } from "./deleteButton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageSizeSelector } from "@/components/page-size-selector";
import { PagePagination } from "@/components/page-pagination";
import type { PageLogisticsLocationRead } from "@/app/openapi-client";
import {
  LogisticsLocationSearchForm,
  type LogisticsLocationSearchInitial,
} from "./logistics-location-search-form";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STATE_LABEL: Record<string, string> = {
  active: "사용",
  inactive: "미사용",
};

interface LogisticsLocationsPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    name?: string;
    description?: string;
  }>;
}

export default async function LogisticsLocationsPage({
  searchParams,
}: LogisticsLocationsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;

  const search: LogisticsLocationSearchInitial = {
    name: params.name,
    description: params.description,
  };

  const extraQuery = (() => {
    const parts: string[] = [];
    const add = (k: string, v: string | undefined) => {
      const t = v?.trim();
      if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
    };
    add("name", params.name);
    add("description", params.description);
    return parts.join("&");
  })();

  const result = await fetchLogisticsLocations(page, size, search);
  if ("message" in result) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">물류지 관리</h2>
        <p className="text-red-500">{result.message}</p>
      </div>
    );
  }

  const locations = result as PageLogisticsLocationRead;
  const totalPages = Math.ceil((locations.total || 0) / size);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        물류지 관리
        <Tooltip>
          <TooltipTrigger className="inline-block ml-2">
            <CircleHelp className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>물류지(창고/배송지) 정보를 등록하고 관리할 수 있습니다.</p>
          </TooltipContent>
        </Tooltip>
      </h2>

      <section className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-900">
        <LogisticsLocationSearchForm
          size={size}
          initial={{ name: params.name, description: params.description }}
        />
      </section>

      <section className="p-6 bg-white rounded-lg shadow-lg mt-8 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">물류지 목록</h2>
          <Link href="/logistics-locations/add">
            <Button className="text-lg px-4 py-2">
              물류지 등록
            </Button>
          </Link>
        </div>
        <Table className="min-w-full text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">물류지명</TableHead>
              <TableHead className="w-[200px]">설명</TableHead>
              <TableHead className="w-[80px] text-center">상태</TableHead>
              <TableHead className="w-[100px] text-center">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!locations.items?.length ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  등록된 물류지가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              locations.items.map((loc) => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium">{loc.name}</TableCell>
                  <TableCell className="text-gray-600">
                    {loc.description || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {STATE_LABEL[loc.state ?? "active"] ?? loc.state}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                      <LogisticsLocationDeleteButton locationId={loc.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <PagePagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={size}
          totalItems={locations.total || 0}
          basePath="/logistics-locations"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}
