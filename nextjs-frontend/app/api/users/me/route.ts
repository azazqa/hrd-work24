import { cookies } from "next/headers";

type BackendUserMe = {
  id: string;
  email?: string;
  is_superuser?: boolean;
  department?: string | null;
  full_name?: string | null;
  phone?: string | null;
  extension_number?: string | null;
  logistics_location_id?: string | null;
};

type LocationRead = {
  id: string;
  name: string;
};

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return new Response("No access token found", { status: 401 });

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return new Response("API_BASE_URL is not configured", { status: 500 });

  const meRes = await fetch(`${baseURL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!meRes.ok) {
    const contentType = meRes.headers.get("content-type") ?? "application/json";
    const headers = new Headers({ "content-type": contentType });
    return new Response(meRes.body, { status: meRes.status, headers });
  }

  const me = (await meRes.json()) as BackendUserMe;
  const logistics_location_id = me.logistics_location_id ?? null;

  let logistics_location_name: string | null = null;
  if (logistics_location_id) {
    const locRes = await fetch(
      `${baseURL}/logistics-locations/${encodeURIComponent(logistics_location_id)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    if (locRes.ok) {
      const loc = (await locRes.json()) as LocationRead;
      logistics_location_name = String(loc?.name ?? "") || null;
    }
  }

  return Response.json({
    id: me.id,
    email: me.email ?? null,
    is_superuser: Boolean(me.is_superuser),
    department: me.department ?? null,
    full_name: me.full_name ?? null,
    phone: me.phone ?? null,
    extension_number: me.extension_number ?? null,
    logistics_location_id,
    logistics_location_name,
  });
}

