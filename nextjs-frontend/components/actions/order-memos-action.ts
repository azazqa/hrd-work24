"use server";

import { requireAccessToken } from "@/components/actions/auth-token";
import { listOrderMemos, createOrderMemo } from "@/app/clientService";
import { revalidatePath } from "next/cache";
import type { OrderMemoRead } from "@/app/openapi-client";

export async function fetchOrderMemos(
  orderId: string,
): Promise<OrderMemoRead[] | { message: string }> {
  const token = await requireAccessToken();
  const { data, error } = await listOrderMemos({
    path: { order_id: orderId },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    return { message: String((error as { detail?: string })?.detail ?? error) };
  }
  return data ?? [];
}

export async function addOrderMemo(
  orderId: string,
  content: string,
): Promise<OrderMemoRead | { message: string }> {
  const token = await requireAccessToken();
  const trimmed = content.trim();
  if (!trimmed) {
    return { message: "메모 내용을 입력해 주세요." };
  }
  const { data, error } = await createOrderMemo({
    path: { order_id: orderId },
    body: { content: trimmed },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    return { message: String((error as { detail?: string })?.detail ?? error) };
  }
  if (!data) {
    return { message: "메모 등록에 실패했습니다." };
  }
  revalidatePath("/orders");
  return data;
}
