"use client";

import { useEffect, useState } from "react";
import { Loader2, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import type { OrderMemoRead } from "@/app/openapi-client";
import { addOrderMemo, fetchOrderMemos } from "@/components/actions/order-memos-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function formatMemoTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

export function OrderMemoDialog({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [memos, setMemos] = useState<OrderMemoRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open) {
      setMemos([]);
      setError(null);
      setDraft("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchOrderMemos(orderId).then((res) => {
      if (cancelled) return;
      if ("message" in res) {
        setError(res.message);
        setMemos([]);
      } else {
        setMemos(res);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text) {
      toast.warning("메모 내용을 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await addOrderMemo(orderId, text);
      if ("message" in res) {
        toast.error(res.message);
        return;
      }
      setMemos((prev) => [...prev, res]);
      setDraft("");
      toast.success("메모를 등록했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="주문 메모"
          aria-label="주문 메모"
        >
          <MessagesSquare className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>주문 메모</DialogTitle>
          <DialogDescription>
            관리자 메모를 남깁니다. 기존 메모는 삭제·수정할 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 flex flex-col gap-4">
          <div className="min-h-[200px] max-h-[40vh] overflow-y-auto rounded-md border p-3 space-y-3 bg-muted/30">
            {loading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
                <Loader2 className="h-4 w-4 animate-spin" />
                불러오는 중…
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : memos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                등록된 메모가 없습니다.
              </p>
            ) : (
              memos.map((m) => (
                <div
                  key={m.id}
                  className="rounded-md border bg-background p-3 text-sm space-y-1"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{m.user_display}</span>
                    <span>{formatMemoTime(m.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap wrap-break-word">{m.content}</p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`order-memo-${orderId}`}>새 메모</Label>
            <textarea
              id={`order-memo-${orderId}`}
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="메모를 입력하세요…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground text-right">
              {draft.length} / 2000
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            닫기
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                등록 중…
              </>
            ) : (
              "등록"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
