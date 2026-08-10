"use client";

import { buildSearchQuery, useSearchFormSync } from "@/lib/use-search-form-sync";
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

type FormState = {
  q: string;
  is_active: string;
};

export type CompaniesSearchInitial = Partial<FormState>;

function fromInitial(initial: CompaniesSearchInitial): FormState {
  return {
    q: initial.q ?? "",
    is_active: initial.is_active ?? "",
  };
}

function buildSearchQueryString(form: FormState, size: number): string {
  return buildSearchQuery(size, {
    q: form.q,
    is_active: form.is_active || undefined,
  });
}

function buildDefaultResetQuery(size: number): string {
  return `page=1&size=${size}`;
}

export function CompaniesSearchForm({
  initial,
  size,
}: {
  initial: CompaniesSearchInitial;
  size: number;
}) {
  const { form, setForm, handleSubmit, handleReset } = useSearchFormSync({
    basePath: "/companies",
    size,
    initial,
    fromInitial,
    buildQueryString: buildSearchQueryString,
    buildResetQueryString: buildDefaultResetQuery,
    resetForm: () => fromInitial({}),
  });

  return (
    <form onSubmit={handleSubmit}>
      <FieldSet>
        <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="q">업체명</FieldLabel>
            <Input
              id="q"
              value={form.q}
              onChange={(e) => setForm({ ...form, q: e.target.value })}
              placeholder="업체명 검색"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="is_active">사용여부</FieldLabel>
            <Select
              value={form.is_active || "__all__"}
              onValueChange={(v) =>
                setForm({ ...form, is_active: v === "__all__" ? "" : v })
              }
            >
              <SelectTrigger id="is_active">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">전체</SelectItem>
                <SelectItem value="true">사용</SelectItem>
                <SelectItem value="false">미사용</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <div className="mt-4 flex gap-2">
          <Button type="submit">검색</Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            초기화
          </Button>
        </div>
      </FieldSet>
    </form>
  );
}
