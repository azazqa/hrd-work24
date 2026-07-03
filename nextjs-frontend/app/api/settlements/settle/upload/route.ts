import { cookies } from "next/headers";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return new Response("No access token found", { status: 401 });

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return new Response("API_BASE_URL is not configured", { status: 500 });

  const formData = await request.formData();
  const res = await fetch(`${baseURL}/settlements/settle/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "application/json";
  const headers = new Headers({ "content-type": contentType });
  return new Response(res.body, { status: res.status, headers });
}

