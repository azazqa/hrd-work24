"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

const ACTION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "inbound", label: "입고" },
  { value: "restock", label: "재입고" },
  { value: "outbound", label: "출고" },
  { value: "condition_change", label: "상태 변경" },
  { value: "transfer", label: "물류지 이동" },
  { value: "admin_edit", label: "관리자 수정" },
  { value: "deleted", label: "삭제" },
];

type FormState = {
  product_query: string;
  batch_code: string;
  reason: string;
  action_type: string;
};

export type StockHistorySearchInitial = Partial<FormState>;

function fromInitial(initial: StockHistorySearchInitial): FormState {
  return {
    product_query: initial.product_query ?? "",
    batch_code: initial.batch_code ?? "",
    reason: initial.reason ?? "",
    action_type: initial.action_type ?? "",
  };
}

export function StockHistorySearchForm({
  initial,
  size,
}: {
  initial: StockHistorySearchInitial;
  size: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const snapshot = JSON.stringify(initial);
  const [form, setForm] = useState<FormState>(() => fromInitial(initial));

  useEffect(() => {
    setForm(fromInitial(initial));
  }, [snapshot]);

  function submit() {
    const p = new URLSearchParams(searchParams.toString());
    p.set("page", "1");
    p.set("size", String(size));

    if (form.product_query.trim()) {
      p.set("product_query", form.product_query.trim());
    } else {
      p.delete("product_query");
    }
    if (form.batch_code.trim()) {
      p.set("batch_code", form.batch_code.trim());
    } else {
      p.delete("batch_code");
    }
    if (form.reason.trim()) {
      p.set("reason", form.reason.trim());
    } else {
      p.delete("reason");
    }
    if (form.action_type.trim()) {
      p.set("action_type", form.action_type.trim());
    } else {
      p.delete("action_type");
    }

    const q = p.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  function reset() {
    setForm({
      product_query: "",
      batch_code: "",
      reason: "",
      action_type: "",
    });
    const p = new URLSearchParams(searchParams.toString());
    p.set("page", "1");
    p.set("size", String(size));
    p.delete("product_query");
    p.delete("batch_code");
    p.delete("reason");
    p.delete("action_type");
    const q = p.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid grid-cols-1 gap-4 lg:grid-cols-8"
    >
      <div className="lg:col-span-7">
        <FieldGroup>
          <FieldSet>
            <FieldGroup>
              <div className="flex flex-wrap gap-4">
                <Field className="w-[260px]">
                  <FieldLabel htmlFor="product_query">
                    상품 (코드/이름)
                  </FieldLabel>
                  <Input
                    id="product_query"
                    placeholder="부분 일치"
                    value={form.product_query}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        product_query: e.target.value,
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
                      setForm((prev) => ({
                        ...prev,
                        batch_code: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field className="w-[180px]">
                  <FieldLabel htmlFor="action_type">유형</FieldLabel>
                  <Select
                    value={form.action_type || ALL}
                    onValueChange={(v) =>
                      setForm((prev) => ({
                        ...prev,
                        action_type: v === ALL ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger id="action_type" className="w-full">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>전체</SelectItem>
                      {ACTION_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="w-[260px]">
                  <FieldLabel htmlFor="reason">사유</FieldLabel>
                  <Input
                    id="reason"
                    placeholder="부분 일치"
                    value={form.reason}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, reason: e.target.value }))
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
          onClick={reset}
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

