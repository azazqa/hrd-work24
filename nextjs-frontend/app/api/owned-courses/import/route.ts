import { requireAccessToken } from "@/components/actions/auth-token";

export async function POST(request: Request) {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return new Response("API_BASE_URL is not configured", { status: 500 });
  }

  const token = await requireAccessToken();
  const formData = await request.formData();

  const res = await fetch(`${baseURL}/owned-courses/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "application/json";
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": contentType },
  });
}
