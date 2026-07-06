"use client";

import type { CourseListItem } from "@/app/openapi-client";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatNumberWithCommas } from "@/lib/format-utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  course: CourseListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value?.trim() ? value : "-"}</dd>
    </div>
  );
}

export function CourseDetailDialog({ course, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>과정상세</DialogTitle>
        </DialogHeader>

        {course ? (
          <dl className="space-y-3">
            <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
              <dt className="text-muted-foreground">훈련과정명</dt>
              <dd className="flex items-start gap-2 break-words">
                <span className="">{course.course_name?.trim() || "-"}</span>
                {course.title_link ? (
                  <Button variant="outline" size="icon-xs" className="shrink-0" asChild>
                    <a
                      href={course.title_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Work24 과정 상세"
                      aria-label="Work24 과정 상세 페이지 열기"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ) : null}
              </dd>
            </div>
            <DetailRow label="훈련기관명" value={course.inst_name} />
            <DetailRow label="훈련시작일" value={course.tra_start_date} />
            <DetailRow label="훈련종료일" value={course.tra_end_date} />
            <DetailRow label="주소" value={course.address} />
            <DetailRow label="전화번호" value={course.tel_no} />
            <DetailRow label="정원" value={formatNumberWithCommas(course.yard_man)} />
            <DetailRow
              label="수강신청 인원"
              value={formatNumberWithCommas(course.reg_course_man)}
            />
            <DetailRow label="실제 훈련비" value={formatNumberWithCommas(course.real_man)} />
            <DetailRow label="훈련기관ID" value={course.trainst_cst_id} />
            <DetailRow label="훈련과정ID" value={course.trpr_id} />
            <DetailRow label="훈련과정차수" value={course.trpr_degr} />
          </dl>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
