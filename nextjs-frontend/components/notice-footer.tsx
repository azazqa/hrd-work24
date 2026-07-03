"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { createNotice, fetchLatestNotice, type NoticeRead } from "@/components/actions/notices-action";
import { MessagesSquare, RotateCcwIcon } from "lucide-react";

function formatNoticeCreatedAt(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NoticeFooter() {
  const [notice, setNotice] = useState<NoticeRead | null>(null);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLatestNotice().then((res) => {
      if (cancelled) return;
      setNotice(res);
      setContent(res?.content ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setContent(notice?.content ?? "");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await createNotice(content);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const latest = await fetchLatestNotice();
      setNotice(latest);
      setOpen(false);
      toast.success("공지사항을 저장했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const latest = await fetchLatestNotice();
      setNotice(latest);
      if (!open) setContent(latest?.content ?? "");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="rounded-md border border-sidebar-border/70 bg-orange-200 p-2 group-data-[collapsible=icon]:hidden">
        <p className="flex items-center justify-between font-semibold text-sidebar-foreground/90">
          <span className="">공지사항</span>
          <span className="">
            {notice?.content?.trim() ? formatNoticeCreatedAt(notice.created_at) : ""}
          </span>
        </p>
        <p className="min-h-48 max-h-72 mt-1 p-1 bg-white rounded-sm overflow-y-auto border border-slate-700 whitespace-pre-wrap text-sidebar-foreground/80">
          {notice?.content?.trim() ? notice.content : "등록된 공지사항이 없습니다."}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 text-xs"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
            >
              <RotateCcwIcon className="h-4 w-4" />
            </Button>
          </div>
          <DialogTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs">
              수정
            </Button>
          </DialogTrigger>
        </div>
      </div>

      {/* Sidebar collapses to icons: show an icon that opens the notice dialog. */}
      <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center py-1">
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            aria-label="공지사항 수정"
            title="공지사항 수정"
          >
            <MessagesSquare className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      </div>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>공지사항 수정</DialogTitle>
          <DialogDescription>
            내용을 수정하고 저장하면 새 공지사항이 생성됩니다.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          maxLength={4000}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="공지 내용을 입력해 주세요."
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

