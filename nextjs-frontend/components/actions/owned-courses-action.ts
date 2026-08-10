"use server";

import "@/lib/clientConfig";
import {
  createOwnedCourse,
  deleteOwnedCourse,
  getOwnedCourse,
  listOwnedCourses,
  updateOwnedCourse,
  type OwnedCourseCreate,
  type OwnedCourseRead,
  type OwnedCourseUpdate,
  type PageOwnedCourseListItem,
} from "@/app/clientService";
import { requireAccessToken } from "@/components/actions/auth-token";

export type OwnedCourseListSearch = {
  q?: string;
  company_id?: number;
  is_active?: boolean;
  dev_year?: number;
  division?: string;
};

function formatApiError(error: { detail?: unknown }): string {
  const { detail } = error;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const parts = detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String(d.msg) : ""))
      .filter(Boolean);
    if (parts.length > 0) return parts.join("; ");
  }
  return "요청에 실패했습니다.";
}

export async function fetchOwnedCourses(
  page: number,
  size: number,
  search: OwnedCourseListSearch,
): Promise<PageOwnedCourseListItem | { message: string }> {
  const token = await requireAccessToken();
  const { data, error } = await listOwnedCourses({
    query: {
      page,
      size,
      q: search.q?.trim() || undefined,
      company_id: search.company_id,
      is_active: search.is_active,
      dev_year: search.dev_year,
      division: search.division?.trim() || undefined,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    return { message: formatApiError(error) };
  }
  if (!data) {
    return { message: "보유 과정 조회에 실패했습니다." };
  }
  return data;
}

export async function fetchOwnedCourse(
  id: number,
): Promise<OwnedCourseRead | { message: string }> {
  const token = await requireAccessToken();
  const { data, error } = await getOwnedCourse({
    path: { course_id: id },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    return { message: formatApiError(error) };
  }
  if (!data) {
    return { message: "보유 과정을 찾을 수 없습니다." };
  }
  return data;
}

export async function createOwnedCourseAction(
  body: OwnedCourseCreate,
): Promise<{ ok: true; data: OwnedCourseRead } | { ok: false; message: string }> {
  const token = await requireAccessToken();
  const { data, error } = await createOwnedCourse({
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    return { ok: false, message: formatApiError(error) };
  }
  if (!data) {
    return { ok: false, message: "등록에 실패했습니다." };
  }
  return { ok: true, data };
}

export async function updateOwnedCourseAction(
  id: number,
  body: OwnedCourseUpdate,
): Promise<{ ok: true; data: OwnedCourseRead } | { ok: false; message: string }> {
  const token = await requireAccessToken();
  const { data, error } = await updateOwnedCourse({
    path: { course_id: id },
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    return { ok: false, message: formatApiError(error) };
  }
  if (!data) {
    return { ok: false, message: "수정에 실패했습니다." };
  }
  return { ok: true, data };
}

export async function deleteOwnedCourseAction(
  id: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const token = await requireAccessToken();
  const { error } = await deleteOwnedCourse({
    path: { course_id: id },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    return { ok: false, message: formatApiError(error) };
  }
  return { ok: true };
}
