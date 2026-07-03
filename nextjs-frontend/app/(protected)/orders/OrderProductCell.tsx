"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OrderListRead, OrderItemListRead, ProductSummary } from "@/app/openapi-client/types.gen";

function productLabel(order: OrderListRead): string {
  const items = order.items ?? [];
  if (items.length === 0) return "-";
  if (items.length === 1) return order.mall_product_name ?? items[0]?.product?.name ?? "상품 1개";
  return order.mall_product_name
    ? `${order.mall_product_name} 외 ${items.length - 1}건`
    : `상품 ${items.length}개`;
}

export function OrderProductCell({ order }: { order: OrderListRead }) {
  const [openItems, setOpenItems] = useState(false);
  const [productDetail, setProductDetail] = useState<ProductSummary | null>(null);
  const items = order.items ?? [];

  if (items.length === 0) {
    return <span className="text-center">-</span>;
  }

  return (
    <>
      <Button
        variant="link"
        className="max-w-[200px] h-auto p-0 text-left font-normal text-foreground underline-offset-4 hover:underline whitespace-normal wrap-break-word"
        onClick={() => setOpenItems(true)}
      >
        {productLabel(order)}
      </Button>

      <Dialog open={openItems} onOpenChange={setOpenItems}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>주문 상품 목록</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2">
            {items.map((item: OrderItemListRead, idx: number) => {
              const name = item.product?.name ?? `[${item.product?.product_code ?? item.product_id}]`;
              return (
                <li key={`${item.product_id}-${idx}`} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                  <Button
                    variant="link"
                    className="h-auto p-0 text-left font-normal text-foreground underline-offset-4 hover:underline"
                    onClick={() => item.product && setProductDetail(item.product)}
                  >
                    {name}
                  </Button>
                  <span className="text-muted-foreground shrink-0">수량: {item.quantity}</span>
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                닫기
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!productDetail} onOpenChange={(open) => !open && setProductDetail(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>상품 정보</DialogTitle>
          </DialogHeader>
          {productDetail && (
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">상품코드</dt>
                <dd className="">{productDetail.product_code}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">상품명</dt>
                <dd>{productDetail.name}</dd>
              </div>
              {productDetail.description && (
                <div>
                  <dt className="text-muted-foreground">설명</dt>
                  <dd className="text-muted-foreground">{productDetail.description}</dd>
                </div>
              )}
              {productDetail.category_name != null && (
                <div>
                  <dt className="text-muted-foreground">카테고리</dt>
                  <dd>{productDetail.category_name}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">과세여부</dt>
                <dd>{productDetail.is_tax ? "과세" : "비과세"}</dd>
              </div>
              {productDetail.tax_rate != null && productDetail.is_tax && (
                <div>
                  <dt className="text-muted-foreground">세율</dt>
                  <dd>{productDetail.tax_rate}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">최대 배송 갯수</dt>
                <dd>{productDetail.max_shipping_number ?? "제한 없음"}</dd>
              </div>
              {productDetail.state != null && (
                <div>
                  <dt className="text-muted-foreground">상품상태</dt>
                  <dd>
                    {productDetail.state === "active"
                      ? "판매중"
                      : productDetail.state === "inactive"
                        ? "비활성"
                        : productDetail.state === "discontinued"
                          ? "단종"
                          : productDetail.state}
                  </dd>
                </div>
              )}
            </dl>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                닫기
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
