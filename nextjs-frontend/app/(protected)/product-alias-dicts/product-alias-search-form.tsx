"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/multi-select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";

type FormState = {
  product_name: string;
  alias: string;
  channel_ids: string[];
};

export type ProductAliasSearchInitial = Omit<Partial<FormState>, "channel_ids"> & {
  channel_ids?: string | string[];
};

function fromInitial(initial: ProductAliasSearchInitial): FormState {
  return {
    product_name: initial.product_name ?? "",
    alias: initial.alias ?? "",
    channel_ids: (() => {
      const raw = (initial as any).channel_ids;
      if (typeof raw === "string" && raw.trim()) {
        return raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return Array.isArray(raw) ? raw.map((s) => String(s).trim()).filter(Boolean) : [];
    })(),
  };
}

function buildSearchQueryString(form: FormState, size: number): string {
  const q = new URLSearchParams();
  q.set("page", "1");
  q.set("size", String(size));
  if (form.channel_ids.length > 0) q.set("channel_ids", form.channel_ids.join(","));
  if (form.product_name.trim()) q.set("product_name", form.product_name.trim());
  if (form.alias.trim()) q.set("alias", form.alias.trim());
  return q.toString();
}

export function ProductAliasSearchForm({
  initial,
  size,
  channels,
  aliasOptions,
  productNameOptions,
}: {
  initial: ProductAliasSearchInitial;
  size: number;
  channels: Array<{ id: string; name: string }>;
  aliasOptions: string[];
  productNameOptions: string[];
}) {
  const router = useRouter();
  const snapshot = JSON.stringify(initial);
  const [form, setForm] = useState<FormState>(() => fromInitial(initial));
  const aliasAnchor = useComboboxAnchor();
  const productAnchor = useComboboxAnchor();

  useEffect(() => {
    setForm(fromInitial(initial));
  }, [snapshot]);

  const filteredAliasOptions = useMemo(() => {
    const q = (form.alias ?? "").trim().toLowerCase();
    if (!q) return aliasOptions;
    return aliasOptions.filter((s) => s.toLowerCase().includes(q));
  }, [aliasOptions, form.alias]);
  const filteredProductNameOptions = useMemo(() => {
    const q = (form.product_name ?? "").trim().toLowerCase();
    if (!q) return productNameOptions;
    return productNameOptions.filter((s) => s.toLowerCase().includes(q));
  }, [productNameOptions, form.product_name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/product-alias-dicts?${buildSearchQueryString(form, size)}`);
  };

  const handleReset = () => {
    setForm({ product_name: "", alias: "", channel_ids: [] });
    router.push(`/product-alias-dicts?page=1&size=${size}`);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-8">
      <div className="lg:col-span-7">
        <FieldGroup>
          <FieldSet>
            <FieldGroup>
              <div className="flex flex-wrap gap-4">
                <Field className="w-[220px]">
                  <FieldLabel htmlFor="channel_ids">채널</FieldLabel>
                  <MultiSelect
                    options={channels.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="전체"
                    searchPlaceholder="채널 검색"
                    defaultValue={form.channel_ids}
                    hideSelectAll
                    onValueChange={(values) =>
                      setForm((prev) => ({
                        ...prev,
                        channel_ids: values,
                      }))
                    }
                    className="w-full"
                  />
                </Field>
                <Field className="flex-1">
                  <FieldLabel htmlFor="alias">별칭</FieldLabel>
                  <Combobox>
                    <div ref={aliasAnchor}>
                      <ComboboxInput
                        placeholder="부분 일치"
                        value={form.alias}
                        onChange={(e) => {
                          const v = e.currentTarget.value;
                          setForm((prev) => ({ ...prev, alias: v }));
                        }}
                        showClear
                      />
                    </div>
                    <ComboboxContent anchor={aliasAnchor}>
                      <ComboboxList>
                        <ComboboxEmpty>검색 결과가 없습니다.</ComboboxEmpty>
                        <ComboboxItem
                          value="__all__"
                          onClick={() => setForm((p) => ({ ...p, alias: "" }))}
                        >
                          전체
                        </ComboboxItem>
                        {filteredAliasOptions.map((a) => (
                          <ComboboxItem
                            key={a}
                            value={a}
                            onClick={() => setForm((p) => ({ ...p, alias: a }))}
                          >
                            {a}
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </Field>
                <Field className="w-[450px]">
                  <FieldLabel htmlFor="product_name">상품명</FieldLabel>
                  <Combobox>
                    <div ref={productAnchor}>
                      <ComboboxInput
                        placeholder="부분 일치"
                        value={form.product_name}
                        onChange={(e) => {
                          const v = e.currentTarget.value;
                          setForm((prev) => ({ ...prev, product_name: v }));
                        }}
                        showClear
                      />
                    </div>
                    <ComboboxContent anchor={productAnchor}>
                      <ComboboxList>
                        <ComboboxEmpty>검색 결과가 없습니다.</ComboboxEmpty>
                        <ComboboxItem
                          value="__all__"
                          onClick={() => setForm((p) => ({ ...p, product_name: "" }))}
                        >
                          전체
                        </ComboboxItem>
                        {filteredProductNameOptions.map((n) => (
                          <ComboboxItem
                            key={n}
                            value={n}
                            onClick={() => setForm((p) => ({ ...p, product_name: n }))}
                          >
                            {n}
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        </FieldGroup>
      </div>
      <Field orientation="horizontal" className="items-end gap-2 lg:col-span-1">
        <Button type="button" variant="outline" className="min-w-0 flex-1" onClick={handleReset}>
          초기화
        </Button>
        <Button type="submit" className="min-w-0 flex-1">
          검색
        </Button>
      </Field>
    </form>
  );
}
