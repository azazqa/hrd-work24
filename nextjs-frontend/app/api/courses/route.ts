import { requireAccessToken } from "@/components/actions/auth-token";

export async function GET(request: Request) {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return new Response("API_BASE_URL is not configured", { status: 500 });
  }

  const token = await requireAccessToken();
  const { searchParams } = new URL(request.url);
  const srchTraStDt = searchParams.get("srch_tra_st_dt");
  const srchTraEndDt = searchParams.get("srch_tra_end_dt");
  if (!srchTraStDt || !srchTraEndDt) {
    return new Response("srch_tra_st_dt and srch_tra_end_dt are required", {
      status: 400,
    });
  }

  const query = new URLSearchParams({
    srch_tra_st_dt: srchTraStDt,
    srch_tra_end_dt: srchTraEndDt,
  });

  const optionalKeys = [
    "srch_tra_organ_nm",
    "srch_tra_process_nm",
    "has_reg_course_man",
    "page_num",
    "page_size",
  ] as const;
  for (const key of optionalKeys) {
    const value = searchParams.get(key);
    if (value) query.set(key, value);
  }

  const res = await fetch(`${baseURL}/courses?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "application/json";
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": contentType },
  });
}
