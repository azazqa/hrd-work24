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
  dev_year: string;
  division: string;
  is_active: string;
};

export type OwnedCoursesSearchInitial = Partial<FormState>;

function fromInitial(initial: OwnedCoursesSearchInitial): FormState {
  return {
    q: initial.q ?? "",
    dev_year: initial.dev_year ?? "",
    division: initial.division ?? "",
    is_active: initial.is_active ?? "",
  };
}

function buildSearchQueryString(form: FormState, size: number): string {
  return buildSearchQuery(size, {
    q: form.q,
    dev_year: form.dev_year,
    division: form.division,
    is_active: form.is_active || undefined,
  });
}

function buildDefaultResetQuery(size: number): string {
  return `page=1&size=${size}`;
}

export function OwnedCoursesSearchForm({
  initial,
  size,
}: {
  initial: OwnedCoursesSearchInitial;
  size: number;
}) {
  const { form, setForm, handleSubmit, handleReset } = useSearchFormSync({
    basePath: "/owned-courses",
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
        <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="q">과정명</FieldLabel>
            <Input
              id="q"
              value={form.q}
              onChange={(e) => setForm({ ...form, q: e.target.value })}
              placeholder="과정명 검색"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dev_year">개발년도</FieldLabel>
            <Input
              id="dev_year"
              type="number"
              value={form.dev_year}
              onChange={(e) => setForm({ ...form, dev_year: e.target.value })}
              placeholder="예: 2024"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="division">구분</FieldLabel>
            <Input
              id="division"
              value={form.division}
              onChange={(e) => setForm({ ...form, division: e.target.value })}
              placeholder="구분"
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
