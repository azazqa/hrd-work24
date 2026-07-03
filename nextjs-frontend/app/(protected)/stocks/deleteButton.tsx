"use client";

import { useState } from "react";
import { removeStock } from "@/components/actions/stocks-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import type { StockListRead } from "@/app/openapi-client";

interface StockDeleteButtonProps {
  stock: StockListRead;
}

export function StockDeleteButton({ stock }: StockDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    const result = await removeStock(stock.id, reason.trim() || undefined);
    setLoading(false);
    if (result?.message) {
      setError(typeof result.message === "string" ? result.message : String(result.message));
    } else {
      setOpen(false);
      setReason("");
    }
  };

  const productLabel = stock.product
    ? `[${stock.product.product_code}] ${stock.product.name}`
    : "-";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground text-gray-700 hover:text-gray-500 hover:bg-accent"
        onClick={() => setOpen(true)}
        title="삭제"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>재고 삭제</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>삭제할 재고 정보</Label>
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                <p className="font-medium">{productLabel}</p>
                <p className="text-muted-foreground">
                  수량: {stock.quantity ?? 0} · 배치: {stock.batch_code ?? "-"} · 물류지:{" "}
                  {stock.logistics_location?.name ?? "-"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-reason">사유 (선택)</Label>
              <Input
                id="delete-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="삭제 사유"
                maxLength={500}
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
