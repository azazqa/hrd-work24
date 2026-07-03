import { cookies } from "next/headers";

export async function GET(request: Request) {
  const store = await cookies();
  const token = store.get("accessToken")?.value;
  if (!token) return new Response("No access token found", { status: 401 });

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return new Response("API_BASE_URL is not configured", { status: 500 });

  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) return new Response("user_id is required", { status: 422 });

  const res = await fetch(`${baseURL}/admin/permissions?user_id=${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function PUT(request: Request) {
  const store = await cookies();
  const token = store.get("accessToken")?.value;
  if (!token) return new Response("No access token found", { status: 401 });

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return new Response("API_BASE_URL is not configured", { status: 500 });

  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) return new Response("user_id is required", { status: 422 });

  const body = await request.text();
  const res = await fetch(`${baseURL}/admin/permissions?user_id=${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body,
    cache: "no-store",
  });

  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

