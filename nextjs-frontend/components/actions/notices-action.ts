"use server";

import { requireAccessToken } from "@/components/actions/auth-token";
import { revalidatePath } from "next/cache";

export type NoticeRead = {
  id: string;
  content: string;
  update_user_id: string;
  created_at: string;
  updated_at: string;
};

export async function fetchLatestNotice(): Promise<NoticeRead | null> {
  const token = await requireAccessToken();
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return null;

  const res = await fetch(`${baseURL}/notices/latest`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as NoticeRead | null;
}

export async function createNotice(
  content: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const token = await requireAccessToken();
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return { ok: false, message: "API_BASE_URL is not configured" };

  const text = content.trim();
  if (!text) return { ok: false, message: "공지 내용을 입력해 주세요." };

  const res = await fetch(`${baseURL}/notices/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: text }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, message: body || `HTTP ${res.status}` };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

