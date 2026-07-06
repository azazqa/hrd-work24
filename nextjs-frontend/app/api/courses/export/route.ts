import { requireAccessToken } from "@/components/actions/auth-token";

export async function GET(request: Request) {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return new Response("API_BASE_URL is not configured", { status: 500 });
  }

  const token = await requireAccessToken();
  const { searchParams } = new URL(request.url);
  const ownedYear = searchParams.get("owned_year");
  const srchTraStDt = searchParams.get("srch_tra_st_dt");
  const srchTraEndDt = searchParams.get("srch_tra_end_dt");

  if (!ownedYear && (!srchTraStDt || !srchTraEndDt)) {
    return new Response("owned_year or srch_tra_st_dt and srch_tra_end_dt are required", {
      status: 400,
    });
  }

  const query = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (key === "page" || key === "size") continue;
    query.set(key, value);
  }

  const res = await fetch(`${baseURL}/courses/export?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await res.json();
      return Response.json(body, { status: res.status });
    }
    const text = await res.text();
    return new Response(text, { status: res.status });
  }

  const contentDisposition =
    res.headers.get("content-disposition") ??
    'attachment; filename="courses_export.xlsx"';

  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type":
        res.headers.get("content-type") ??
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": contentDisposition,
    },
  });
}
