"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submitButton";
import { FormError } from "@/components/ui/FormError";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SkeletonTableBodyRows } from "@/components/ui/SkeletonTable";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  adminUpdateUser,
  adminSetPassword,
  createAdminUser,
  fetchAdminUsers,
  type AdminUserListResponse,
} from "@/components/actions/admin-users-action";

type ActionState =
  | {
      server_error?: string;
      server_validation_error?: string;
      errors?: Record<string, string | string[]>;
    }
  | undefined;

export default function Page() {
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [data, setData] = useState<AdminUserListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pwUserId, setPwUserId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [editLocationId, setEditLocationId] = useState<string>("");
  const NONE_LOCATION = "__none__";

  const [createState, createDispatch] = useActionState<ActionState, FormData>(
    async (_prev, formData) => {
      const res = await createAdminUser(formData);
      if ("message" in res && res.message) return { server_error: res.message };
      await reload();
      setCreateOpen(false);
      return undefined;
    },
    undefined,
  );

  const [pwState, pwDispatch] = useActionState<ActionState, FormData>(
    async (_prev, formData) => {
      const res = await adminSetPassword(formData);
      if ("message" in res && res.message) return { server_error: res.message };
      await reload();
      toast.success("비밀번호 변경 완료");
      setPwOpen(false);
      return undefined;
    },
    undefined,
  );

  const [editState, editDispatch] = useActionState<ActionState, FormData>(
    async (_prev, formData) => {
      const res = await adminUpdateUser(formData);
      if ("message" in res && res.message) return { server_error: res.message };
      await reload();
      setEditOpen(false);
      return undefined;
    },
    undefined,
  );

  async function reload() {
    setLoadError(null);
    const res = await fetchAdminUsers(offset, limit);
    if ("message" in (res as any)) {
      setLoadError((res as any).message);
      return;
    }
    setData(res as AdminUserListResponse);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const pageInfo = useMemo(() => {
    if (!data) return null;
    const total = data.total ?? 0;
    const from = Math.min(total, offset + 1);
    const to = Math.min(total, offset + limit);
    return { total, from, to };
  }, [data, offset]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return (data?.items ?? []).find((u) => u.id === selectedUserId) ?? null;
  }, [data, selectedUserId]);

  const pwUser = useMemo(() => {
    if (!pwUserId) return null;
    return (data?.items ?? []).find((u) => u.id === pwUserId) ?? null;
  }, [data, pwUserId]);

  useEffect(() => {
    if (!editOpen) return;
    if (!selectedUser) return;
    setEditLocationId(String(selectedUser.logistics_location_id ?? ""));
  }, [editOpen, selectedUser]);

  useEffect(() => {
    if (!editOpen) return;
    if (locationsLoaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/logistics-locations?page=1&size=100", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { items?: Array<{ id: string; name: string }> };
        const items = Array.isArray(json.items) ? json.items : [];
        if (cancelled) return;
        setLocations(items.map((it) => ({ id: String(it.id), name: String(it.name ?? "") })).filter((it) => it.id));
        setLocationsLoaded(true);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editOpen, locationsLoaded]);

  function yn(value: boolean) {
    return value ? "예" : "아니오";
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>사용자 관리</CardTitle>
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            variant="default"
          >
            사용자 등록
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          {loadError && (
            <div className="text-sm text-red-600">{loadError}</div>
          )}

          <div className="rounded border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">이메일</TableHead>
                  <TableHead className="text-center min-w-24">이름</TableHead>
                  <TableHead className="text-center min-w-28">핸드폰</TableHead>
                  <TableHead className="text-center min-w-20">내선</TableHead>
                  <TableHead className="text-center min-w-24">부서</TableHead>
                  <TableHead className="text-center min-w-32">담당 출고지</TableHead>
                  <TableHead className="text-center w-24">활성</TableHead>
                  <TableHead className="text-center w-24">슈퍼유저</TableHead>
                  <TableHead className="text-center w-24">검증</TableHead>
                  <TableHead className="text-center w-20">비밀번호</TableHead>
                  <TableHead className="text-center w-20">수정</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data && !loadError ? (
                  <SkeletonTableBodyRows rows={5} columns={11} />
                ) : (
                  <>
                    {(data?.items ?? []).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="">{u.email}</TableCell>
                        <TableCell className="text-center">
                          {u.full_name?.trim() || "—"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground  text-xs">
                          {u.phone?.trim() || "—"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground  text-xs">
                          {u.extension_number?.trim() || "—"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {u.department?.trim() || "—"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {u.logistics_location_name?.trim() || "-"}
                        </TableCell>
                        <TableCell className="text-center">{yn(u.is_active)}</TableCell>
                        <TableCell className="text-center">{yn(u.is_superuser)}</TableCell>
                        <TableCell className="text-center">{yn(u.is_verified)}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPwUserId(u.id);
                              setPwOpen(true);
                            }}
                          >
                            변경
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUserId(u.id);
                              setEditOpen(true);
                            }}
                          >
                            수정
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {data && !data.items?.length && (
                      <TableRow>
                        <TableCell className="text-gray-500 text-center" colSpan={11}>
                          데이터가 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          {pageInfo && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                {pageInfo.from}-{pageInfo.to} / {pageInfo.total}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded border px-2 py-1 disabled:opacity-50"
                  onClick={() => setOffset((v) => Math.max(0, v - limit))}
                  disabled={offset === 0}
                  type="button"
                >
                  이전
                </button>
                <button
                  className="rounded border px-2 py-1 disabled:opacity-50"
                  onClick={() =>
                    setOffset((v) =>
                      data && v + limit < (data.total ?? 0) ? v + limit : v,
                    )
                  }
                  disabled={!data || offset + limit >= (data.total ?? 0)}
                  type="button"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 등록</DialogTitle>
          </DialogHeader>
          <form action={createDispatch} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="create_email">이메일(로그인 아이디)</Label>
              <Input
                id="create_email"
                name="email"
                type="text"
                minLength={4}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create_full_name">이름</Label>
              <Input id="create_full_name" name="full_name" type="text" maxLength={128} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create_department">부서</Label>
              <Input id="create_department" name="department" type="text" maxLength={128} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create_phone">핸드폰</Label>
              <Input id="create_phone" name="phone" type="tel" maxLength={32} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create_extension_number">내선번호</Label>
              <Input
                id="create_extension_number"
                name="extension_number"
                type="text"
                maxLength={32}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create_password">초기 비밀번호</Label>
              <Input
                id="create_password"
                name="password"
                type="password"
                minLength={8}
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_superuser" />
              슈퍼유저
            </label>
            <FormError state={createState} />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  닫기
                </Button>
              </DialogClose>
              <SubmitButton text="등록" className="w-auto" />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setSelectedUserId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 수정</DialogTitle>
          </DialogHeader>

          {!selectedUser ? (
            <div className="grid gap-4">
              <div className="text-sm text-gray-600">사용자를 선택하세요.</div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button">
                    닫기
                  </Button>
                </DialogClose>
              </DialogFooter>
            </div>
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label>이메일</Label>
                <Input value={selectedUser.email} readOnly />
              </div>

              <form
                key={selectedUser.id}
                action={editDispatch}
                className="grid gap-3"
              >
                <input type="hidden" name="user_id" value={selectedUser.id} />
                <input type="hidden" name="logistics_location_id" value={editLocationId} />

                <div className="grid gap-2">
                  <Label htmlFor="edit_full_name">이름</Label>
                  <Input
                    id="edit_full_name"
                    name="full_name"
                    type="text"
                    maxLength={128}
                    defaultValue={selectedUser.full_name ?? ""}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_department">부서</Label>
                  <Input
                    id="edit_department"
                    name="department"
                    type="text"
                    maxLength={128}
                    defaultValue={selectedUser.department ?? ""}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_phone">핸드폰</Label>
                  <Input
                    id="edit_phone"
                    name="phone"
                    type="tel"
                    maxLength={32}
                    defaultValue={selectedUser.phone ?? ""}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_extension_number">내선번호</Label>
                  <Input
                    id="edit_extension_number"
                    name="extension_number"
                    type="text"
                    maxLength={32}
                    defaultValue={selectedUser.extension_number ?? ""}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={selectedUser.is_active}
                  />
                  활성
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_superuser"
                    defaultChecked={selectedUser.is_superuser}
                  />
                  슈퍼유저
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_verified"
                    defaultChecked={selectedUser.is_verified}
                  />
                  검증
                </label>

                <div className="grid gap-2">
                  <Label>담당 출고지</Label>
                  <Select
                    value={editLocationId || NONE_LOCATION}
                    onValueChange={(v) => setEditLocationId(v === NONE_LOCATION ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="미지정" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_LOCATION}>미지정</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <FormError state={editState} />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" type="button">
                      닫기
                    </Button>
                  </DialogClose>
                  <SubmitButton text="저장" className="w-auto" />
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Password dialog */}
      <Dialog
        open={pwOpen}
        onOpenChange={(open) => {
          setPwOpen(open);
          if (!open) setPwUserId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>비밀번호 변경</DialogTitle>
          </DialogHeader>

          {!pwUser ? (
            <div className="grid gap-4">
              <div className="text-sm text-gray-600">사용자를 선택하세요.</div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button">
                    닫기
                  </Button>
                </DialogClose>
              </DialogFooter>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>이메일</Label>
                <Input value={pwUser.email} readOnly />
              </div>
              <form
                action={pwDispatch}
                className="grid gap-2"
              >
                <input type="hidden" name="user_id" value={pwUser.id} />
                <Input
                  name="password"
                  type="password"
                  placeholder="새 비밀번호"
                  minLength={8}
                  required
                />
                <FormError state={pwState} />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" type="button">
                      닫기
                    </Button>
                  </DialogClose>
                  <SubmitButton text="비밀번호 변경" className="w-auto" />
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

