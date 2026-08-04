import { requireAccessToken } from "@/components/actions/auth-token";

export async function GET() {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return new Response("API_BASE_URL is not configured", { status: 500 });
  }

  const token = await requireAccessToken();
  const res = await fetch(`${baseURL}/settlements/export`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `내보내기에 실패했습니다. (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      /* ignore */
    }
    return new Response(message, { status: res.status });
  }

  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type":
        res.headers.get("content-type") ??
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition":
        res.headers.get("content-disposition") ??
        'attachment; filename="settlements_consolidated.xlsx"',
    },
  });
}
