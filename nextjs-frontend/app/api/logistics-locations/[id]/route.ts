import { cookies } from "next/headers";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return new Response("No access token found", { status: 401 });

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return new Response("API_BASE_URL is not configured", { status: 500 });

  const res = await fetch(`${baseURL}/logistics-locations/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "application/json";
  const headers = new Headers({ "content-type": contentType });
  return new Response(res.body, { status: res.status, headers });
}

