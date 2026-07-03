import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableHeader,
} from "@/components/ui/table";
import { fetchCouriers } from "@/components/actions/couriers-action";
import { CourierDeleteButton } from "./deleteButton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageSizeSelector } from "@/components/page-size-selector";
import { PagePagination } from "@/components/page-pagination";
import type { PageCourierRead } from "@/app/openapi-client";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { canServer } from "@/lib/server-permissions";

interface CouriersPageProps {
  searchParams: Promise<{ page?: string; size?: string }>;
}

export default async function CouriersPage({ searchParams }: CouriersPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;

  const result = await fetchCouriers(page, size);
  if ("message" in result) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">택배사 관리</h2>
        <p className="text-red-500">{result.message}</p>
      </div>
    );
  }

  const couriers = result as PageCourierRead;
  const totalPages = Math.ceil((couriers.total || 0) / size);
  const canCreate = await canServer("couriers", "create");
  const canDelete = await canServer("couriers", "delete");

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        택배사 관리
        <Tooltip>
          <TooltipTrigger className="inline-block ml-2">
            <CircleHelp className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>택배사 정보를 등록하고 관리할 수 있습니다.</p>
          </TooltipContent>
        </Tooltip>
      </h2>

      <section className="p-6 bg-white rounded-lg shadow-lg mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">택배사 목록</h2>
          {canCreate && (
            <Link href="/couriers/add">
              <Button className="text-lg px-4 py-2">택배사 등록</Button>
            </Link>
          )}
        </div>

        <Table className="min-w-full text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">택배사명</TableHead>
              <TableHead>배송조회 URL</TableHead>
              {canDelete && <TableHead className="text-center w-[100px]">관리</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!couriers.items?.length ? (
              <TableRow>
                <TableCell colSpan={canDelete ? 3 : 2} className="text-center">
                  등록된 택배사가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              couriers.items.map((courier) => (
                <TableRow key={courier.id}>
                  <TableCell className="font-medium">{courier.name}</TableCell>
                  <TableCell className="text-gray-600 break-all">
                    {courier.url || "-"}
                  </TableCell>
                  {canDelete && (
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <CourierDeleteButton courierId={courier.id} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <PagePagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={size}
          totalItems={couriers.total || 0}
          basePath="/couriers"
        />
      </section>
    </div>
  );
}
