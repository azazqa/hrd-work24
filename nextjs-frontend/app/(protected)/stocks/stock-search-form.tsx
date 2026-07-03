"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  categoriesWithDepth,
  type CategoryTreeNode,
} from "@/lib/categories-with-depth";

const ALL = "__all__";

type FormState = {
  product_query: string;
  logistics_location_name: string;
  product_barcode: string;
  batch_code: string;
  memo: string;
  condition: string;
  category_id: string;
};

export type StockSearchInitial = Partial<FormState>;

function fromInitial(initial: StockSearchInitial): FormState {
  return {
    product_query: initial.product_query ?? "",
    logistics_location_name: initial.logistics_location_name ?? "",
    product_barcode: initial.product_barcode ?? "",
    batch_code: initial.batch_code ?? "",
    memo: initial.memo ?? "",
    condition: initial.condition ?? "",
    category_id: initial.category_id ?? "",
  };
}

function buildSearchQueryString(form: FormState, size: number): string {
  const q = new URLSearchParams();
  q.set("page", "1");
  q.set("size", String(size));

  if (form.product_query.trim()) q.set("product_query", form.product_query.trim());
  if (form.logistics_location_name.trim())
    q.set("logistics_location_name", form.logistics_location_name.trim());
  if (form.product_barcode.trim()) q.set("product_barcode", form.product_barcode.trim());
  if (form.batch_code.trim()) q.set("batch_code", form.batch_code.trim());
  if (form.memo.trim()) q.set("memo", form.memo.trim());
  if (form.condition.trim()) q.set("condition", form.condition.trim());
  if (form.category_id.trim()) q.set("category_id", form.category_id.trim());

  return q.toString();
}

const CONDITION_OPTIONS: { value: string; label: string }[] = [
  { value: "normal", label: "정상" },
  { value: "refurb", label: "리퍼" },
  { value: "disposal", label: "폐기" },
  { value: "undecided", label: "미정" },
];

export function StockSearchForm({
  initial,
  size,
  logisticsLocations,
  categories,
  products,
}: {
  initial: StockSearchInitial;
  size: number;
  logisticsLocations: Array<{ id: string; name: string }>;
  categories: CategoryTreeNode[];
  products: Array<{ id: string; name: string; code?: string }>;
}) {
  const router = useRouter();
  const snapshot = JSON.stringify(initial);
  const [form, setForm] = useState<FormState>(() => fromInitial(initial));
  const productAnchor = useComboboxAnchor();

  const filteredProducts = useMemo(() => {
    const q = (form.product_query ?? "").trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const code = (p.code ?? "").toLowerCase();
      const name = (p.name ?? "").toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [form.product_query, products]);

  const locationNameSet = useMemo(
    () => new Set((logisticsLocations ?? []).map((l) => l.name)),
    [logisticsLocations],
  );

  const categoryIdSet = useMemo(
    () => new Set((categories ?? []).map((c) => c.id)),
    [categories],
  );

  useEffect(() => {
    setForm(fromInitial(initial));
  }, [snapshot]);

  useEffect(() => {
    const current = form.logistics_location_name?.trim();
    if (!current) return;
    if (!locationNameSet.has(current)) {
      setForm((p) => ({ ...p, logistics_location_name: "" }));
    }
  }, [form.logistics_location_name, locationNameSet]);

  useEffect(() => {
    const current = form.category_id?.trim();
    if (!current) return;
    if (!categoryIdSet.has(current)) {
      setForm((p) => ({ ...p, category_id: "" }));
    }
  }, [form.category_id, categoryIdSet]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/stocks?${buildSearchQueryString(form, size)}`);
  };

  const handleReset = () => {
    setForm({
      product_query: "",
      logistics_location_name: "",
      product_barcode: "",
      batch_code: "",
      memo: "",
      condition: "",
      category_id: "",
    });
    router.push(`/stocks?page=1&size=${size}`);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-8">
      <div className="lg:col-span-7">
        <FieldGroup>
          <FieldSet>
            <FieldGroup>
              <div className="flex flex-wrap gap-4">
                <Field className="w-[200px]">
                  <FieldLabel htmlFor="condition">상품 상태</FieldLabel>
                  <Select
                    value={form.condition || ALL}
                    onValueChange={(v) =>
                      setForm((prev) => ({
                        ...prev,
                        condition: v === ALL ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger id="condition" className="w-full">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>전체</SelectItem>
                      {CONDITION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="min-w-[260px] max-w-[320px]">
                  <FieldLabel htmlFor="category_id">상품 카테고리</FieldLabel>
                  <Select
                    value={form.category_id || ALL}
                    onValueChange={(v) =>
                      setForm((prev) => ({
                        ...prev,
                        category_id: v === ALL ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger id="category_id" className="w-full">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(24rem,70vh)]">
                      <SelectGroup>
                        <SelectItem value={ALL}>전체</SelectItem>
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
                </Field>
                <Field className="w-[260px]">
                  <FieldLabel htmlFor="product_query">상품 (코드/이름)</FieldLabel>
                  <div ref={productAnchor}>
                    <Combobox>
                      <ComboboxInput
                        placeholder="부분 일치"
                        value={form.product_query}
                        onChange={(e) => {
                          const v = e.currentTarget.value;
                          setForm((prev) => ({
                            ...prev,
                            product_query: v,
                          }));
                        }}
                        showClear
                      />
                      <ComboboxContent anchor={productAnchor}>
                        <ComboboxList>
                          <ComboboxEmpty>검색 결과가 없습니다.</ComboboxEmpty>
                          <ComboboxItem
                            value="__all__"
                            onClick={() =>
                              setForm((p) => ({
                                ...p,
                                product_query: "",
                              }))
                            }
                          >
                            전체
                          </ComboboxItem>
                          {filteredProducts.map((p) => {
                            const label = p.code ? `[${p.code}] ${p.name}` : p.name;
                            return (
                              <ComboboxItem
                                key={p.id}
                                value={label}
                                onClick={() =>
                                  // 표시/검색 편의: 선택 시 상품명으로 채움 (코드는 직접 입력으로도 검색 가능)
                                  setForm((prev) => ({ ...prev, product_query: p.name }))
                                }
                              >
                                {label}
                              </ComboboxItem>
                            );
                          })}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>
                </Field>
                <Field className="w-[240px]">
                  <FieldLabel htmlFor="logistics_location_name">물류지</FieldLabel>
                  <Select
                    value={form.logistics_location_name || ALL}
                    onValueChange={(v) =>
                      setForm((prev) => ({
                        ...prev,
                        logistics_location_name: v === ALL ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger id="logistics_location_name" className="w-full">
                      <SelectValue placeholder="물류지 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>전체</SelectItem>
                      {logisticsLocations.map((l) => (
                        <SelectItem key={l.id} value={l.name}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="w-[210px]">
                  <FieldLabel htmlFor="product_barcode">상품바코드</FieldLabel>
                  <Input
                    id="product_barcode"
                    placeholder="부분 일치"
                    value={form.product_barcode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        product_barcode: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field className="w-[200px]">
                  <FieldLabel htmlFor="batch_code">배치코드</FieldLabel>
                  <Input
                    id="batch_code"
                    placeholder="부분 일치"
                    value={form.batch_code}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, batch_code: e.target.value }))
                    }
                  />
                </Field>
                <Field className="w-[240px]">
                  <FieldLabel htmlFor="memo">비고</FieldLabel>
                  <Input
                    id="memo"
                    placeholder="부분 일치"
                    value={form.memo}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, memo: e.target.value }))
                    }
                  />
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        </FieldGroup>
      </div>

      <Field orientation="horizontal" className="items-end gap-2 lg:col-span-1">
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

