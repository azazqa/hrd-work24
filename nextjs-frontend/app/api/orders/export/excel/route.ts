import { cookies } from "next/headers";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return new Response("No access token found", { status: 401 });

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return new Response("API_BASE_URL is not configured", { status: 500 });
  }

  const reqUrl = new URL(req.url);
  const url = new URL(`${baseURL}/orders/export/excel`);
  for (const [k, v] of reqUrl.searchParams.entries()) {
    url.searchParams.set(k, v);
  }

  const body = await req.text();
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": req.headers.get("content-type") ?? "application/json",
    },
    body,
    cache: "no-store",
  });

  const headers = new Headers();
  headers.set(
    "content-type",
    res.headers.get("content-type") ??
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  const disposition = res.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);

  return new Response(res.body, { status: res.status, headers });
}

