import { cookies } from "next/headers";

type Params = { order_id: string };

export async function GET(
  _req: Request,
  ctx: { params: Promise<Params> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return new Response("No access token found", { status: 401 });

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return new Response("API_BASE_URL is not configured", { status: 500 });

  const { order_id } = await ctx.params;
  const url = new URL(
    `${baseURL}/orders/${encodeURIComponent(order_id)}/histories`,
  );

  // pass-through pagination query params if present
  // (default page/size are handled by backend)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reqUrl = new URL((_req as any).url);
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

