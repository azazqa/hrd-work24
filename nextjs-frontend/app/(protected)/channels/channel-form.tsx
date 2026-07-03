"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addChannel, updateChannelAction } from "@/components/actions/channels-action";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submitButton";
import Link from "next/link";
import { OrderExcelMappingDialog } from "./order-excel-mapping-dialog";
import { cn } from "@/lib/utils";
import type { ChannelRead } from "@/app/openapi-client";
import {
  ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG,
  createEmptyExcelFieldMap,
  formExcelFieldsToMapping,
  mappingToFormExcelFields,
} from "@/lib/order-excel-mapping";

type CourierOption = { id: string; name: string };

export type ChannelFormProps = {
  couriers: CourierOption[];
  mode?: "create" | "edit";
  /** edit 시 필수 */
  channelId?: string;
  /** edit 시 채널 조회 결과 */
  initial?: Pick<
    ChannelRead,
    | "name"
    | "description"
    | "url"
    | "courier_id"
    | "order_excel_mapping"
    | "order_excel_mapping_warnings"
  >;
};

const initialState = { message: "" };

export function ChannelForm({
  couriers,
  mode = "create",
  channelId,
  initial,
}: ChannelFormProps) {
  const isEdit = mode === "edit";
  const action = isEdit ? updateChannelAction : addChannel;

  const [state, dispatch] = useActionState(action, initialState);
  const [courierId, setCourierId] = useState<string>(
    initial?.courier_id ?? "",
  );

  const mappedInitial = useMemo(
    () => mappingToFormExcelFields(initial?.order_excel_mapping ?? null),
    [initial?.order_excel_mapping],
  );

  const [excelHeaderRow, setExcelHeaderRow] = useState(mappedInitial.headerRow);
  const [excelByLabel, setExcelByLabel] = useState<Record<string, string>>(
    () => ({ ...mappedInitial.excelByCanonical }),
  );
  const [excelSourceHeaders, setExcelSourceHeaders] = useState<string[] | null>(
    () => {
      const sh = (
        initial?.order_excel_mapping as { source_headers?: string[] } | undefined
      )?.source_headers;
      return Array.isArray(sh) ? [...sh] : null;
    },
  );
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [excelMappingClientError, setExcelMappingClientError] = useState<
    string | null
  >(null);

  useEffect(() => {
    const r = formExcelFieldsToMapping(
      excelHeaderRow,
      excelByLabel,
      excelSourceHeaders !== null
        ? { sourceHeaders: excelSourceHeaders }
        : undefined,
    );
    setExcelMappingClientError(r.ok ? null : r.error);
  }, [excelHeaderRow, excelByLabel, excelSourceHeaders]);

  const orderExcelMappingHidden = useMemo(() => {
    const r = formExcelFieldsToMapping(
      excelHeaderRow,
      excelByLabel,
      excelSourceHeaders !== null
        ? { sourceHeaders: excelSourceHeaders }
        : undefined,
    );
    if (!r.ok || r.data === null) return "";
    return JSON.stringify(r.data);
  }, [excelHeaderRow, excelByLabel, excelSourceHeaders]);

  useEffect(() => {
    const sh = (
      initial?.order_excel_mapping as { source_headers?: string[] } | undefined
    )?.source_headers;
    setExcelSourceHeaders(Array.isArray(sh) ? [...sh] : null);
  }, [initial?.order_excel_mapping]);

  return (
    <form
      action={dispatch}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6"
    >
      {isEdit && channelId ? (
        <input type="hidden" name="channel_id" value={channelId} />
      ) : null}

      <div className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">
            채널명<span className="relative -top-1 text-sm text-red-500">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="예: 쿠팡, 네이버 스마트스토어"
            required
            defaultValue={initial?.name ?? ""}
            className="w-full border-gray-300 dark:border-gray-600"
          />
          {state.errors?.name && (
            <p className="text-red-500 text-sm">{state.errors.name}</p>
          )}
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="description"
            className="text-gray-700 dark:text-gray-300"
          >
            설명
          </Label>
          <Input
            id="description"
            name="description"
            type="text"
            placeholder="채널에 대한 설명 (선택)"
            defaultValue={initial?.description ?? ""}
            className="w-full border-gray-300 dark:border-gray-600"
          />
          {state.errors?.description && (
            <p className="text-red-500 text-sm">
              {state.errors.description}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="url" className="text-gray-700 dark:text-gray-300">
            채널 URL
          </Label>
          <Input
            id="url"
            name="url"
            type="text"
            inputMode="url"
            placeholder="https://… (선택)"
            defaultValue={initial?.url ?? ""}
            className="w-full border-gray-300 dark:border-gray-600"
          />
          {state.errors?.url && (
            <p className="text-red-500 text-sm">{state.errors.url}</p>
          )}
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="courier_id"
            className="text-gray-700 dark:text-gray-300"
          >
            택배사
          </Label>
          <Select
            value={courierId || "none"}
            onValueChange={(v) => setCourierId(v === "none" ? "" : v)}
          >
            <SelectTrigger className="w-full border-gray-300 dark:border-gray-600">
              <SelectValue placeholder="택배사 선택 (선택)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">선택 안 함</SelectItem>
              {couriers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="courier_id" value={courierId} />
        </div>

        <div className="space-y-3">
          <Label className="text-gray-700 dark:text-gray-300">
            주문 엑셀 양식 (선택)
          </Label>

          {isEdit &&
            initial?.order_excel_mapping_warnings &&
            initial.order_excel_mapping_warnings.length > 0 && (
              <div
                role="alert"
                className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              >
                <p className="font-medium">저장된 매핑과 현재 표준 필드 안내</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {initial.order_excel_mapping_warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  아래에서 「엑셀에서 불러오기」로 다시 매핑하면 저장 시 최신 표준으로 맞출 수 있습니다.
                </p>
              </div>
            )}

          <input type="hidden" name="order_excel_mapping" value={orderExcelMappingHidden} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2 sm:max-w-[200px]">
              <span className="text-gray-700 dark:text-gray-300 text-sm font-medium leading-none">
                헤더 행 (1부터)
              </span>
              <div
                className={cn(
                  "flex min-h-9 w-full items-center rounded-md border border-gray-300 bg-muted/30 px-3 py-2 text-sm dark:border-gray-600",
                )}
              >
                <span className="tabular-nums">{excelHeaderRow}</span>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              onClick={() => setMappingDialogOpen(true)}
            >
              엑셀에서 불러오기
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG.map((canon) => {
              const v = (excelByLabel[canon] ?? "").trim();
              return (
                <div key={canon} className="space-y-1.5">
                  <span className="text-gray-700 dark:text-gray-300 text-sm font-medium leading-none">
                    {canon}
                  </span>
                  <div
                    className={cn(
                      "flex min-h-9 w-full items-center rounded-md border border-gray-300 bg-muted/30 px-3 py-2 text-sm dark:border-gray-600",
                      !v && "text-muted-foreground",
                    )}
                  >
                    <span className="min-w-0 break-all">{v || "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {excelMappingClientError && (
            <p className="text-destructive text-sm">{excelMappingClientError}</p>
          )}
          {state.errors?.order_excel_mapping && (
            <p className="text-red-500 text-sm">
              {state.errors.order_excel_mapping.join(" ")}
            </p>
          )}
        </div>
      </div>

      <OrderExcelMappingDialog
        open={mappingDialogOpen}
        onOpenChange={setMappingDialogOpen}
        headerRow={excelHeaderRow}
        excelByCanonical={excelByLabel}
        onApply={({ headerRow: hr, excelByCanonical, sourceHeaders }) => {
          setExcelHeaderRow(hr);
          setExcelByLabel({ ...createEmptyExcelFieldMap(), ...excelByCanonical });
          if (sourceHeaders !== undefined) {
            setExcelSourceHeaders(sourceHeaders);
          }
        }}
      />

      <div className="flex gap-3">
        <SubmitButton text={isEdit ? "저장" : "등록"} disabled={Boolean(excelMappingClientError)} />
        <Link href="/channels" className="w-full">
          <Button variant="outline" type="button" className="w-full">
            취소
          </Button>
        </Link>
      </div>

      {state?.message && (
        <div className="mt-2 text-center text-sm text-red-500">
          <p>{state.message}</p>
        </div>
      )}
    </form>
  );
}
