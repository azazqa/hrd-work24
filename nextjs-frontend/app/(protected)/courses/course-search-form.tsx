"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";

import { buildSearchQuery, useSearchFormSync } from "@/lib/use-search-form-sync";
import {
  formatYmdInSeoul,
  getDefaultTraStartDateRange,
  getTraStartCalendarBounds,
  parseYmdInSeoul,
} from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type FormState = {
  srch_tra_st_dt: string;
  srch_tra_end_dt: string;
  srch_tra_organ_nm: string;
  srch_tra_process_nm: string;
};

export type CourseSearchInitial = Partial<FormState>;

function getDefaultRange() {
  return getDefaultTraStartDateRange();
}

function fromInitial(initial: CourseSearchInitial): FormState {
  const defaults = getDefaultRange();
  return {
    srch_tra_st_dt: initial.srch_tra_st_dt ?? defaults.start,
    srch_tra_end_dt: initial.srch_tra_end_dt ?? defaults.end,
    srch_tra_organ_nm: initial.srch_tra_organ_nm ?? "",
    srch_tra_process_nm: initial.srch_tra_process_nm ?? "",
  };
}

function buildSearchQueryString(form: FormState, size: number): string {
  return buildSearchQuery(size, {
    srch_tra_st_dt: form.srch_tra_st_dt,
    srch_tra_end_dt: form.srch_tra_end_dt,
    srch_tra_organ_nm: form.srch_tra_organ_nm,
    srch_tra_process_nm: form.srch_tra_process_nm,
  });
}

function buildDefaultResetQuery(size: number): string {
  const { start, end } = getDefaultRange();
  return `page=1&size=${size}&srch_tra_st_dt=${encodeURIComponent(start)}&srch_tra_end_dt=${encodeURIComponent(end)}`;
}

function formatTraDateRangeLabel(start: string, end: string): string {
  if (start && end) return `${start} ~ ${end}`;
  if (start) return `${start} ~`;
  return "훈련시작일 선택";
}

export function CourseSearchForm({
  initial,
  size,
}: {
  initial: CourseSearchInitial;
  size: number;
}) {
  const [openDatePicker, setOpenDatePicker] = useState(false);

  const { form, setForm, handleSubmit, handleReset } = useSearchFormSync({
    basePath: "/courses",
    size,
    initial,
    fromInitial,
    buildQueryString: buildSearchQueryString,
    buildResetQueryString: buildDefaultResetQuery,
    resetForm: () => fromInitial({}),
  });

  const traDateRange = useMemo((): DateRange | undefined => {
    const from = parseYmdInSeoul(form.srch_tra_st_dt);
    const to = parseYmdInSeoul(form.srch_tra_end_dt);
    if (!from && !to) return undefined;
    return { from: from ?? undefined, to: to ?? undefined };
  }, [form.srch_tra_st_dt, form.srch_tra_end_dt]);

  const traCalendarBounds = useMemo(() => getTraStartCalendarBounds(), []);

  const handleResetClick = () => {
    setOpenDatePicker(false);
    handleReset();
  };

  return (
    <form onSubmit={handleSubmit}>
      <FieldSet>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <FieldLabel>훈련시작일</FieldLabel>
            <Popover open={openDatePicker} onOpenChange={setOpenDatePicker}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-between font-normal sm:max-w-md",
                    !form.srch_tra_st_dt && !form.srch_tra_end_dt && "text-muted-foreground",
                  )}
                >
                  {formatTraDateRangeLabel(form.srch_tra_st_dt, form.srch_tra_end_dt)}
                  <ChevronDownIcon className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={traDateRange}
                  onSelect={(range) => {
                    setForm((prev) => ({
                      ...prev,
                      srch_tra_st_dt: range?.from ? formatYmdInSeoul(range.from) : "",
                      srch_tra_end_dt: range?.to ? formatYmdInSeoul(range.to) : "",
                    }));
                  }}
                  numberOfMonths={2}
                  startMonth={traCalendarBounds.startMonth}
                  endMonth={traCalendarBounds.endMonth}
                  disabled={{
                    before: traCalendarBounds.minDate,
                    after: traCalendarBounds.maxDate,
                  }}
                  defaultMonth={traDateRange?.from ?? parseYmdInSeoul(form.srch_tra_st_dt) ?? undefined}
                />
              </PopoverContent>
            </Popover>
          </Field>
          <Field>
            <FieldLabel htmlFor="srch_tra_organ_nm">훈련기관명</FieldLabel>
            <Input
              id="srch_tra_organ_nm"
              value={form.srch_tra_organ_nm}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, srch_tra_organ_nm: e.target.value }))
              }
              placeholder="훈련기관명"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="srch_tra_process_nm">훈련과정명</FieldLabel>
            <Input
              id="srch_tra_process_nm"
              value={form.srch_tra_process_nm}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, srch_tra_process_nm: e.target.value }))
              }
              placeholder="훈련과정명"
            />
          </Field>
        </FieldGroup>
        <div className="mt-4 flex gap-2">
          <Button type="submit">조회</Button>
          <Button type="button" variant="outline" onClick={handleResetClick}>
            초기화
          </Button>
        </div>
      </FieldSet>
    </form>
  );
}
