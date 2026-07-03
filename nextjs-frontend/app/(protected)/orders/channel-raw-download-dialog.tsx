"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { OrderListSearch } from "@/components/actions/orders-action";
import { fetchChannelsForExcelSelect, type ChannelOption } from "@/components/actions/orders-excel-action";
import { buildChannelRawDownloadUrl, buildChannelRawPreviewUrl } from "@/lib/orders-raw-export";

type PreviewResponse =
  | { found: false; headers: string[]; row: unknown[]; version_id: string | null }
  | { found: true; headers: string[]; row: unknown[]; version_id: string | null };

const EMPTY = "__empty__";

export function ChannelRawDownloadDialog({
  open,
  onOpenChange,
  search,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: OrderListSearch;
}) {
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelId, setChannelId] = useState<string>(EMPTY);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChannelId(EMPTY);
    setPreview(null);
    setLoadingChannels(true);
    fetchChannelsForExcelSelect()
      .then((list) => setChannels(Array.isArray(list) ? list : []))
      .finally(() => setLoadingChannels(false));
  }, [open]);

  const channelOptions = useMemo(() => channels ?? [], [channels]);

  useEffect(() => {
    if (!open) return;
    if (!channelId || channelId === EMPTY) {
      setPreview(null);
      return;
    }
    const url = buildChannelRawPreviewUrl(search, channelId);

    setLoadingPreview(true);
    setPreview(null);
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `미리보기 실패 (HTTP ${res.status})`);
        }
        return (await res.json()) as PreviewResponse;
      })
      .then((data) => setPreview(data))
      .catch((e) => {
        setPreview(null);
        toast.error(e instanceof Error ? e.message : "미리보기를 불러오지 못했습니다.");
      })
      .finally(() => setLoadingPreview(false));
  }, [open, channelId, search]);

  const canDownload = channelId !== EMPTY && !downloading;

  async function download() {
    if (channelId === EMPTY) {
      toast.warning("채널을 선택해 주세요.");
      return;
    }
    setDownloading(true);
    try {
      const url = buildChannelRawDownloadUrl(search, channelId);
      // Let browser handle file download with content-disposition.
      window.location.href = url;
      toast.success("다운로드를 시작했습니다.");
      onOpenChange(false);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>채널별 다운로드</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>채널</Label>
            <Select
              value={channelId}
              onValueChange={setChannelId}
              disabled={loadingChannels}
            >
              <SelectTrigger className="w-full">
                {loadingChannels ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">로딩 중</span>
                  </div>
                ) : (
                  <SelectValue placeholder="채널 선택" />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={EMPTY}>채널 선택</SelectItem>
                  {channelOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>엑셀 미리보기 (배송 상태 최신 1건 raw)</Label>
            {loadingPreview ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>미리보기를 불러오는 중…</span>
              </div>
            ) : !preview ? (
              <div className="text-sm text-muted-foreground">채널을 선택하면 미리보기가 표시됩니다.</div>
            ) : preview.found === false ? (
              <div className="text-sm text-muted-foreground">
                배송 상태의 주문( raw 포함 )을 찾지 못했습니다.
              </div>
            ) : (
              <div className="max-w-full overflow-x-auto rounded border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      {preview.headers.map((h, i) => (
                        <th
                          key={i}
                          className="border-b px-2 py-1 font-medium "
                        >
                          {h || `(열 ${i + 1})`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {preview.row.map((c, i) => (
                        <td
                          key={i}
                          className="max-w-[min(280px,40vw)] whitespace-pre-wrap border-b px-2 py-1 text-muted-foreground"
                        >
                          {c == null ? "" : String(c)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <Button type="button" onClick={download} disabled={!canDownload}>
            {downloading ? "준비 중…" : "다운로드"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

