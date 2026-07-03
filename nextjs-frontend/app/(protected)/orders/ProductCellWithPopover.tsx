"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ProductSummary } from "@/app/openapi-client";

const STATE_LABEL: Record<string, string> = {
  active: "판매중",
  inactive: "비활성",
  discontinued: "단종",
};

interface ProductCellWithPopoverProps {
  product: ProductSummary | null | undefined;
  productId: string;
  /** true면 트리거에는 상품명만 표시(코드는 다이얼로그에서 확인) */
  hideProductCodeInTrigger?: boolean;
}

export function ProductCellWithPopover({
  product,
  productId,
  hideProductCodeInTrigger = false,
}: ProductCellWithPopoverProps) {
  if (!product) {
    return (
      <span className=" text-xs text-gray-500">
        {productId}
      </span>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-start p-0 font-medium text-left underline hover:bg-transparent"
        >
          {hideProductCodeInTrigger
            ? product.name
            : `[${product.product_code}] ${product.name}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md border border-black bg-[#f7f7f7]">
        <div className="relative">
          <DialogHeader>
            <DialogTitle>상품 정보</DialogTitle>
          </DialogHeader>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-8 w-8 rounded-full text-lg leading-none"
              aria-label="닫기"
            >
              ×
            </Button>
          </DialogClose>
        </div>
        <div className="grid gap-3 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">상품코드</span>
            <p className=" font-medium">{product.product_code}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">카테고리</span>
            <p className="font-medium">
              {(() => {
                const leaf = product.category_name?.trim();
                if (!leaf) return "-";
                const p = product.parent_category_name?.trim();
                return p ? `${p} > ${leaf}` : leaf;
              })()}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">상품명</span>
            <p className="font-medium">{product.name}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">설명</span>
            <p className="text-gray-700 dark:text-gray-300 wrap-break-word">
              {product.description != null && product.description !== ""
                ? product.description
                : "-"}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">과세여부</span>
            <p className="font-medium">{product.is_tax ? "과세" : "비과세"}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">세율</span>
            <p className="font-medium">
              {product.tax_rate != null && product.tax_rate !== ""
                ? `${Number(product.tax_rate)}%`
                : "-"}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">상태</span>
            <p className="font-medium">
              {product.state ? STATE_LABEL[product.state] ?? product.state : "-"}
            </p>
          </div>
        </div>
        <DialogFooter className="flex justify-center sm:justify-center">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              닫기
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
