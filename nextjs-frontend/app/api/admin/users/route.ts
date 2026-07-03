import { cookies } from "next/headers";

export async function GET(request: Request) {
  const store = await cookies();
  const token = store.get("accessToken")?.value;
  if (!token) return new Response("No access token found", { status: 401 });

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return new Response("API_BASE_URL is not configured", { status: 500 });

  const url = new URL(request.url);
  const offset = url.searchParams.get("offset") ?? "0";
  const limit = url.searchParams.get("limit") ?? "50";

  const res = await fetch(
    `${baseURL}/admin/users?offset=${encodeURIComponent(offset)}&limit=${encodeURIComponent(limit)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );

  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

