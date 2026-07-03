import { fetchCourses, type CourseListSearch } from "@/components/actions/courses-action";
import { PagePagination } from "@/components/page-pagination";
import { getDefaultTraStartDateRange } from "@/lib/date-utils";
import { redirect } from "next/navigation";

import { CourseSearchForm } from "./course-search-form";
import { CoursesList } from "./courses-list";

interface CoursesPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    srch_tra_st_dt?: string;
    srch_tra_end_dt?: string;
    srch_tra_organ_nm?: string;
    srch_tra_process_nm?: string;
  }>;
}

function buildCourseSearchQuery(
  p: Awaited<CoursesPageProps["searchParams"]>,
): string {
  const parts: string[] = [];
  const add = (k: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(t)}`);
  };
  add("srch_tra_st_dt", p.srch_tra_st_dt);
  add("srch_tra_end_dt", p.srch_tra_end_dt);
  add("srch_tra_organ_nm", p.srch_tra_organ_nm);
  add("srch_tra_process_nm", p.srch_tra_process_nm);
  return parts.join("&");
}

function searchFromParams(
  p: Awaited<CoursesPageProps["searchParams"]>,
): CourseListSearch {
  const defaults = getDefaultTraStartDateRange();
  return {
    srch_tra_st_dt: p.srch_tra_st_dt ?? defaults.start,
    srch_tra_end_dt: p.srch_tra_end_dt ?? defaults.end,
    srch_tra_organ_nm: p.srch_tra_organ_nm,
    srch_tra_process_nm: p.srch_tra_process_nm,
  };
}

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const params = await searchParams;
  const defaults = getDefaultTraStartDateRange();

  if (!params.srch_tra_st_dt || !params.srch_tra_end_dt) {
    const q = new URLSearchParams();
    q.set("page", String(Number(params.page) || 1));
    q.set("size", String(Number(params.size) || 20));
    q.set(
      "srch_tra_st_dt",
      (params.srch_tra_st_dt ?? defaults.start).trim() || defaults.start,
    );
    q.set(
      "srch_tra_end_dt",
      (params.srch_tra_end_dt ?? defaults.end).trim() || defaults.end,
    );
    if (params.srch_tra_organ_nm?.trim()) {
      q.set("srch_tra_organ_nm", params.srch_tra_organ_nm.trim());
    }
    if (params.srch_tra_process_nm?.trim()) {
      q.set("srch_tra_process_nm", params.srch_tra_process_nm.trim());
    }
    redirect(`/courses?${q.toString()}`);
  }

  const page = Number(params.page) || 1;
  const size = Number(params.size) || 20;
  const extraQuery = buildCourseSearchQuery(params);
  const search = searchFromParams(params);

  const courses = await fetchCourses(page, size, search);
  const totalPages =
    "message" in courses ? 0 : Math.ceil(courses.total_count / size);

  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold">과정 조회</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Elasticsearch에 색인된 과정 데이터를 조회합니다. 최신 데이터는 관리자 과정 색인에서
        Work24 API로 수집·색인한 뒤 반영됩니다.
      </p>

      <section className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <CourseSearchForm
          size={size}
          initial={{
            srch_tra_st_dt: params.srch_tra_st_dt,
            srch_tra_end_dt: params.srch_tra_end_dt,
            srch_tra_organ_nm: params.srch_tra_organ_nm,
            srch_tra_process_nm: params.srch_tra_process_nm,
          }}
        />
      </section>

      <section className="mt-8 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        {"message" in courses ? (
          <p className="text-sm text-destructive">{courses.message}</p>
        ) : (
          <CoursesList items={courses.items ?? []} />
        )}

        <PagePagination
          currentPage={page}
          totalPages={Math.max(1, totalPages)}
          pageSize={size}
          totalItems={"message" in courses ? 0 : courses.total_count}
          basePath="/courses"
          extraQuery={extraQuery}
        />
      </section>
    </div>
  );
}
