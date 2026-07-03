import { cookies } from "next/headers";

export type PermissionAction = "create" | "read" | "update" | "delete";

type PermissionItem = {
  resource: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
};

type PermissionResponse = { items: PermissionItem[] };

export async function getPermissionMap(): Promise<Record<string, PermissionItem>> {
  const store = await cookies();
  const token = store.get("accessToken")?.value;
  if (!token) return {};

  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return {};

  const res = await fetch(`${baseURL}/permissions/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return {};
  const data = (await res.json()) as PermissionResponse;
  const m: Record<string, PermissionItem> = {};
  for (const it of data.items ?? []) m[it.resource] = it;
  return m;
}

export async function canServer(resource: string, action: PermissionAction): Promise<boolean> {
  const perms = await getPermissionMap();
  const it = perms[resource];
  if (!it) return false;
  return {
    create: it.can_create,
    read: it.can_read,
    update: it.can_update,
    delete: it.can_delete,
  }[action];
}

