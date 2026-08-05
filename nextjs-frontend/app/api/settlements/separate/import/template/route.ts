import { requireAccessToken } from "@/components/actions/auth-token";

export async function GET() {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return new Response("API_BASE_URL is not configured", { status: 500 });
  }

  const token = await requireAccessToken();
  const res = await fetch(`${baseURL}/settlements/separate/import/template`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type":
        res.headers.get("content-type") ??
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition":
        res.headers.get("content-disposition") ??
        'attachment; filename="separate_settlements_template.xlsx"',
    },
  });
}
