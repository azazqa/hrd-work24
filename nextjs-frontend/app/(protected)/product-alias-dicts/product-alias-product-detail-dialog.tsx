"use client";

import { useEffect, useState } from "react";
import type { ProductRead } from "@/app/openapi-client";
import { fetchProductById } from "@/components/actions/products-action";
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

const stateLabel: Record<string, string> = {
  active: "판매중",
  inactive: "비활성",
  discontinued: "단종",
};

export function ProductAliasProductDetailDialog({
  productId,
  label,
}: {
  productId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<ProductRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setProduct(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchProductById(productId).then((res) => {
      if (cancelled) return;
      if ("message" in res) {
        setError(res.message);
        setProduct(null);
      } else {
        setProduct(res);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="font-medium text-primary underline-offset-4 hover:underline text-left"
        >
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>상품 정보</DialogTitle>
          <DialogDescription>
            별칭에 연결된 상품의 상세 정보입니다.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : product ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr] sm:gap-x-4 sm:gap-y-2">
            <dt className="text-muted-foreground">상품코드</dt>
            <dd className="">{product.product_code}</dd>
            <dt className="text-muted-foreground">상품명</dt>
            <dd className="font-medium">{product.name}</dd>
            <dt className="text-muted-foreground">가격</dt>
            <dd>{product.price != null ? product.price : 0}</dd>
            <dt className="text-muted-foreground">설명</dt>
            <dd className="wrap-break-word">
              {product.description?.trim() ? product.description : "—"}
            </dd>
            <dt className="text-muted-foreground">과세</dt>
            <dd>{product.is_tax ? "과세" : "비과세"}</dd>
            <dt className="text-muted-foreground">세율</dt>
            <dd>
              {product.tax_rate != null ? `${product.tax_rate}%` : "—"}
            </dd>
            <dt className="text-muted-foreground">최대 배송</dt>
            <dd>
              {product.max_shipping_number != null
                ? product.max_shipping_number
                : "—"}
            </dd>
            <dt className="text-muted-foreground">상태</dt>
            <dd>
              {stateLabel[product.state ?? "active"] ?? product.state ?? "—"}
            </dd>
            <dt className="text-muted-foreground">상품 ID</dt>
            <dd className=" text-xs break-all">{product.id}</dd>
          </dl>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
