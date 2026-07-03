"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ProductSearchStateSelect } from "./product-search-state-select";
import { ProductSearchIsTaxSelect } from "./product-search-is-tax-select";

const inputClass =
  "w-full border-gray-300 dark:border-gray-600";

const TAX_MIN_DEFAULT = "0";
const TAX_MAX_DEFAULT = "100";
const SHIP_MIN_DEFAULT = "0";
const SHIP_MAX_DEFAULT = "12";

const ALL = "__all__";

export type ProductSearchInitial = {
  product_code?: string;
  name?: string;
  description?: string;
  is_tax?: string;
  state?: string;
  tax_rate_min?: string;
  tax_rate_max?: string;
  max_shipping_min?: string;
  max_shipping_max?: string;
};

type FormState = {
  product_code: string;
  name: string;
  description: string;
  is_tax: string;
  state: string;
  tax_rate_min: string;
  tax_rate_max: string;
  max_shipping_min: string;
  max_shipping_max: string;
};

const EMPTY_FORM: FormState = {
  product_code: "",
  name: "",
  description: "",
  is_tax: ALL,
  state: ALL,
  tax_rate_min: TAX_MIN_DEFAULT,
  tax_rate_max: TAX_MAX_DEFAULT,
  max_shipping_min: SHIP_MIN_DEFAULT,
  max_shipping_max: SHIP_MAX_DEFAULT,
};

function fromInitial(i: ProductSearchInitial): FormState {
  return {
    product_code: i.product_code ?? "",
    name: i.name ?? "",
    description: i.description ?? "",
    is_tax:
      i.is_tax === "true" || i.is_tax === "false" ? i.is_tax : ALL,
    state:
      i.state === "active" ||
      i.state === "inactive" ||
      i.state === "discontinued"
        ? i.state
        : ALL,
    tax_rate_min: i.tax_rate_min ?? TAX_MIN_DEFAULT,
    tax_rate_max: i.tax_rate_max ?? TAX_MAX_DEFAULT,
    max_shipping_min: i.max_shipping_min ?? SHIP_MIN_DEFAULT,
    max_shipping_max: i.max_shipping_max ?? SHIP_MAX_DEFAULT,
  };
}

function buildSearchQueryString(form: FormState, size: number): string {
  const q = new URLSearchParams();
  q.set("page", "1");
  q.set("size", String(size));
  if (form.product_code.trim()) q.set("product_code", form.product_code.trim());
  if (form.name.trim()) q.set("name", form.name.trim());
  if (form.description.trim()) q.set("description", form.description.trim());
  if (form.is_tax === "true" || form.is_tax === "false") {
    q.set("is_tax", form.is_tax);
  }
  const tMin = Number(form.tax_rate_min);
  const tMax = Number(form.tax_rate_max);
  if (
    !Number.isNaN(tMin) &&
    !Number.isNaN(tMax) &&
    (tMin !== 0 || tMax !== 100)
  ) {
    q.set("tax_rate_min", form.tax_rate_min);
    q.set("tax_rate_max", form.tax_rate_max);
  }
  const sMin = parseInt(form.max_shipping_min, 10);
  const sMax = parseInt(form.max_shipping_max, 10);
  if (
    !Number.isNaN(sMin) &&
    !Number.isNaN(sMax) &&
    (sMin !== 0 || sMax !== 12)
  ) {
    q.set("max_shipping_min", form.max_shipping_min);
    q.set("max_shipping_max", form.max_shipping_max);
  }
  if (
    form.state === "active" ||
    form.state === "inactive" ||
    form.state === "discontinued"
  ) {
    q.set("state", form.state);
  }
  return q.toString();
}

export function ProductSearchForm({
  initial,
  size,
}: {
  initial: ProductSearchInitial;
  size: number;
}) {
  const router = useRouter();
  const snapshot = JSON.stringify(initial);
  const [form, setForm] = useState<FormState>(() => fromInitial(initial));

  useEffect(() => {
    setForm(fromInitial(initial));
  }, [snapshot]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/products?${buildSearchQueryString(form, size)}`);
  };

  const handleReset = () => {
    setForm({ ...EMPTY_FORM });
    router.push(`/products?page=1&size=${size}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 lg:grid-cols-8 lg:gap-4"
    >
      <div className="lg:col-span-7">
        <FieldGroup>
          <FieldSet>
            <FieldGroup>
              <div className="flex flex-wrap gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field className="w-[150px]">
                  <FieldLabel htmlFor="product_code">상품코드</FieldLabel>
                  <Input
                    id="product_code"
                    type="text"
                    placeholder="부분 일치"
                    value={form.product_code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, product_code: e.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field className="w-[250px]">
                  <FieldLabel htmlFor="name">상품명</FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    placeholder="부분 일치"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field className="w-[250px]">
                  <FieldLabel htmlFor="description">설명</FieldLabel>
                  <Input
                    id="description"
                    type="text"
                    placeholder="부분 일치"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="is_tax">과세</FieldLabel>
                  <ProductSearchIsTaxSelect
                    value={form.is_tax}
                    onValueChange={(v) => setForm((f) => ({ ...f, is_tax: v }))}
                  />
                </Field>
                <Field className="w-[200px]">
                  <FieldLabel htmlFor="tax_rate_min">세율(%)</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      id="tax_rate_min"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      aria-label="세율 최소"
                      value={form.tax_rate_min}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          tax_rate_min: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                    <span className="shrink-0 text-muted-foreground">~</span>
                    <Input
                      id="tax_rate_max"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      aria-label="세율 최대"
                      value={form.tax_rate_max}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          tax_rate_max: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                </Field>
                <Field className="w-[200px]">
                  <FieldLabel htmlFor="max_shipping_min">최대 배송</FieldLabel>
                  <div className="flex items-center gap-x-2">
                    <Input
                      id="max_shipping_min"
                      type="number"
                      min={0}
                      step={1}
                      aria-label="최대 배송 최소"
                      value={form.max_shipping_min}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          max_shipping_min: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                    <span className="shrink-0 text-muted-foreground">~</span>
                    <Input
                      id="max_shipping_max"
                      type="number"
                      min={0}
                      step={1}
                      aria-label="최대 배송 최대"
                      value={form.max_shipping_max}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          max_shipping_max: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="state">상태</FieldLabel>
                  <ProductSearchStateSelect
                    value={form.state}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, state: v }))
                    }
                  />
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        </FieldGroup>
      </div>

      <Field
        orientation="horizontal"
        className="items-end gap-2 lg:col-span-1"
      >
        <Button
          type="button"
          variant="outline"
          className="min-w-0 flex-1"
          onClick={handleReset}
        >
          초기화
        </Button>
        <Button type="submit" className="min-w-0 flex-1">
          검색
        </Button>
      </Field>
    </form>
  );
}
