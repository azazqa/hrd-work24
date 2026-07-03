import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return new Response("No access token found", { status: 401 });

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return new Response("API_BASE_URL is not configured", { status: 500 });

  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? "1";
  const size = url.searchParams.get("size") ?? "100";
  const name = url.searchParams.get("name");
  const description = url.searchParams.get("description");

  const backendUrl = new URL(`${baseURL}/logistics-locations/`);
  backendUrl.searchParams.set("page", page);
  backendUrl.searchParams.set("size", size);
  if (name) backendUrl.searchParams.set("name", name);
  if (description) backendUrl.searchParams.set("description", description);

  const res = await fetch(backendUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "application/json";
  const headers = new Headers({ "content-type": contentType });
  return new Response(res.body, { status: res.status, headers });
}

