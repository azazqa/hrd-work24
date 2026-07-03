"use server";

import { listCourses, type CourseListResponse } from "@/app/clientService";
import { requireAccessToken } from "@/components/actions/auth-token";

export type CourseListSearch = {
  srch_tra_st_dt: string;
  srch_tra_end_dt: string;
  srch_tra_organ_nm?: string;
  srch_tra_process_nm?: string;
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
  return "과정 조회에 실패했습니다.";
}

export async function fetchCourses(
  page: number,
  size: number,
  search: CourseListSearch,
): Promise<CourseListResponse | { message: string }> {
  const token = await requireAccessToken();
  const { data, error } = await listCourses({
    query: {
      srch_tra_st_dt: search.srch_tra_st_dt,
      srch_tra_end_dt: search.srch_tra_end_dt,
      srch_tra_organ_nm: search.srch_tra_organ_nm?.trim() || undefined,
      srch_tra_process_nm: search.srch_tra_process_nm?.trim() || undefined,
      page_num: page,
      page_size: size,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    return { message: formatApiError(error) };
  }
  if (!data) {
    return { message: "과정 조회에 실패했습니다." };
  }
  return data;
}
