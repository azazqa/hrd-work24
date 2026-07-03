"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { addProduct } from "@/components/actions/products-action";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submitButton";
import Link from "next/link";
import {
  categoriesWithDepth,
  type CategoryTreeNode,
} from "@/lib/categories-with-depth";

type CategoryOption = CategoryTreeNode;

interface ProductFormProps {
  categories: CategoryOption[];
}

const initialState = { message: "" };
const EMPTY_SELECT = "__empty__";
const STATE_OPTIONS = [
  { value: "active", label: "판매중" },
  { value: "inactive", label: "비활성" },
  { value: "discontinued", label: "단종" },
] as const;

export function ProductForm({ categories }: ProductFormProps) {
  const [state, dispatch] = useActionState(addProduct, initialState);
  const [categoryId, setCategoryId] = useState<string>(EMPTY_SELECT);
  const [productState, setProductState] = useState<string>("active");
  const [isTax, setIsTax] = useState<boolean>(false);

  return (
    <form
      action={dispatch}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6"
    >
      <input
        type="hidden"
        name="category_id"
        value={categoryId === EMPTY_SELECT ? "" : categoryId}
      />
      <input type="hidden" name="state" value={productState} />
      <input type="hidden" name="is_tax" value={isTax ? "on" : ""} />
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label
              htmlFor="product_code"
              className="text-gray-700 dark:text-gray-300"
            >
              상품 코드<span className="relative -top-1 text-sm text-red-500">*</span>
            </Label>
            <Input
              id="product_code"
              name="product_code"
              type="text"
              placeholder="예: P-0001"
              required
              className="w-full border-gray-300 dark:border-gray-600"
            />
            {state.errors?.product_code && (
              <p className="text-red-500 text-sm">
                {state.errors.product_code}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label
              htmlFor="category_id"
              className="text-gray-700 dark:text-gray-300"
            >
              카테고리<span className="relative -top-1 text-sm text-red-500">*</span>
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="카테고리 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={EMPTY_SELECT}>카테고리 선택</SelectItem>
                  {categoriesWithDepth(categories).map(({ id, name, depth }) => (
                    <SelectItem key={id} value={id}>
                      {"\u00A0".repeat(depth * 2)}
                      {depth > 0 ? "└ " : ""}
                      {name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {state.errors?.category_id && (
              <p className="text-red-500 text-sm">
                {state.errors.category_id}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">
            상품명<span className="relative -top-1 text-sm text-red-500">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="상품명을 입력해주세요"
            required
            className="w-full border-gray-300 dark:border-gray-600"
          />
          {state.errors?.name && (
            <p className="text-red-500 text-sm">{state.errors.name}</p>
          )}
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="description"
            className="text-gray-700 dark:text-gray-300"
          >
            설명
          </Label>
          <Input
            id="description"
            name="description"
            type="text"
            placeholder="상품에 대한 설명 (선택)"
            className="w-full border-gray-300 dark:border-gray-600"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="price" className="text-gray-700 dark:text-gray-300">
            가격
          </Label>
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step={1}
            placeholder="예: 12900"
            defaultValue={0}
            className="w-full border-gray-300 dark:border-gray-600"
          />
          {state.errors?.price && (
            <p className="text-red-500 text-sm">{state.errors.price}</p>
          )}
        </div>

        <div className="flex items-center gap-2 space-y-0">
          <Checkbox
            id="is_tax"
            checked={isTax}
            onCheckedChange={(checked) => setIsTax(checked === true)}
          />
          <Label
            htmlFor="is_tax"
            className="text-gray-700 dark:text-gray-300 cursor-pointer"
          >
            과세
          </Label>
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="tax_rate"
            className="text-gray-700 dark:text-gray-300"
          >
            세율 (%)
          </Label>
          <Input
            id="tax_rate"
            name="tax_rate"
            type="number"
            min={0}
            max={100}
            step={0.01}
            placeholder="0"
            disabled={!isTax}
            className="w-full border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {state.errors?.tax_rate && (
            <p className="text-red-500 text-sm">{state.errors.tax_rate}</p>
          )}
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="max_shipping_number"
            className="text-gray-700 dark:text-gray-300"
          >
            최대 배송 갯수
          </Label>
          <Input
            id="max_shipping_number"
            name="max_shipping_number"
            type="number"
            min={1}
            step={1}
            placeholder="예: 12 (미입력 시 제한 없음)"
            className="w-full border-gray-300 dark:border-gray-600"
          />
          {state.errors?.max_shipping_number && (
            <p className="text-red-500 text-sm">{state.errors.max_shipping_number}</p>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="state" className="text-gray-700 dark:text-gray-300">
            상태
          </Label>
          <Select value={productState} onValueChange={setProductState}>
            <SelectTrigger className="w-full">
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

      <div className="flex gap-3">
        <SubmitButton text="등록" />
        <Link href="/products" className="w-full">
          <Button variant="outline" type="button" className="w-full">
            취소
          </Button>
        </Link>
      </div>

      {state?.message && (
        <div className="mt-2 text-center text-sm text-red-500">
          <p>{state.message}</p>
        </div>
      )}
    </form>
  );
}
