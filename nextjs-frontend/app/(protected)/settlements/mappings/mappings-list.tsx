"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createClientMappingAction,
  deleteClientMappingAction,
  updateClientMappingAction,
  type ClientNameMapping,
} from "@/components/actions/client-mappings-action";
import { Button } from "@/components/ui/button";
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
  items: ClientNameMapping[];
};

function MappingFormDialog({
  mode,
  initial,
  trigger,
  onDone,
}: {
  mode: "create" | "edit";
  initial?: ClientNameMapping;
  trigger: React.ReactNode;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [institutionName, setInstitutionName] = useState(
    initial?.institution_name ?? "",
  );
  const [clientName, setClientName] = useState(initial?.client_name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reset = () => {
    setInstitutionName(initial?.institution_name ?? "");
    setClientName(initial?.client_name ?? "");
    setError(null);
  };

  const onSubmit = async () => {
    setPending(true);
    setError(null);
    const payload = {
      institution_name: institutionName.trim(),
      client_name: clientName.trim(),
    };
    const result =
      mode === "create"
        ? await createClientMappingAction(payload)
        : await updateClientMappingAction(initial!.id, payload);
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
            {mode === "create" ? "고객사 맵핑 추가" : "고객사 맵핑 수정"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="institution_name">훈련기관명</Label>
            <Input
              id="institution_name"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              placeholder="Work24 훈련기관명"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client_name">고객사명</Label>
            <Input
              id="client_name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="정산 고객사명"
            />
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

export function ClientMappingsListHeader() {
  const router = useRouter();
  return (
    <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
      <h2 className="text-xl font-semibold">맵핑 목록</h2>
      <MappingFormDialog
        mode="create"
        trigger={<Button type="button">맵핑 추가</Button>}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

export function ClientMappingsList({ items }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async (id: number) => {
    if (!confirm("이 맵핑을 삭제할까요?")) return;
    setDeletingId(id);
    setError(null);
    const result = await deleteClientMappingAction(id);
    setDeletingId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="overflow-x-auto">
        <Table className="[&_td]:text-center">
          <TableHeader>
            <TableRow>
              <TableHead>훈련기관명</TableHead>
              <TableHead>고객사명</TableHead>
              <TableHead className="w-40">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  등록된 맵핑이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-left">{row.institution_name}</TableCell>
                  <TableCell className="text-left">{row.client_name}</TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2">
                      <MappingFormDialog
                        mode="edit"
                        initial={row}
                        trigger={
                          <Button type="button" variant="outline" size="sm">
                            수정
                          </Button>
                        }
                        onDone={() => router.refresh()}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={deletingId === row.id}
                        onClick={() => onDelete(row.id)}
                      >
                        삭제
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
