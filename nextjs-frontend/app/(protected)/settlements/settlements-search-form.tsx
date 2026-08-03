"use client";

import { buildSearchQuery, useSearchFormSync } from "@/lib/use-search-form-sync";
import { getTraYearOptions } from "@/lib/date-utils";
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
  year: string;
  client_name: string;
  course_name: string;
};

export type SettlementsSearchInitial = Partial<FormState>;

function fromInitial(initial: SettlementsSearchInitial): FormState {
  return {
    year: initial.year ?? "",
    client_name: initial.client_name ?? "",
    course_name: initial.course_name ?? "",
  };
}

function buildSearchQueryString(form: FormState, size: number): string {
  return buildSearchQuery(size, {
    year: form.year,
    client_name: form.client_name,
    course_name: form.course_name,
  });
}

function buildDefaultResetQuery(size: number): string {
  return `page=1&size=${size}`;
}

export function SettlementsSearchForm({
  initial,
  size,
}: {
  initial: SettlementsSearchInitial;
  size: number;
}) {
  const yearOptions = getTraYearOptions();
  const { form, setForm, handleSubmit, handleReset } = useSearchFormSync({
    basePath: "/settlements",
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
            <FieldLabel htmlFor="year">매입년도</FieldLabel>
            <Select
              value={form.year || "__all__"}
              onValueChange={(v) =>
                setForm({ ...form, year: v === "__all__" ? "" : v })
              }
            >
              <SelectTrigger id="year">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">전체</SelectItem>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="client_name">고객사</FieldLabel>
            <Input
              id="client_name"
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              placeholder="고객사 검색"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="course_name">과정명</FieldLabel>
            <Input
              id="course_name"
              value={form.course_name}
              onChange={(e) => setForm({ ...form, course_name: e.target.value })}
              placeholder="과정명 검색"
            />
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
