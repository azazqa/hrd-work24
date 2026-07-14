"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { format, parse, subMonths } from "date-fns";

import { buildSearchQuery, useSearchFormSync } from "@/lib/use-search-form-sync";
import { getDefaultTraStartDateRange, getTraStartCalendarBounds } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { OwnedSearchDialog } from "./owned-search-dialog";

type FormState = {
  srch_tra_st_dt: string;
  srch_tra_end_dt: string;
  srch_tra_organ_nm: string;
  srch_tra_process_nm: string;
  has_reg_course_man: boolean;
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
    has_reg_course_man: initial.has_reg_course_man ?? false,
  };
}

function buildSearchQueryString(form: FormState, size: number): string {
  return buildSearchQuery(size, {
    srch_tra_st_dt: form.srch_tra_st_dt,
    srch_tra_end_dt: form.srch_tra_end_dt,
    srch_tra_organ_nm: form.srch_tra_organ_nm,
    srch_tra_process_nm: form.srch_tra_process_nm,
    has_reg_course_man: form.has_reg_course_man,
  });
}

function buildDefaultResetQuery(size: number): string {
  const { start, end } = getDefaultRange();
  return `page=1&size=${size}&srch_tra_st_dt=${encodeURIComponent(start)}&srch_tra_end_dt=${encodeURIComponent(end)}`;
}

function getTodayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

export function CourseSearchForm({
  initial,
  size,
  ownedSearchContext,
}: {
  initial: CourseSearchInitial;
  size: number;
  ownedSearchContext?: {
    owned_year: number;
    min_score: number;
  };
}) {
  const [openTraDatePicker, setOpenTraDatePicker] = useState<"start" | "end" | null>(
    null,
  );
  const [ownedSearchOpen, setOwnedSearchOpen] = useState(false);

  const { form, setForm, handleSubmit, handleReset, isPending, navigate } =
    useSearchFormSync({
      basePath: "/courses",
      size,
      initial,
      fromInitial,
      buildQueryString: buildSearchQueryString,
      buildResetQueryString: buildDefaultResetQuery,
      resetForm: () => fromInitial({}),
    });

  const traCalendarBounds = useMemo(() => getTraStartCalendarBounds(), []);

  const traDateStart = useMemo(() => {
    const s = form.srch_tra_st_dt.trim();
    if (!s) return undefined;
    try {
      return parse(s, "yyyy-MM-dd", new Date());
    } catch {
      return undefined;
    }
  }, [form.srch_tra_st_dt]);

  const traDateEnd = useMemo(() => {
    const s = form.srch_tra_end_dt.trim();
    if (!s) return undefined;
    try {
      return parse(s, "yyyy-MM-dd", new Date());
    } catch {
      return undefined;
    }
  }, [form.srch_tra_end_dt]);

  const applyTraDatePresetMonths = (months: number) => {
    const end = new Date();
    const start = subMonths(end, months);
    setForm((p) => ({
      ...p,
      srch_tra_st_dt: format(start, "yyyy-MM-dd"),
      srch_tra_end_dt: format(end, "yyyy-MM-dd"),
    }));
    setOpenTraDatePicker(null);
  };

  const handleResetClick = () => {
    setOpenTraDatePicker(null);
    handleReset();
  };

  const handleRegCourseManChange = (checked: boolean) => {
    setForm((p) => ({ ...p, has_reg_course_man: checked }));
    if (ownedSearchContext) {
      const q = new URLSearchParams();
      q.set("owned_year", String(ownedSearchContext.owned_year));
      q.set("min_score", String(ownedSearchContext.min_score));
      if (checked) q.set("has_reg_course_man", "true");
      q.set("page", "1");
      q.set("size", String(size));
      navigate(`/courses?${q.toString()}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FieldSet>
        <FieldGroup className="flex flex-wrap gap-4">
          <Field className="">
            <FieldLabel>훈련시작일</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Popover
                  open={openTraDatePicker === "start"}
                  onOpenChange={(o) => setOpenTraDatePicker(o ? "start" : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      data-empty={!traDateStart}
                      className="min-w-[140px] justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                    >
                      {traDateStart ? (
                        format(traDateStart, "yyyy-MM-dd")
                      ) : (
                        <span>시작일</span>
                      )}
                      <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={traDateStart}
                      defaultMonth={traDateStart ?? new Date()}
                      startMonth={traCalendarBounds.startMonth}
                      endMonth={traCalendarBounds.endMonth}
                      disabled={[
                        { before: traCalendarBounds.minDate },
                        { after: traCalendarBounds.maxDate },
                      ]}
                      onSelect={(d) => {
                        setForm((p) => ({
                          ...p,
                          srch_tra_st_dt: d ? format(d, "yyyy-MM-dd") : "",
                        }));
                        if (d !== undefined) setOpenTraDatePicker(null);
                      }}
                    />
                  </PopoverContent>
                </Popover>

                <span className="shrink-0 text-muted-foreground">~</span>

                <Popover
                  open={openTraDatePicker === "end"}
                  onOpenChange={(o) => setOpenTraDatePicker(o ? "end" : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      data-empty={!traDateEnd}
                      className="min-w-[140px] justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                    >
                      {traDateEnd ? (
                        format(traDateEnd, "yyyy-MM-dd")
                      ) : (
                        <span>종료일</span>
                      )}
                      <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={traDateEnd}
                      defaultMonth={traDateEnd ?? new Date()}
                      startMonth={traCalendarBounds.startMonth}
                      endMonth={traCalendarBounds.endMonth}
                      disabled={[
                        { before: traCalendarBounds.minDate },
                        { after: traCalendarBounds.maxDate },
                      ]}
                      onSelect={(d) => {
                        setForm((p) => ({
                          ...p,
                          srch_tra_end_dt: d ? format(d, "yyyy-MM-dd") : "",
                        }));
                        if (d !== undefined) setOpenTraDatePicker(null);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTraDatePresetMonths(1)}
                >
                  1개월
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTraDatePresetMonths(3)}
                >
                  3개월
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = getTodayStr();
                    setForm((p) => ({
                      ...p,
                      srch_tra_st_dt: today,
                      srch_tra_end_dt: today,
                    }));
                    setOpenTraDatePicker(null);
                  }}
                >
                  오늘
                </Button>
              </div>
            </div>
          </Field>
          <Field className="w-[300px]">
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
          <Field className="w-[400px]">
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
          <Field className="flex items-center">
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="has_reg_course_man"
                checked={form.has_reg_course_man}
                onCheckedChange={(v) => handleRegCourseManChange(v === true)}
              />
              <Label htmlFor="has_reg_course_man" className="cursor-pointer font-normal">
                수강신청 인원 있음
              </Label>
            </div>
          </Field>
        </FieldGroup>
        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={isPending}>
            조회
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOwnedSearchOpen(true)}
            disabled={isPending}
          >
            보유 과정 조회
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleResetClick}
            disabled={isPending}
          >
            초기화
          </Button>
        </div>
      </FieldSet>
      <OwnedSearchDialog
        open={ownedSearchOpen}
        onOpenChange={setOwnedSearchOpen}
        pageSize={size}
        hasRegCourseMan={form.has_reg_course_man}
        onNavigate={navigate}
      />
    </form>
  );
}
