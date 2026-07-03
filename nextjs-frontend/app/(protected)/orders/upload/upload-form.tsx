"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  fetchChannelsForExcelSelect,
  previewOrdersExcel,
  uploadOrdersExcel,
  type ChannelOption,
} from "@/components/actions/orders-excel-action";
import {
  mappingToFormExcelFields,
  pickOrderRawField,
} from "@/lib/order-excel-mapping";
import { SubmitButton } from "@/components/ui/submitButton";
import { DataTable } from "@/components/ui/data-table";
import type { ExcelOrderPreviewResponse } from "@/app/openapi-client/types.gen";
import { PlusIcon } from "lucide-react";

type PreviewState = {
  message?: string;
  preview?: ExcelOrderPreviewResponse;
};

const previewInitialState: PreviewState = {};

type UploadState = {
  message?: string;
};

const uploadInitialState: UploadState = {};

const EMPTY = "__empty__";
const EMPTY_CHANNEL = "__empty_channel__";

function cell(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function OrderExcelUpload() {
  const [previewState, previewDispatch] = useActionState<PreviewState, FormData>(
    previewOrdersExcel,
    previewInitialState,
  );
  const [uploadState, uploadDispatch] = useActionState<UploadState, FormData>(
    uploadOrdersExcel,
    uploadInitialState,
  );

  const preview = previewState.preview;

  const [channelId, setChannelId] = useState<string>(EMPTY_CHANNEL);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [hasExcelFile, setHasExcelFile] = useState(false);

  const selectedChannelWarnings = useMemo(() => {
    if (channelId === EMPTY_CHANNEL) return [];
    return (
      channels.find((c) => c.id === channelId)?.order_excel_mapping_warnings ?? []
    );
  }, [channelId, channels]);

  const excelByCanonical = useMemo(() => {
    if (channelId === EMPTY_CHANNEL) return {} as Record<string, string>;
    const ch = channels.find((c) => c.id === channelId);
    if (!ch?.order_excel_mapping) return {} as Record<string, string>;
    return mappingToFormExcelFields(ch.order_excel_mapping).excelByCanonical;
  }, [channelId, channels]);

  useEffect(() => {
    let cancelled = false;
    fetchChannelsForExcelSelect().then((list) => {
      if (!cancelled && Array.isArray(list)) setChannels(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  type RowItem = { id: string; product_id: string; quantity: number };
  const [itemsByRow, setItemsByRow] = useState<Record<string, RowItem[]>>({});
  const [commissionByRow, setCommissionByRow] = useState<Record<string, number>>({});

  const products = preview?.active_products ?? [];

  const rowsWithSelection = useMemo(() => {
    if (!preview) return [];
    return preview.rows.map((r) => {
      const key = String(r.row_index);
      const backendItems = (r as any).matched_items as
        | { product_id: string; quantity: number }[]
        | undefined;

      let items = itemsByRow[key];
      if (!items) {
        const rawQty = pickOrderRawField(
          r.raw as Record<string, unknown>,
          "수량",
          excelByCanonical,
        ) as unknown;
        const excelQty = (() => {
          if (rawQty == null) return undefined;
          const s = String(rawQty).replace(/,/g, "").trim();
          const n = Number(s);
          return Number.isFinite(n) && n > 0 ? n : undefined;
        })();
        const aliasQty = (r as any).alias_quantity as number | undefined;
        const baseQty = aliasQty ?? excelQty ?? 1;

        if (backendItems && backendItems.length > 0) {
          items = backendItems.map((it, idx) => ({
            id: `${key}-${idx}`,
            product_id: it.product_id,
            quantity: it.quantity,
          }));
        } else if (r.matched_product_id) {
          items = [
            {
              id: `${key}-0`,
              product_id: r.matched_product_id,
              quantity: baseQty,
            },
          ];
        } else {
          items = [];
        }
      }

      return {
        ...r,
        _key: key,
        _items: items,
        _commission:
          typeof commissionByRow[key] === "number"
            ? commissionByRow[key]
            : typeof r.commission === "number"
              ? r.commission
              : 0,
      };
    });
  }, [preview, itemsByRow, excelByCanonical, commissionByRow]);

  const payloadJson = useMemo(() => {
    if (!preview) return "";
    const rows = rowsWithSelection
      .map((r) => {
        const items =
          r._items
            ?.filter((it) => it.product_id && it.product_id !== EMPTY && it.quantity > 0)
            .map((it) => ({
              product_id: it.product_id,
              quantity: it.quantity,
            })) ?? [];
        if (!items.length) return null;
        return {
          channel: r.channel,
          raw: r.raw,
          items,
          commission: r._commission,
        };
      })
      .filter(
        (
          v,
        ): v is {
          channel: string;
          raw: Record<string, unknown>;
          items: { product_id: string; quantity: number }[];
          commission: number;
        } => v !== null,
      );
    return JSON.stringify({ rows });
  }, [preview, rowsWithSelection]);

  type RowWithSelection = (typeof rowsWithSelection)[number];

  const columns = useMemo<ColumnDef<RowWithSelection, unknown>[]>(() => {
    return [
      { accessorKey: "row_index", header: "Row" },
      { accessorKey: "channel", header: "채널(선택)" },
      { accessorKey: "product_name", header: "상품명(엑셀)" },
      {
        id: "excel_quantity",
        header: "엑셀 수량",
        cell: ({ row }) =>
          cell(
            pickOrderRawField(
              row.original.raw as Record<string, unknown>,
              "수량",
              excelByCanonical,
            ),
          ),
      },
      {
        id: "total_price",
        header: "총 주문금액",
        cell: ({ row }) =>
          cell(
            pickOrderRawField(
              row.original.raw as Record<string, unknown>,
              "총 주문금액",
              excelByCanonical,
            ),
          ),
      },
      {
        id: "receiver_name",
        header: "수취인명",
        cell: ({ row }) =>
          cell(
            pickOrderRawField(
              row.original.raw as Record<string, unknown>,
              "수취인명",
              excelByCanonical,
            ),
          ),
      },
      {
        id: "receiver_phone",
        header: "연락처",
        cell: ({ row }) =>
          cell(
            pickOrderRawField(
              row.original.raw as Record<string, unknown>,
              "수취인연락처",
              excelByCanonical,
            ),
          ),
      },
      {
        id: "zip_code",
        header: "우편번호",
        cell: ({ row }) =>
          cell(
            pickOrderRawField(
              row.original.raw as Record<string, unknown>,
              "우편번호",
              excelByCanonical,
            ),
          ),
      },
      {
        id: "integrated_address",
        header: "통합배송지",
        cell: ({ row }) =>
          cell(
            pickOrderRawField(
              row.original.raw as Record<string, unknown>,
              "통합배송지",
              excelByCanonical,
            ),
          ),
      },
      {
        id: "shipping_message",
        header: "배송메세지",
        cell: ({ row }) =>
          cell(
            pickOrderRawField(
              row.original.raw as Record<string, unknown>,
              "배송메세지",
              excelByCanonical,
            ),
          ),
      },
      {
        id: "commission",
        header: "수수료",
        cell: ({ row }) => {
          const r = row.original as RowWithSelection;
          return (
            <input
              type="number"
              min={0}
              className="w-24 rounded border px-1 py-0.5 text-right text-sm"
              value={Number.isFinite(r._commission) ? r._commission : 0}
              onChange={(e) => {
                const v = e.target.value;
                const num = v === "" ? 0 : Number(v);
                setCommissionByRow((prev) => ({
                  ...prev,
                  [r._key]: Number.isFinite(num) ? Math.max(0, Math.trunc(num)) : 0,
                }));
              }}
            />
          );
        },
      },
      {
        id: "matched_items",
        header: "매칭 상품/수량",
        cell: ({ row }) => {
          const r = row.original as RowWithSelection;
          const items = r._items ?? [];
          return (
            <div className="space-y-1 min-w-[280px]">
              
              {r.matched_product_label && (
                <p className="mt-1 text-xs text-gray-500">
                  매칭: {r.matched_product_label}
                </p>
              )}
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Select
                    value={item.product_id || EMPTY}
                    onValueChange={(v) =>
                      setItemsByRow((prev) => {
                        const list = prev[r._key] ?? r._items ?? [];
                        return {
                          ...prev,
                          [r._key]: list.map((it) =>
                            it.id === item.id ? { ...it, product_id: v } : it,
                          ),
                        };
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="상품 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={EMPTY}>선택 안 함</SelectItem>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.product_code ? `[${p.product_code}] ` : ""}
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <input
                    type="number"
                    min={1}
                    className="w-20 rounded border px-1 py-0.5 text-right text-sm"
                    value={item.quantity}
                    onChange={(e) => {
                      const v = e.target.value;
                      const num = v === "" ? 0 : Number(v);
                      setItemsByRow((prev) => {
                        const list = prev[r._key] ?? r._items ?? [];
                        return {
                          ...prev,
                          [r._key]: list.map((it) =>
                            it.id === item.id ? { ...it, quantity: num } : it,
                          ),
                        };
                      });
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs text-red-600 hover:text-red-800"
                    disabled={(r._items?.length ?? 0) <= 1}
                    onClick={() =>
                      setItemsByRow((prev) => {
                        const list = prev[r._key] ?? r._items ?? [];
                        return {
                          ...prev,
                          [r._key]: list.filter((it) => it.id !== item.id),
                        };
                      })
                    }
                  >
                    삭제
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-6 px-2 text-xs"
                onClick={() =>
                  setItemsByRow((prev) => {
                    const list = prev[r._key] ?? r._items ?? [];
                    return {
                      ...prev,
                      [r._key]: [
                        ...list,
                        {
                          id: `${r._key}-${list.length}`,
                          product_id: EMPTY,
                          quantity: 1,
                        },
                      ],
                    };
                  })
                }
              >
                <PlusIcon className="w-4 h-4" />
              </Button>
            </div>
          );
        },
      },
      {
        id: "errors",
        header: "오류",
        cell: ({ row }) => (
          <div className="text-red-500 text-xs">
            {row.original.errors?.length ? row.original.errors.join(", ") : ""}
          </div>
        ),
      },
    ];
  }, [products, excelByCanonical]);

  return (
    <div className="space-y-8">
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
          1) 엑셀 업로드
        </h2>
        <form action={previewDispatch} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel_id" className="text-gray-700 dark:text-gray-300">
              채널<span className="relative -top-1 text-sm text-red-500">*</span>
            </Label>
            <Select
              value={channelId}
              onValueChange={setChannelId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="채널 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={EMPTY_CHANNEL}>채널 선택</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {selectedChannelWarnings.length > 0 && (
            <div
              role="alert"
              className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <p className="font-medium">선택한 채널 — 주문 엑셀 매핑 안내</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {selectedChannelWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {channelId !== EMPTY_CHANNEL && (
            <input type="hidden" name="channel_id" value={channelId} />
          )}

          <div className="space-y-2">
            <Label htmlFor="file" className="text-gray-700 dark:text-gray-300">
              엑셀 파일<span className="relative -top-1 text-sm text-red-500">*</span>
            </Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm text-gray-700 dark:text-gray-300"
              required
              onChange={(e) => setHasExcelFile(Boolean(e.currentTarget.files?.length))}
              onInput={(e) => console.log(e.currentTarget.files)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="excel_password" className="text-gray-700 dark:text-gray-300">
              엑셀 암호 (선택)
            </Label>
            <Input
              id="excel_password"
              name="password"
              type="password"
              autoComplete="off"
              placeholder="암호가 걸린 엑셀인 경우 입력"
            />
          </div>
          {previewState.message && (
            <p className="text-sm text-red-500">엑셀 파일 및 암호를 확인해주세요</p>
          )}
          <div className="flex gap-3">
            <SubmitButton
              text="프리뷰 생성"
              disabled={!hasExcelFile || channelId === EMPTY_CHANNEL}
            />
          </div>
        </form>
      </section>

      {preview && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
            2) 엑셀 프리뷰 & 상품 매칭
          </h2>

          <div className="mb-3 text-sm text-muted-foreground">
            총 {rowsWithSelection.length.toLocaleString("ko-KR")}건
          </div>

          {preview.warnings && preview.warnings.length > 0 && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <p className="font-medium">프리뷰 안내</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-auto">
            <div className="min-w-[1200px]">
              <DataTable columns={columns} data={rowsWithSelection} />
            </div>
          </div>

          <div className="mt-4">
            <form action={uploadDispatch} className="flex items-center gap-3">
              <input type="hidden" name="payload" value={payloadJson} />
              <Button
                type="submit"
                className="w-full"
                disabled={!payloadJson || rowsWithSelection.length === 0}
              >
                서버에 저장
              </Button>
              {uploadState.message && (
                <p className="text-sm text-red-500">{uploadState.message}</p>
              )}
              {!payloadJson && (
                <p className="text-sm text-gray-500">
                  업로드하려면 각 행에 내부 상품을 매칭해주세요.
                </p>
              )}
            </form>
          </div>
        </section>
      )}
    </div>
  );
}

