import { requireAccessToken } from "@/components/actions/auth-token";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return new Response("API_BASE_URL is not configured", { status: 500 });
  }

  const { id } = await params;
  const token = await requireAccessToken();

  const res = await fetch(`${baseURL}/courses/export-jobs/${id}/download`, {
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
