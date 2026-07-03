"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormError } from "@/components/ui/FormError";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SkeletonTableBodyRows } from "@/components/ui/SkeletonTable";

type UserRow = { id: string; email: string; is_superuser: boolean };

type PermissionItem = {
  resource: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
};

type PermissionResponse = { user_id: string; items: PermissionItem[] };

type ErrorState =
  | {
      server_error?: string;
      server_validation_error?: string;
      errors?: Record<string, string | string[]>;
    }
  | undefined;

function yn(v: boolean) {
  return v ? "예" : "아니오";
}

const PERM_KEYS = ["can_create", "can_read", "can_update", "can_delete"] as const;
type PermKey = (typeof PERM_KEYS)[number];

const PERM_LABELS: Record<PermKey, string> = {
  can_create: "생성",
  can_read: "읽기",
  can_update: "수정",
  can_delete: "삭제",
};

function ColumnToggleCheckbox({
  permKey,
  perms,
  setPerms,
}: {
  permKey: PermKey;
  perms: PermissionItem[];
  setPerms: Dispatch<SetStateAction<PermissionItem[]>>;
}) {
  const allTrue = perms.length > 0 && perms.every((p) => p[permKey]);
  const indeterminate =
    perms.length > 0 && !allTrue && perms.some((p) => p[permKey]);
  const checked: boolean | "indeterminate" = allTrue
    ? true
    : indeterminate
      ? "indeterminate"
      : false;

  const label = PERM_LABELS[permKey];

  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <span className="text-xs font-semibold leading-none">{label}</span>
      <Checkbox
        checked={checked}
        title={`${label} 전체 선택/해제`}
        aria-label={`${label} 권한 전체 선택 또는 해제`}
        onCheckedChange={(v) => {
          const nextVal = v === true;
          setPerms((prev) => prev.map((p) => ({ ...p, [permKey]: nextVal })));
        }}
      />
    </div>
  );
}

export default function Page() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [perms, setPerms] = useState<PermissionItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<ErrorState>(undefined);
  const [q, setQ] = useState("");

  async function loadUsers() {
    setLoadError(null);
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/users?offset=0&limit=100", { cache: "no-store" });
      if (!res.ok) {
        setLoadError(`Failed to load users (HTTP ${res.status})`);
        return;
      }
      const data = (await res.json()) as { items: any[] };
      setUsers(
        (data.items ?? []).map((u) => ({
          id: String(u.id),
          email: String(u.email ?? ""),
          is_superuser: Boolean(u.is_superuser),
        })),
      );
    } catch {
      setLoadError("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadPermissions(userId: string) {
    const res = await fetch(`/api/admin/permissions?user_id=${encodeURIComponent(userId)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Failed to load permissions (HTTP ${res.status}) ${text}`);
    }
    const data = (await res.json()) as PermissionResponse;
    setPerms(data.items ?? []);
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return users;
    return users.filter((u) => u.email.toLowerCase().includes(t));
  }, [users, q]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">권한 관리</div>
          <div className="text-sm text-gray-600">
            슈퍼관리자만 권한을 조회/수정할 수 있습니다.
          </div>
        </div>
        <div className="w-[260px]">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="사용자 검색(이메일)" />
        </div>
      </div>

      {loadError && <div className="text-sm text-red-600">{loadError}</div>}

      <div className="rounded border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">이메일</TableHead>
              <TableHead className="text-center">슈퍼유저</TableHead>
              <TableHead className="text-center">수정</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingUsers && users.length === 0 ? (
              <SkeletonTableBodyRows rows={5} columns={3} />
            ) : (
              <>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="">{u.email}</TableCell>
                    <TableCell className="text-center w-24">{yn(u.is_superuser)}</TableCell>
                    <TableCell className="text-center w-20">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setState(undefined);
                          setSelected(u);
                          setOpen(true);
                          try {
                            await loadPermissions(u.id);
                          } catch (e: any) {
                            setState({ server_error: String(e?.message ?? e) });
                          }
                        }}
                      >
                        수정
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-gray-500 text-center">
                      데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setSelected(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>권한 수정</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label>사용자</Label>
                <Input value={selected.email} readOnly />
              </div>

              <div className="rounded border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center align-middle">리소스</TableHead>
                      <TableHead className="p-1 text-center align-bottom">
                        <ColumnToggleCheckbox permKey="can_create" perms={perms} setPerms={setPerms} />
                      </TableHead>
                      <TableHead className="p-1 text-center align-bottom">
                        <ColumnToggleCheckbox permKey="can_read" perms={perms} setPerms={setPerms} />
                      </TableHead>
                      <TableHead className="p-1 text-center align-bottom">
                        <ColumnToggleCheckbox permKey="can_update" perms={perms} setPerms={setPerms} />
                      </TableHead>
                      <TableHead className="p-1 text-center align-bottom">
                        <ColumnToggleCheckbox permKey="can_delete" perms={perms} setPerms={setPerms} />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perms.map((p, idx) => (
                      <TableRow key={p.resource}>
                        <TableCell className="">{p.resource}</TableCell>
                        {PERM_KEYS.map((k) => (
                          <TableCell key={k} className="text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={p[k]}
                                onCheckedChange={(v) => {
                                  const next = perms.slice();
                                  next[idx] = { ...p, [k]: v === true };
                                  setPerms(next);
                                }}
                                aria-label={`${p.resource} ${PERM_LABELS[k]}`}
                              />
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <FormError state={state} />

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button">
                    닫기
                  </Button>
                </DialogClose>
                <Button
                  disabled={saving || !selected}
                  onClick={async () => {
                    if (!selected) return;
                    setSaving(true);
                    setState(undefined);
                    try {
                      const res = await fetch(
                        `/api/admin/permissions?user_id=${encodeURIComponent(selected.id)}`,
                        {
                          method: "PUT",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ items: perms }),
                        },
                      );
                      if (!res.ok) {
                        const text = await res.text().catch(() => "");
                        setState({ server_error: `Failed to save (HTTP ${res.status}) ${text}` });
                        return;
                      }
                      setOpen(false);
                    } catch {
                      setState({ server_error: "Failed to save" });
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  저장
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

