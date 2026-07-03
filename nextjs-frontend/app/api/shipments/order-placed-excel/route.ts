import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;

  if (!token) {
    return new Response("No access token found", { status: 401 });
  }

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return new Response("API_BASE_URL is not configured", { status: 500 });
  }

  const res = await fetch(`${baseURL}/shipments/order-placed/excel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.ok) {
    const headers = new Headers();
    const contentType =
      res.headers.get("content-type") ??
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    headers.set("content-type", contentType);
    const disposition = res.headers.get("content-disposition");
    if (disposition) headers.set("content-disposition", disposition);

    return new Response(res.body, { status: res.status, headers });
  }

  const headers = new Headers();
  const contentType =
    res.headers.get("content-type") ??
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  headers.set("content-type", contentType);

  const disposition = res.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);

  return new Response(res.body, { status: res.status, headers });
}

