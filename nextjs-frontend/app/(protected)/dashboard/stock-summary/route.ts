import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) {
    return Response.json({ message: "No access token found" }, { status: 401 });
  }

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) {
    return Response.json(
      { message: "API_BASE_URL is not configured" },
      { status: 500 }
    );
  }

  const url = new URL(`${baseURL}/stocks/summary/by-product-and-condition`);
  const locationId = new URL(request.url).searchParams.get("location");
  if (locationId && locationId.trim()) {
    url.searchParams.set("logistics_location_id", locationId.trim());
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 404) {
      return Response.json({ message: "권한없음" }, { status: 404 });
    }
    return Response.json(
      { message: `Failed to load stock summary (HTTP ${res.status})` },
      { status: res.status }
    );
  }

  const data = await res.json();
  return Response.json(data);
}

