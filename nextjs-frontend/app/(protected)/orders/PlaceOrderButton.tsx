"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlaceOrderPreviewDialog } from "./PlaceOrderPreviewDialog";
import type { OrderListRead } from "@/app/openapi-client/types.gen";
import { fetchOrdersByStatus } from "@/components/actions/orders-action";
import type { PageOrderListRead } from "@/app/openapi-client";
import { toast } from "sonner";

export function PlaceOrderButton() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [orders, setOrders] = useState<OrderListRead[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="default"
        className="text-lg px-4 py-2 bg-accent text-accent-foreground hover:bg-accent/80"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const first = await fetchOrdersByStatus(1, 10, "order", {
              sort_by: "receiver_name",
              sort_dir: "asc",
            });
            if ("message" in (first as any)) {
              toast.error("주문을 불러오지 못했습니다.");
              return;
            }
            const page = first as PageOrderListRead;
            const totalCount = page.total ?? 0;
            if (totalCount === 0) {
              toast.warning("발주 할 주문이 없습니다");
              return;
            }
            setOrders((page.items ?? []) as OrderListRead[]);
            setTotal(totalCount);
            setPageSize(page.size ?? 10);
            setPreviewOpen(true);
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "불러오는 중..." : "발주하기"}
      </Button>
      <PlaceOrderPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        orders={orders}
        total={total}
        pageSize={pageSize}
      />
    </>
  );
}
