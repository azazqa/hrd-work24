"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTraYearOptions } from "@/lib/date-utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageSize: number;
  hasRegCourseMan?: boolean;
};

const DEFAULT_MIN_SCORE = "1";

export function OwnedSearchDialog({
  open,
  onOpenChange,
  pageSize,
  hasRegCourseMan = false,
}: Props) {
  const router = useRouter();
  const yearOptions = getTraYearOptions();
  const [year, setYear] = useState(String(yearOptions[0] ?? 2023));
  const [minScore, setMinScore] = useState(DEFAULT_MIN_SCORE);

  const handleConfirm = () => {
    const y = Number(year);
    const score = Number(minScore);
    if (!Number.isFinite(y)) return;
    const q = new URLSearchParams();
    q.set("owned_year", String(y));
    q.set("min_score", Number.isFinite(score) ? String(score) : DEFAULT_MIN_SCORE);
    q.set("page", "1");
    q.set("size", String(pageSize));
    if (hasRegCourseMan) q.set("has_reg_course_man", "true");
    onOpenChange(false);
    router.push(`/courses?${q.toString()}`);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setYear(String(yearOptions[0] ?? 2023));
      setMinScore(DEFAULT_MIN_SCORE);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>보유 과정 조회</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            활성 보유과정명이 Work24 과정명에 포함된 결과만 검색합니다. 관련도 임계치가
            클수록 약한 일치를 제외합니다.
          </p>
          <Field>
            <FieldLabel htmlFor="owned_year">조회 년도</FieldLabel>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger id="owned_year">
                <SelectValue placeholder="년도 선택" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="min_score">관련도 임계치</FieldLabel>
            <Input
              id="min_score"
              type="number"
              min={0}
              step={0.1}
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              0이면 미적용. 기본값 1.0 권장.
            </p>
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            취소
          </Button>
          <Button type="button" onClick={handleConfirm}>
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
