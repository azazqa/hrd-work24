"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UploadResult = {
  updated_shipments?: number;
  missing_shipments?: string[];
  inventory_warnings?: string[];
  message?: string;
  detail?: string;
};

type Me = {
  id: string;
  email: string | null;
  is_superuser: boolean;
  logistics_location_id: string | null;
  logistics_location_name: string | null;
};

type LogisticsLocationItem = { id: string; name: string };
type LogisticsLocationPage = { items?: LogisticsLocationItem[] };

export function InvoiceExcelUploadButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LogisticsLocationItem[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  const fileName = useMemo(() => file?.name ?? "", [file]);

  const isSuperuser = Boolean(me?.is_superuser);
  const myLocationId = me?.logistics_location_id ?? "";
  const myLocationName = me?.logistics_location_name ?? "";

  const chosenLocationId = isSuperuser ? locationId : myLocationId;

  const uploadDisabledReason = useMemo(() => {
    if (loading) return "업로드 중입니다.";
    if (!file) return "엑셀 파일을 선택해주세요.";
    if (meError) return meError;
    if (!me) return "사용자 정보를 불러오는 중입니다.";
    if (!chosenLocationId) return "출고지를 선택/설정해주세요.";
    return null;
  }, [chosenLocationId, file, loading, me, meError]);

  useEffect(() => {
    // Prefetch user info early so the trigger button state is correct.
    let cancelled = false;
    void (async () => {
      try {
        setMeError(null);
        const res = await fetch("/api/users/me", { cache: "no-store" });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Failed to load user (HTTP ${res.status})`);
        }
        const data = (await res.json()) as Me;
        if (!cancelled) setMe(data);
      } catch (e) {
        if (!cancelled) setMeError("사용자 정보를 불러오지 못했습니다.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!me) return;
    if (!me.is_superuser) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/logistics-locations?page=1&size=100", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as LogisticsLocationPage;
        const items = Array.isArray(data.items) ? data.items : [];
        if (cancelled) return;
        setLocations(
          items
            .map((it) => ({ id: String(it.id), name: String(it.name ?? "") }))
            .filter((it) => it.id && it.name),
        );
      } catch {
        // ignore: superuser can still upload if already selected / cached
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, me]);

  useEffect(() => {
    if (!open) return;
    if (!me) return;
    if (!me.is_superuser) return;
    if (locationId) return;
    if (me.logistics_location_id) setLocationId(me.logistics_location_id);
  }, [open, me, locationId]);

  async function onUpload() {
    if (uploadDisabledReason) {
      toast.warning(uploadDisabledReason);
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      if (!file) {
        toast.warning("엑셀 파일을 선택해주세요.");
        return;
      }
      fd.append("file", file);
      fd.append("logistics_location_id", chosenLocationId);

      const res = await fetch("/api/shipments/invoices/upload", {
        method: "POST",
        body: fd,
      });

      const json = (await res.json().catch(() => ({}))) as UploadResult;

      if (!res.ok) {
        toast.error(json.detail || json.message || "업로드에 실패했습니다.");
        return;
      }

      const updated = Number(json.updated_shipments ?? 0);
      const missing = Array.isArray(json.missing_shipments) ? json.missing_shipments : [];
      const inventoryWarnings = Array.isArray(json.inventory_warnings)
        ? json.inventory_warnings
        : [];

      if (updated < 1) {
        toast.warning("해당되는 주문이 없습니다.");
        return;
      }

      if (missing.length > 0) {
        toast.warning(`미매칭 고객주문번호: ${missing.length}건`);
      }

      if (inventoryWarnings.length > 0) {
        // 너무 길어지지 않게 개수+첫 메시지만 표시
        const first = inventoryWarnings[0];
        toast.warning(
          inventoryWarnings.length > 1
            ? `재고 경고: ${inventoryWarnings.length}건 (예: ${first})`
            : `재고 경고: ${first}`,
        );
      }

      toast.success(`송장 ${updated}건 업로드 완료`);
      setOpen(false);
      setFile(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="text-lg px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/80"
          disabled={Boolean(me && !me.is_superuser && !myLocationId)}
        >
          송장 업로드
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>송장 업로드</DialogTitle>
          <DialogDescription>
            엑셀의 <b>고객주문번호(E)</b>는 <b>shipment.id</b>, <b>운송장번호(K)</b>는
            invoice_number로 반영됩니다. 매칭된 주문 상태는 <b>배송</b>으로 변경됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label>출고지</Label>
            {!me ? (
              <div className="text-sm text-muted-foreground">불러오는 중...</div>
            ) : me.is_superuser ? (
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="출고지를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm">
                {myLocationName ? (
                  <span className="font-medium">{myLocationName}</span>
                ) : (
                  <span className="text-red-600">담당 출고지가 설정되지 않았습니다.</span>
                )}
              </div>
            )}
            {meError ? <div className="text-sm text-red-600">{meError}</div> : null}
            {!me?.is_superuser && !myLocationId ? (
              <div className="text-sm text-red-600">
                담당 출고지가 없으면 송장 업로드를 할 수 없습니다. 관리자에게 담당 출고지 설정을 요청하세요.
              </div>
            ) : null}
          </div>

          <Input
            type="file"
            accept=".xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {fileName ? <p className="text-sm text-muted-foreground">{fileName}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            닫기
          </Button>
          <Button onClick={onUpload} disabled={Boolean(uploadDisabledReason)}>
            {loading ? "업로드 중..." : "업로드"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

