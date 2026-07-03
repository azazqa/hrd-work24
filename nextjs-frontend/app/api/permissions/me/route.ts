import { cookies } from "next/headers";

export async function GET() {
  const store = await cookies();
  const token = store.get("accessToken")?.value;
  if (!token) return new Response("No access token found", { status: 401 });

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return new Response("API_BASE_URL is not configured", { status: 500 });

  const res = await fetch(`${baseURL}/permissions/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

