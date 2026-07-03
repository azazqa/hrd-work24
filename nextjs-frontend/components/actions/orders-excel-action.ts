"use server";

import { requireAccessToken } from "@/components/actions/auth-token";
import { redirect } from "next/navigation";
import { listChannels, previewExcelOrders, uploadExcelOrders } from "@/app/clientService";
import type {
  ExcelOrderPreviewResponse,
  OrderExcelMapping,
} from "@/app/openapi-client/types.gen";

type PreviewState = {
  message?: string;
  preview?: ExcelOrderPreviewResponse;
};

export type ChannelOption = {
  id: string;
  name: string;
  order_excel_mapping?: OrderExcelMapping | null;
  order_excel_mapping_warnings?: string[];
};

export async function fetchChannelsForExcelSelect(): Promise<ChannelOption[]> {
  const token = await requireAccessToken();

  const { data, error } = await listChannels({
    query: { page: 1, size: 100 },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) return [];
  return (data?.items ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    order_excel_mapping: c.order_excel_mapping ?? null,
    order_excel_mapping_warnings: c.order_excel_mapping_warnings ?? [],
  }));
}

export async function previewOrdersExcel(
  _prevState: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  const token = await requireAccessToken();

  const channelId = formData.get("channel_id");
  if (typeof channelId !== "string" || channelId.length === 0) {
    return { message: "채널을 선택해주세요." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { message: "엑셀 파일을 선택해주세요." };

  const password = formData.get("password");
  const pw =
    typeof password === "string" && password.trim().length > 0
      ? password.trim()
      : undefined;

  const { data, error } = await previewExcelOrders({
    body: { file, channel_id: channelId, password: pw } as any,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { message: String(error?.detail ?? error ?? "미리보기 실패") };
  }

  return { preview: data ?? undefined };
}

type UploadState = {
  message?: string;
};

export async function uploadOrdersExcel(
  _prevState: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const token = await requireAccessToken();

  const payload = formData.get("payload");
  if (typeof payload !== "string" || payload.length === 0) {
    return { message: "업로드할 데이터가 없습니다." };
  }

  let body: {
    rows: Array<{
      channel: string;
      raw: Record<string, unknown>;
      items: Array<{
        product_id: string;
        quantity: number;
      }>;
      commission?: number | null;
    }>;
  };
  try {
    body = JSON.parse(payload) as typeof body;
  } catch {
    return { message: "업로드 데이터 형식이 올바르지 않습니다." };
  }

  const { error } = await uploadExcelOrders({
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { message: String(error?.detail ?? error ?? "업로드 실패") };
  }

  redirect("/orders");
}

