"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CourseIndexResult {
  fetched: number;
  indexed: number;
  total_count: number;
}

interface LegacyIndexResponse {
  queue_ids: number[];
  start_month: string;
  end_month: string;
  month_count: number;
  message: string;
}

async function readApiError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { detail?: string | { msg?: string }[] };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail.map((d) => (typeof d === "object" && d?.msg ? d.msg : String(d))).join(", ");
    }
  } catch {
    /* ignore */
  }
  return text || `요청 실패 (HTTP ${res.status})`;
}

export default function AdminCoursesPage() {
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<CourseIndexResult | null>(null);

  const [startMonth, setStartMonth] = useState("2023-01");
  const [endMonth, setEndMonth] = useState("2023-01");
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [legacyResult, setLegacyResult] = useState<LegacyIndexResponse | null>(null);

  const handleTestIndex = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/courses/index", {
        method: "POST",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await readApiError(res));
      const data = (await res.json()) as CourseIndexResult;
      setTestResult(data);
      toast.success(
        `색인 완료: ${data.indexed}건 저장 (조회 ${data.fetched}건 / 전체 ${data.total_count}건)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "색인 실행 실패");
    } finally {
      setTestLoading(false);
    }
  };

  const handleLegacyIndex = async () => {
    setLegacyLoading(true);
    setLegacyResult(null);
    try {
      const res = await fetch("/api/courses/legacy-index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_month: startMonth, end_month: endMonth }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await readApiError(res));
      const data = (await res.json()) as LegacyIndexResponse;
      setLegacyResult(data);
      toast.success(data.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "과거 색인 등록 실패");
    } finally {
      setLegacyLoading(false);
    }
  };

  const delayNotice = (
    <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      Work24 API 호출 정책으로 요청마다 최대 10초 대기가 적용됩니다. 응답·색인 작업이
      지연될 수 있습니다. 호출 이력은 관리자 &gt; API 조회 로그에서 확인할 수 있습니다.
    </p>
  );

  return (
    <div className="space-y-8">
      <section className="rounded-lg bg-white p-6 shadow-lg">
        <h1 className="mb-2 text-2xl font-semibold">과정 색인 (테스트)</h1>
        {delayNotice}
        <p className="mb-6 text-sm text-muted-foreground">
          Work24 Open API에서 훈련과정 데이터를 가져와 Elasticsearch에 색인합니다.
          (테스트 파라미터: 2026-01-01 ~ 2026-02-01, 과정명 &quot;4차 산업혁명과 개인
          맞춤형 사회복지 실천&quot;, 1페이지 10건)
        </p>
        <Button onClick={handleTestIndex} disabled={testLoading}>
          {testLoading ? "색인 중..." : "색인 실행"}
        </Button>

        {testResult && (
          <dl className="mt-6 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">조회 건수</dt>
              <dd className="text-xl font-medium">{testResult.fetched}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">색인 건수</dt>
              <dd className="text-xl font-medium">{testResult.indexed}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">전체 검색 건수</dt>
              <dd className="text-xl font-medium">{testResult.total_count}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-2 text-xl font-semibold">과거 과정 색인</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          YYYY-MM 범위를 월 단위 큐로 나누어 백그라운드에서 순차 색인합니다. 스케줄러
          실행 이력은 관리자 스케줄러 화면에서 확인할 수 있습니다.
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="start_month">시작 월</Label>
            <Input
              id="start_month"
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="end_month">종료 월</Label>
            <Input
              id="end_month"
              type="month"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              className="w-44"
            />
          </div>
          <Button onClick={handleLegacyIndex} disabled={legacyLoading}>
            {legacyLoading ? "등록 중..." : "과거 색인 실행"}
          </Button>
        </div>

        {legacyResult && (
          <p className="text-sm text-muted-foreground">
            {legacyResult.start_month} ~ {legacyResult.end_month} ({legacyResult.month_count}
            개월) — 큐 ID {legacyResult.queue_ids.join(", ")} — {legacyResult.message}
          </p>
        )}
      </section>
    </div>
  );
}
