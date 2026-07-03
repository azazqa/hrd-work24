"use client";

import React from "react";

export type PermissionAction = "create" | "read" | "update" | "delete";

export type PermissionItem = {
  resource: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
};

type PermissionResponse = { items: PermissionItem[] };

type PermissionMap = Record<string, PermissionItem>;

function toMap(items: PermissionItem[]): PermissionMap {
  const m: PermissionMap = {};
  for (const it of items) m[it.resource] = it;
  return m;
}

function parseSnapshot(json: string | null): { map: PermissionMap; valid: boolean } {
  if (!json) return { map: {}, valid: false };
  try {
    const data = JSON.parse(json) as PermissionResponse;
    const items = data.items ?? [];
    if (!Array.isArray(items)) return { map: {}, valid: false };
    return { map: toMap(items), valid: true };
  } catch {
    return { map: {}, valid: false };
  }
}

type PermissionsContextValue = {
  loading: boolean;
  error: string | null;
  perms: PermissionMap;
  reload: () => Promise<void>;
  can: (resource: string, action: PermissionAction) => boolean;
};

const PermissionsContext = React.createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({
  children,
  initialPermissionsJson,
}: {
  children: React.ReactNode;
  initialPermissionsJson: string | null;
}) {
  const initial = React.useMemo(
    () => parseSnapshot(initialPermissionsJson),
    [initialPermissionsJson],
  );

  const [loading, setLoading] = React.useState(() => !initial.valid);
  const [error, setError] = React.useState<string | null>(null);
  const [perms, setPerms] = React.useState<PermissionMap>(() => initial.map);

  React.useEffect(() => {
    const next = parseSnapshot(initialPermissionsJson);
    if (next.valid) {
      setPerms(next.map);
      setLoading(false);
      setError(null);
    }
  }, [initialPermissionsJson]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/permissions/me", { cache: "no-store" });
      if (!res.ok) {
        setError(`Failed to load permissions (HTTP ${res.status})`);
        setPerms({});
        return;
      }
      const data = (await res.json()) as PermissionResponse;
      setPerms(toMap(data.items ?? []));
    } catch (e) {
      setError(`Failed to load permissions`);
      setPerms({});
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (parseSnapshot(initialPermissionsJson).valid) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/permissions/me", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setError(`Failed to load permissions (HTTP ${res.status})`);
            setPerms({});
          }
          return;
        }
        const data = (await res.json()) as PermissionResponse;
        if (!cancelled) setPerms(toMap(data.items ?? []));
      } catch {
        if (!cancelled) {
          setError(`Failed to load permissions`);
          setPerms({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialPermissionsJson]);

  const can = React.useCallback(
    (resource: string, action: PermissionAction) => {
      // If perms not loaded yet, default deny (hide).
      const item = perms[resource];
      const v = item ?? null;
      if (!v) return false;
      return {
        create: v.can_create,
        read: v.can_read,
        update: v.can_update,
        delete: v.can_delete,
      }[action];
    },
    [perms],
  );

  const value: PermissionsContextValue = React.useMemo(
    () => ({ loading, error, perms, reload, can }),
    [loading, error, perms, reload, can],
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const ctx = React.useContext(PermissionsContext);
  if (!ctx) {
    throw new Error("usePermissions must be used within PermissionsProvider");
  }
  return ctx;
}

