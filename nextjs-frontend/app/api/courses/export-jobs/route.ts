import { requireAccessToken } from "@/components/actions/auth-token";

function baseUrlOrError(): string | Response {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return new Response("API_BASE_URL is not configured", { status: 500 });
  }
  return baseURL;
}

export async function GET(request: Request) {
  const baseURL = baseUrlOrError();
  if (baseURL instanceof Response) return baseURL;

  const token = await requireAccessToken();
  const { searchParams } = new URL(request.url);

  const res = await fetch(`${baseURL}/courses/export-jobs?${searchParams.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function POST(request: Request) {
  const baseURL = baseUrlOrError();
  if (baseURL instanceof Response) return baseURL;

  const token = await requireAccessToken();
  const body = await request.text();

  const res = await fetch(`${baseURL}/courses/export-jobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body,
    cache: "no-store",
  });

  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
