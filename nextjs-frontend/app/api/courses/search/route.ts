import { requireAccessToken } from "@/components/actions/auth-token";

export async function GET(request: Request) {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return new Response("API_BASE_URL is not configured", { status: 500 });
  }

  const token = await requireAccessToken();
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword");
  if (!keyword) {
    return new Response("keyword is required", { status: 400 });
  }

  const size = searchParams.get("size");
  const query = new URLSearchParams({ keyword });
  if (size) query.set("size", size);

  const res = await fetch(`${baseURL}/courses/search?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "application/json";
  const headers = new Headers({ "content-type": contentType });
  return new Response(res.body, { status: res.status, headers });
}
