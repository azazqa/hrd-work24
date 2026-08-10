"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { OwnedCourseRead } from "@/app/openapi-client";
import {
  createOwnedCourseAction,
  deleteOwnedCourseAction,
  updateOwnedCourseAction,
} from "@/components/actions/owned-courses-action";
import { CompanySelect } from "@/components/company-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type OwnedCourseFormValues = {
  company_id: string;
  dev_year: string;
  dev_round: string;
  review_round: string;
  division: string;
  ncs_dev_category: string;
  course_name: string;
  session_count: string;
  eval_training_volume: string;
  result: string;
  grade_initial: string;
  grade_23: string;
  ncs_applied: string;
  ncs_approved: string;
  is_active: boolean;
};

const emptyForm: OwnedCourseFormValues = {
  company_id: "",
  dev_year: "",
  dev_round: "",
  review_round: "",
  division: "",
  ncs_dev_category: "",
  course_name: "",
  session_count: "",
  eval_training_volume: "",
  result: "",
  grade_initial: "",
  grade_23: "",
  ncs_applied: "",
  ncs_approved: "",
  is_active: true,
};

function parseOptionalInt(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseOptionalStr(value: string): string | null {
  const t = value.trim();
  return t || null;
}

function toFormValues(row: OwnedCourseRead): OwnedCourseFormValues {
  return {
    company_id: row.company_id != null ? String(row.company_id) : "",
    dev_year: row.dev_year != null ? String(row.dev_year) : "",
    dev_round: row.dev_round != null ? String(row.dev_round) : "",
    review_round: row.review_round ?? "",
    division: row.division ?? "",
    ncs_dev_category: row.ncs_dev_category ?? "",
    course_name: row.course_name,
    session_count: row.session_count != null ? String(row.session_count) : "",
    eval_training_volume: row.eval_training_volume ?? "",
    result: row.result ?? "",
    grade_initial: row.grade_initial ?? "",
    grade_23: row.grade_23 ?? "",
    ncs_applied: row.ncs_applied ?? "",
    ncs_approved: row.ncs_approved ?? "",
    is_active: row.is_active,
  };
}

function toPayload(form: OwnedCourseFormValues) {
  const course_name = form.course_name.trim();
  if (!course_name) {
    throw new Error("과정명을 입력하세요.");
  }
  const company_id = Number(form.company_id);
  if (!Number.isFinite(company_id) || company_id <= 0) {
    throw new Error("업체를 선택하세요.");
  }
  return {
    company_id,
    dev_year: parseOptionalInt(form.dev_year),
    dev_round: parseOptionalStr(form.dev_round),
    review_round: parseOptionalStr(form.review_round),
    division: parseOptionalStr(form.division),
    ncs_dev_category: parseOptionalStr(form.ncs_dev_category),
    course_name,
    session_count: parseOptionalInt(form.session_count),
    eval_training_volume: parseOptionalStr(form.eval_training_volume),
    result: parseOptionalStr(form.result),
    grade_initial: parseOptionalStr(form.grade_initial),
    grade_23: parseOptionalStr(form.grade_23),
    ncs_applied: parseOptionalStr(form.ncs_applied),
    ncs_approved: parseOptionalStr(form.ncs_approved),
    is_active: form.is_active,
  };
}

type Props = {
  mode: "create" | "edit";
  courseId?: number;
  initial?: OwnedCourseRead;
};

export function OwnedCourseForm({ mode, courseId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<OwnedCourseFormValues>(
    initial ? toFormValues(initial) : emptyForm,
  );
  const [pending, setPending] = useState(false);

  const setField = <K extends keyof OwnedCourseFormValues>(
    key: K,
    value: OwnedCourseFormValues[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const payload = toPayload(form);
      if (mode === "create") {
        const result = await createOwnedCourseAction(payload);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success("보유 과정이 등록되었습니다.");
        router.push("/owned-courses");
        router.refresh();
        return;
      }
      if (!courseId) {
        toast.error("과정 ID가 없습니다.");
        return;
      }
      const result = await updateOwnedCourseAction(courseId, payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("보유 과정이 수정되었습니다.");
      router.push("/owned-courses");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async () => {
    if (!courseId) return;
    if (!window.confirm("이 보유 과정을 삭제하시겠습니까?")) return;
    setPending(true);
    try {
      const result = await deleteOwnedCourseAction(courseId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("삭제되었습니다.");
      router.push("/owned-courses");
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FieldSet>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="company_id">업체</FieldLabel>
            <CompanySelect
              id="company_id"
              value={form.company_id}
              onValueChange={(v) => setField("company_id", v)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dev_year">개발년도</FieldLabel>
            <Input
              id="dev_year"
              type="number"
              value={form.dev_year}
              onChange={(e) => setField("dev_year", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dev_round">개발차수</FieldLabel>
            <Input
              id="dev_round"
              value={form.dev_round}
              onChange={(e) => setField("dev_round", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="review_round">심사차수</FieldLabel>
            <Input
              id="review_round"
              value={form.review_round}
              onChange={(e) => setField("review_round", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="division">구분</FieldLabel>
            <Input
              id="division"
              value={form.division}
              onChange={(e) => setField("division", e.target.value)}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="ncs_dev_category">ncs과정개발구분</FieldLabel>
            <Input
              id="ncs_dev_category"
              value={form.ncs_dev_category}
              onChange={(e) => setField("ncs_dev_category", e.target.value)}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="course_name">
              과정명 <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="course_name"
              required
              value={form.course_name}
              onChange={(e) => setField("course_name", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="session_count">차시</FieldLabel>
            <Input
              id="session_count"
              type="number"
              value={form.session_count}
              onChange={(e) => setField("session_count", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="eval_training_volume">평가활동훈련분량</FieldLabel>
            <Input
              id="eval_training_volume"
              value={form.eval_training_volume}
              onChange={(e) => setField("eval_training_volume", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="result">결과</FieldLabel>
            <Input
              id="result"
              value={form.result}
              onChange={(e) => setField("result", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="grade_initial">등급(최초)</FieldLabel>
            <Input
              id="grade_initial"
              value={form.grade_initial}
              onChange={(e) => setField("grade_initial", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="grade_23">등급(23)</FieldLabel>
            <Input
              id="grade_23"
              value={form.grade_23}
              onChange={(e) => setField("grade_23", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ncs_applied">NCS(신청)</FieldLabel>
            <Input
              id="ncs_applied"
              value={form.ncs_applied}
              onChange={(e) => setField("ncs_applied", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ncs_approved">NCS(인정)</FieldLabel>
            <Input
              id="ncs_approved"
              value={form.ncs_approved}
              onChange={(e) => setField("ncs_approved", e.target.value)}
            />
          </Field>
          <Field className="sm:col-span-2 flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={form.is_active}
              onCheckedChange={(v) => setField("is_active", v === true)}
            />
            <Label htmlFor="is_active">사용</Label>
          </Field>
        </FieldGroup>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {mode === "create" ? "등록" : "저장"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => router.push("/owned-courses")}
          >
            취소
          </Button>
          {mode === "edit" && (
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={handleDelete}
            >
              삭제
            </Button>
          )}
        </div>
      </FieldSet>
    </form>
  );
}
