import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableHeader,
} from "@/components/ui/table";
import { fetchReceivers } from "@/components/actions/receivers-action";
import { ReceiverDeleteButton } from "./deleteButton";
import { PageReceiverRead } from "@/app/openapi-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageSizeSelector } from "@/components/page-size-selector";
import { PagePagination } from "@/components/page-pagination";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { canServer } from "@/lib/server-permissions";

interface ReceiversPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
  }>;
}

export default async function ReceiversPage({
  searchParams,
}: ReceiversPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;

  const receivers = (await fetchReceivers(page, size)) as PageReceiverRead;
  const totalPages = Math.ceil((receivers.total || 0) / size);
  const canCreate = await canServer("receivers", "create");
  const canDelete = await canServer("receivers", "delete");

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        수취인 관리
        <Tooltip>
          <TooltipTrigger className="inline-block ml-2">
            <CircleHelp className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>주문 수취인 정보를 등록하고 관리할 수 있습니다.</p>
          </TooltipContent>
        </Tooltip>
      </h2>

      <div className="mb-6">
        {canCreate && (
          <Link href="/receivers/add">
            <Button variant="outline" className="text-lg px-4 py-2">
              수취인 등록
            </Button>
          </Link>
        )}
      </div>

      <section className="p-6 bg-white rounded-lg shadow-lg mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">수취인 목록</h2>
          
        </div>

        <Table className="min-w-full text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">수취인명</TableHead>
              <TableHead className="w-[120px]">연락처</TableHead>
              <TableHead>우편번호</TableHead>
              <TableHead>주소</TableHead>
              {canDelete && <TableHead className="text-center w-[100px]">관리</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!receivers.items?.length ? (
              <TableRow>
                <TableCell colSpan={canDelete ? 5 : 4} className="text-center">
                  등록된 수취인이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              receivers.items.map((receiver) => (
                <TableRow key={receiver.id}>
                  <TableCell className="font-medium">{receiver.name}</TableCell>
                  <TableCell>{receiver.phone}</TableCell>
                  <TableCell>{receiver.zip_code}</TableCell>
                  <TableCell className="text-gray-600">
                    {receiver.address}
                    {receiver.address_detail ? ` ${receiver.address_detail}` : ""}
                  </TableCell>
                  {canDelete && (
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <ReceiverDeleteButton receiverId={receiver.id} />
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
          totalItems={receivers.total || 0}
          basePath="/receivers"
        />
      </section>
    </div>
  );
}
