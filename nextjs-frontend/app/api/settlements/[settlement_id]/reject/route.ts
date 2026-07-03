import { cookies } from "next/headers";

type Params = { settlement_id: string };

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return new Response("No access token found", { status: 401 });

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return new Response("API_BASE_URL is not configured", { status: 500 });

  const { settlement_id } = await ctx.params;
  const res = await fetch(
    `${baseURL}/settlements/${encodeURIComponent(settlement_id)}/reject`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  const contentType = res.headers.get("content-type") ?? "application/json";
  const headers = new Headers({ "content-type": contentType });
  return new Response(res.body, { status: res.status, headers });
}

