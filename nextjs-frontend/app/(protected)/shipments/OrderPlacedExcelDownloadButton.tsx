"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrderPlacedExcelDownloadButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  return (
    <Button
      className="text-lg px-4 py-2 bg-accent text-accent-foreground hover:bg-accent/80"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/orders/order-placed-count", {
            cache: "no-store",
          });

          if (!res.ok) {
            toast.error("발주 목록 조회에 실패했습니다.");
            return;
          }

          const json = (await res.json()) as { count: number };
          if (!json.count || json.count < 1) {
            toast.warning("발주 할 주문이 없습니다");
            return;
          }

          const downloadRes = await fetch("/api/shipments/order-placed-excel", {
            method: "GET",
            cache: "no-store",
          });
          if (!downloadRes.ok) {
            let message = "엑셀 다운로드에 실패했습니다.";
            try {
              const err = (await downloadRes.json()) as { detail?: string };
              if (err?.detail) message = err.detail;
            } catch {
              // ignore parse error
            }
            toast.error(message);
            return;
          }

          const blob = await downloadRes.blob();
          const disposition = downloadRes.headers.get("content-disposition") || "";
          const filenameMatch =
            disposition.match(/filename\*=UTF-8''([^;]+)/) ||
            disposition.match(/filename=\"?([^\";]+)\"?/);
          const filename = filenameMatch?.[1]
            ? decodeURIComponent(filenameMatch[1])
            : `order_${Date.now()}.xlsx`;

          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);

          // 다운로드 후 목록 갱신 (ORDER_PLACED -> SHIPPING_WAITING 반영)
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "확인 중..." : "발주서 엑셀 다운로드"}
    </Button>
  );
}

