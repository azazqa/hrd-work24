"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createCompanyAction,
  deleteCompanyAction,
  updateCompanyAction,
  type Company,
} from "@/components/actions/companies-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  items: Company[];
};

function CompanyFormDialog({
  mode,
  initial,
  trigger,
  onDone,
}: {
  mode: "create" | "edit";
  initial?: Company;
  trigger: React.ReactNode;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reset = () => {
    setName(initial?.name ?? "");
    setIsActive(initial?.is_active ?? true);
    setError(null);
  };

  const onSubmit = async () => {
    setPending(true);
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setPending(false);
      setError("업체명을 입력하세요.");
      return;
    }
    const result =
      mode === "create"
        ? await createCompanyAction({ name: trimmed, is_active: isActive })
        : await updateCompanyAction(initial!.id, {
            name: trimmed,
            is_active: isActive,
          });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(false);
    onDone();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "업체 등록" : "업체 수정"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="company_name">업체명</Label>
            <Input
              id="company_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="업체명"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
            <Label htmlFor="is_active">사용</Label>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button type="button" onClick={onSubmit} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CompaniesListHeader() {
  const router = useRouter();
  return (
    <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
      <h2 className="text-xl font-semibold">업체 목록</h2>
      <CompanyFormDialog
        mode="create"
        trigger={<Button type="button">업체 등록</Button>}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

export function CompaniesList({ items }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async (id: number) => {
    if (!confirm("이 업체를 삭제(비활성)할까요?")) return;
    setDeletingId(id);
    setError(null);
    const result = await deleteCompanyAction(id);
    setDeletingId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  };

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">등록된 업체가 없습니다.</p>;
  }

  return (
    <div>
      {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>업체명</TableHead>
            <TableHead className="w-24">사용</TableHead>
            <TableHead className="w-40 text-right">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.is_active ? "사용" : "미사용"}</TableCell>
              <TableCell className="text-right space-x-2">
                <CompanyFormDialog
                  mode="edit"
                  initial={row}
                  trigger={
                    <Button type="button" size="sm" variant="outline">
                      수정
                    </Button>
                  }
                  onDone={() => router.refresh()}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={deletingId === row.id}
                  onClick={() => onDelete(row.id)}
                >
                  삭제
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
