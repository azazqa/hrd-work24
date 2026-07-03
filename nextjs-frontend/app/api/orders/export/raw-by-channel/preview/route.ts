import { cookies } from "next/headers";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return new Response("No access token found", { status: 401 });

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return new Response("API_BASE_URL is not configured", { status: 500 });

  const reqUrl = new URL(req.url);
  const url = new URL(`${baseURL}/orders/export/raw-by-channel/preview`);
  for (const [k, v] of reqUrl.searchParams.entries()) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "application/json";
  const headers = new Headers({ "content-type": contentType });
  return new Response(res.body, { status: res.status, headers });
}

