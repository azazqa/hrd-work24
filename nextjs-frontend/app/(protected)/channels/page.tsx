import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableHeader,
} from "@/components/ui/table";
import {
  fetchChannels,
  type ChannelListSearch,
} from "@/components/actions/channels-action";
import { PageChannelRead } from "@/app/openapi-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageSizeSelector } from "@/components/page-size-selector";
import { PagePagination } from "@/components/page-pagination";
import { ChannelSearchForm } from "./channel-search-form";
import { channelExternalHref } from "@/lib/channel-external-href";
import { CircleHelp, ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { canServer } from "@/lib/server-permissions";

interface ChannelsPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    name?: string;
    description?: string;
    courier_name?: string;
  }>;
}

function buildChannelSearchQuery(
  p: Awaited<ChannelsPageProps["searchParams"]>,
): string {
  const parts: string[] = [];
  const add = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
  };
  add("name", p.name);
  add("description", p.description);
  add("courier_name", p.courier_name);
  return parts.join("&");
}

function searchFromParams(
  p: Awaited<ChannelsPageProps["searchParams"]>,
): ChannelListSearch {
  return {
    name: p.name,
    description: p.description,
    courier_name: p.courier_name,
  };
}

export default async function ChannelsPage({ searchParams }: ChannelsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;

  const extraQuery = buildChannelSearchQuery(params);

  const channels = (await fetchChannels(page, size, searchFromParams(params))) as
    | PageChannelRead
    | { message: string };
  const totalPages =
    "message" in channels ? 0 : Math.ceil((channels.total || 0) / size);
  const canCreate = await canServer("channels", "create");
  const canUpdate = await canServer("channels", "update");
  const canManage = canUpdate;

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        채널 관리
        <Tooltip>
          <TooltipTrigger className="inline-block ml-2">
            <CircleHelp className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>판매 채널을 등록하고 관리할 수 있습니다.</p>
          </TooltipContent>
        </Tooltip>
      </h2>

      <section className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-900">
        <ChannelSearchForm
          size={size}
          initial={{
            name: params.name,
            description: params.description,
            courier_name: params.courier_name,
          }}
        />
      </section>

      <section className="p-6 bg-white rounded-lg shadow-lg mt-8 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">채널 목록</h2>
          {canCreate && (
            <Link href="/channels/add">
              <Button className="text-lg px-4 py-2">채널 등록</Button>
            </Link>
          )}
        </div>

        {"message" in channels ? (
          <p className="text-sm text-destructive">{channels.message}</p>
        ) : (
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">채널명</TableHead>
                <TableHead>설명</TableHead>
                <TableHead className="min-w-[200px] max-w-[320px]">URL</TableHead>
                <TableHead className="w-[160px]">택배사명</TableHead>
                {canManage && (
                  <TableHead className="text-center w-[160px]">관리</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!channels.items?.length ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 5 : 4} className="text-center">
                    등록된 채널이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                channels.items.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell className="font-medium">{channel.name}</TableCell>
                    <TableCell className="text-gray-600">
                      {channel.description || "-"}
                    </TableCell>
                    <TableCell className="text-gray-700 align-middle">
                      {(() => {
                        const href = channelExternalHref(channel.url);
                        if (!href) return <span className="text-muted-foreground">-</span>;
                        return (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1 text-primary hover:underline break-all"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                            <span className="min-w-0">{channel.url?.trim()}</span>
                          </a>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {channel.courier_name?.trim()
                        ? channel.courier_name
                        : "-"}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-center">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {canUpdate && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/channels/${channel.id}/edit`}>수정</Link>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        <PagePagination
          currentPage={page}
          totalPages={Math.max(1, totalPages)}
          pageSize={size}
          totalItems={"message" in channels ? 0 : channels.total || 0}
          basePath="/channels"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}
