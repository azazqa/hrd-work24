"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { Pencil } from "lucide-react";

import type { ProductRead } from "@/app/openapi-client";
import type { CategoryRead } from "@/app/openapi-client";
import { categoriesWithDepth } from "@/lib/categories-with-depth";

import { updateProductAction } from "@/components/actions/products-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/ui/submitButton";

const EMPTY_SELECT = "__empty__";
const STATE_OPTIONS = [
  { value: "active", label: "판매중" },
  { value: "inactive", label: "비활성" },
  { value: "discontinued", label: "단종" },
] as const;

const initialState = { message: "" } as const;

export function ProductEditDialog({
  product,
  categories,
}: {
  product: ProductRead;
  categories: CategoryRead[];
}) {
  const [open, setOpen] = useState(false);
  const [state, dispatch] = useActionState(updateProductAction, initialState);
  const [submitted, setSubmitted] = useState(false);

  const [categoryId, setCategoryId] = useState<string>(
    product.category_id ?? EMPTY_SELECT,
  );
  const [productState, setProductState] = useState<string>(product.state ?? "active");
  const [isTax, setIsTax] = useState<boolean>(Boolean(product.is_tax));

  const categoryOptions = useMemo(() => categoriesWithDepth(categories), [categories]);

  useEffect(() => {
    if (!open) {
      setSubmitted(false);
      return;
    }
    // useActionState는 action 호출 결과를 직접 반환하지 않으므로,
    // 제출 후 state가 성공(message === "" && errors 없음)으로 바뀌면 닫는다.
    const hasErrors =
      state != null &&
      typeof state === "object" &&
      "errors" in state &&
      (state as any).errors != null &&
      Object.keys((state as any).errors).length > 0;
    if (submitted && state?.message === "" && !hasErrors) {
      setOpen(false);
      setSubmitted(false);
    }
  }, [open, submitted, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground hover:bg-accent"
          title="수정"
        >
          <Pencil className="w-4 h-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>상품 수정</DialogTitle>
          <DialogDescription>상품 정보를 수정합니다.</DialogDescription>
        </DialogHeader>

        <form
          action={(fd) => {
            setSubmitted(true);
            dispatch(fd);
          }}
          className="space-y-5"
        >
          <input type="hidden" name="product_id" value={product.id} />
          <input
            type="hidden"
            name="category_id"
            value={categoryId === EMPTY_SELECT ? "" : categoryId}
          />
          <input type="hidden" name="state" value={productState} />
          <input type="hidden" name="is_tax" value={isTax ? "on" : ""} />

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor={`product_code_${product.id}`}>상품 코드</Label>
              <Input
                id={`product_code_${product.id}`}
                name="product_code"
                type="text"
                defaultValue={product.product_code ?? ""}
                required
              />
              {state?.errors?.product_code && (
                <p className="text-red-500 text-sm">{state.errors.product_code}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`category_${product.id}`}>카테고리</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full" id={`category_${product.id}`}>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={EMPTY_SELECT}>카테고리 선택</SelectItem>
                    {categoryOptions.map(({ id, name, depth }) => (
                      <SelectItem key={id} value={id}>
                        {"\u00A0".repeat(depth * 2)}
                        {depth > 0 ? "└ " : ""}
                        {name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {state?.errors?.category_id && (
                <p className="text-red-500 text-sm">{state.errors.category_id}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`name_${product.id}`}>상품명</Label>
            <Input
              id={`name_${product.id}`}
              name="name"
              type="text"
              defaultValue={product.name ?? ""}
              required
            />
            {state?.errors?.name && <p className="text-red-500 text-sm">{state.errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor={`price_${product.id}`}>가격</Label>
              <Input
                id={`price_${product.id}`}
                name="price"
                type="number"
                min={0}
                step={1}
                defaultValue={product.price ?? 0}
              />
              {state?.errors?.price && (
                <p className="text-red-500 text-sm">{state.errors.price}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`max_shipping_${product.id}`}>최대 배송 갯수</Label>
              <Input
                id={`max_shipping_${product.id}`}
                name="max_shipping_number"
                type="number"
                min={1}
                step={1}
                defaultValue={product.max_shipping_number ?? ""}
                placeholder="미입력 시 제한 없음"
              />
              {state?.errors?.max_shipping_number && (
                <p className="text-red-500 text-sm">
                  {state.errors.max_shipping_number}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`desc_${product.id}`}>설명</Label>
            <Input
              id={`desc_${product.id}`}
              name="description"
              type="text"
              defaultValue={product.description ?? ""}
              placeholder="상품에 대한 설명 (선택)"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id={`is_tax_${product.id}`}
              checked={isTax}
              onCheckedChange={(checked) => setIsTax(checked === true)}
            />
            <Label htmlFor={`is_tax_${product.id}`} className="cursor-pointer">
              과세
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor={`tax_${product.id}`}>세율 (%)</Label>
              <Input
                id={`tax_${product.id}`}
                name="tax_rate"
                type="number"
                min={0}
                max={100}
                step={1}
                defaultValue={product.tax_rate ?? ""}
                disabled={!isTax}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {state?.errors?.tax_rate && (
                <p className="text-red-500 text-sm">{state.errors.tax_rate}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`state_${product.id}`}>상태</Label>
              <Select value={productState} onValueChange={setProductState}>
                <SelectTrigger className="w-full" id={`state_${product.id}`}>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {STATE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <SubmitButton text="저장" />
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
          </DialogFooter>

          {state?.message && (
            <p className="text-sm text-destructive text-center">{state.message}</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

