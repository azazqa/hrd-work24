import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageSizeSelector } from "@/components/page-size-selector";
import { PagePagination } from "@/components/page-pagination";
import {
  fetchProductAliasDicts,
  type ProductAliasDictListSearch,
} from "@/components/actions/product-alias-dicts-action";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ProductAliasProductDetailDialog } from "./product-alias-product-detail-dialog";
import { ProductAliasDeleteButton, ProductAliasGroupDeleteButton } from "./deleteButton";
import { ProductAliasSearchForm } from "./product-alias-search-form";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProductAliasEditDialog } from "./product-alias-edit-dialog";
import { fetchChannelsForExcelSelect } from "@/components/actions/orders-excel-action";

interface ProductAliasDictsPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    product_name?: string;
    alias?: string;
    channel_id?: string;
    channel_ids?: string;
  }>;
}

function buildAliasSearchQuery(
  p: Awaited<ProductAliasDictsPageProps["searchParams"]>,
): string {
  const parts: string[] = [];
  const add = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
  };
  add("product_name", p.product_name);
  add("alias", p.alias);
  add("channel_id", p.channel_id);
  add("channel_ids", p.channel_ids);
  return parts.join("&");
}

function searchFromParams(
  p: Awaited<ProductAliasDictsPageProps["searchParams"]>,
): ProductAliasDictListSearch {
  return {
    product_name: p.product_name,
    alias: p.alias,
    channel_ids: p.channel_ids
      ? p.channel_ids
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
    channel_id: p.channel_id,
  };
}

export default async function ProductAliasDictsPage({
  searchParams,
}: ProductAliasDictsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;
  const extraQuery = buildAliasSearchQuery(params);

  const [result, channels] = await Promise.all([
    fetchProductAliasDicts(page, size, searchFromParams(params)),
    fetchChannelsForExcelSelect(),
  ]);
  if ("message" in result) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-4">상품 별칭 관리</h2>
        <p className="text-red-500">{result.message}</p>
      </div>
    );
  }

  const aliases = result;
  const totalPages = Math.ceil((aliases.total || 0) / size);
  const aliasOptions = Array.from(
    new Set((aliases.items ?? []).map((it) => (it.alias ?? "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "ko-KR"));
  const productNameOptions = Array.from(
    new Set(
      (aliases.items ?? [])
        .map((it) => (it.product_name ?? "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "ko-KR"));
  const grouped = Array.from(
    aliases.items.reduce(
      (m, it) => {
        const key = (it.alias ?? "").trim();
        const chKey = (it.channel_id ?? "").trim() || "__global__";
        const groupKey = `${chKey}::${key}`;
        if (!m.has(groupKey)) m.set(groupKey, []);
        m.get(groupKey)!.push(it);
        return m;
      },
      new Map<string, typeof aliases.items>(),
    ),
  ).map(([_groupKey, items]) => {
    const alias = (items[0]?.alias ?? "").trim();
    const channelName = items[0]?.channel_name ?? null;
    const totalQty = items.reduce((s, x) => s + (x.quantity ?? 1), 0);
    return { alias, channelName, items, totalQty };
  });

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        상품 별칭 관리
        <Tooltip>
          <TooltipTrigger className="inline-block ml-2">
            <CircleHelp className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>상품 별칭 목록을 조회할 수 있습니다.</p>
          </TooltipContent>
        </Tooltip>
      </h2>

      <section className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-900">
        <ProductAliasSearchForm
          size={size}
          channels={(channels ?? []).map((c) => ({ id: c.id, name: c.name }))}
          aliasOptions={aliasOptions}
          productNameOptions={productNameOptions}
          initial={{
            product_name: params.product_name,
            alias: params.alias,
            channel_ids: params.channel_ids,
          }}
        />
      </section>

      <section className="p-6 bg-white rounded-lg shadow-lg mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">상품 별칭 목록</h2>
          <Link href="/product-alias-dicts/add">
            <Button className="text-lg px-4 py-2">
              상품 별칭 등록
            </Button>
          </Link>
        </div>

        <Table className="min-w-full text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px] text-center">채널</TableHead>
              <TableHead className="min-w-48 max-w-[20rem]">별칭</TableHead>
              <TableHead className="w-[120px] text-center">별칭 가격</TableHead>
              <TableHead className="w-[120px] text-center">수수료</TableHead>
              <TableHead className="min-w-48">상품명</TableHead>
              <TableHead className="w-[90px] text-center">수량</TableHead>
              <TableHead className="w-[90px] text-center">총 수량</TableHead>
              <TableHead className="w-[80px] text-center">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!grouped.length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  등록된 상품 별칭이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              grouped.flatMap((g) => {
                const rows = g.items.length;
                return g.items.map((item, idx) => (
                  <TableRow key={item.id}>
                    {idx === 0 && (
                      <TableCell className="text-center align-middle" rowSpan={rows}>
                        {g.channelName ?? "공용"}
                      </TableCell>
                    )}
                    {idx === 0 && (
                      <TableCell className="font-medium align-middle" rowSpan={rows}>
                        {g.alias}
                      </TableCell>
                    )}
                    {idx === 0 && (
                      <TableCell className="text-center align-middle" rowSpan={rows}>
                        {Number(g.items[0]?.price ?? 0) || 0}
                      </TableCell>
                    )}
                    {idx === 0 && (
                      <TableCell className="text-center align-middle" rowSpan={rows}>
                        {Number(g.items[0]?.commission ?? 0) || 0}
                      </TableCell>
                    )}
                    <TableCell>
                      <ProductAliasProductDetailDialog
                        productId={item.product_id}
                        label={
                          item.product_name?.trim() ? item.product_name : "(이름 없음)"
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center">{item.quantity ?? 1}</TableCell>
                    {idx === 0 && (
                      <TableCell className="text-center align-middle" rowSpan={rows}>
                        {g.totalQty}
                      </TableCell>
                    )}
                    {idx === 0 ? (
                      <TableCell className="text-center align-middle" rowSpan={rows}>
                        <div className="flex items-center justify-center gap-1">
                          <ProductAliasEditDialog
                            representativeAliasItemId={g.items[0]!.id}
                            channelId={g.items[0]?.channel_id ?? null}
                            alias={g.alias}
                            price={Number(g.items[0]?.price ?? 0) || 0}
                            commission={Number(g.items[0]?.commission ?? 0) || 0}
                            items={g.items}
                            channels={channels ?? []}
                          />
                          <ProductAliasGroupDeleteButton alias={g.alias} />
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ));
              })
            )}
          </TableBody>
        </Table>

        <PagePagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={size}
          totalItems={aliases.total || 0}
          basePath="/product-alias-dicts"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}

