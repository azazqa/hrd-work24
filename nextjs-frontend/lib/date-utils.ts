import dayjs, { DISPLAY_TIMEZONE, parseApiDayjs } from "@/lib/dayjs";

export function formatYmdInSeoul(d: Date): string {
  return dayjs(d).tz(DISPLAY_TIMEZONE).format("YYYY-MM-DD");
}

export function formatYmInSeoul(d: Date): string {
  return dayjs(d).tz(DISPLAY_TIMEZONE).format("YYYY-MM");
}

export function formatYmLabelInSeoul(ym: string): string {
  const d = parseYmInSeoul(ym);
  if (!d) return "월 선택";
  return dayjs(d).tz(DISPLAY_TIMEZONE).format("YYYY년 M월");
}

export function getWeekDaysContainingYmd(ymd: string): string[] {
  const d = dayjs.tz(ymd, "YYYY-MM-DD", DISPLAY_TIMEZONE);
  if (!d.isValid()) return [];
  const weekStart = d.subtract(d.day(), "day");
  return Array.from({ length: 7 }, (_, i) =>
    weekStart.add(i, "day").format("YYYY-MM-DD"),
  );
}

/** react-day-picker `fixedWeeks` + ko locale(weekStartsOn: 0) 그리드 범위 */
export function getSettlementStatsCalendarGridRange(month: Date): {
  range_start: string;
  range_end: string;
} {
  const first = dayjs(month).tz(DISPLAY_TIMEZONE).startOf("month");
  const last = first.endOf("month");
  const gridStart = first.subtract(first.day(), "day");
  let gridEnd = last.add(6 - last.day(), "day");
  const totalDays = gridEnd.diff(gridStart, "day") + 1;
  if (totalDays < 42) {
    gridEnd = gridStart.add(41, "day");
  }
  return {
    range_start: gridStart.format("YYYY-MM-DD"),
    range_end: gridEnd.format("YYYY-MM-DD"),
  };
}

export function parseYmInSeoul(ym: string | null | undefined): Date | null {
  if (!ym) return null;
  const t = String(ym).trim();
  if (!t) return null;
  const d = dayjs.tz(t, "YYYY-MM", DISPLAY_TIMEZONE);
  return d.isValid() ? d.toDate() : null;
}

export function parseYmdInSeoul(ymd: string | null | undefined): Date | null {
  if (!ymd) return null;
  const t = String(ymd).trim();
  if (!t) return null;
  const d = dayjs.tz(t, "YYYY-MM-DD", DISPLAY_TIMEZONE);
  return d.isValid() ? d.toDate() : null;
}

export function formatDateInSeoul(iso: string | null | undefined): string {
  const d = parseApiDayjs(iso);
  if (!d) return "-";
  return d.tz(DISPLAY_TIMEZONE).format("YYYY-MM-DD");
}

export function formatDateTimeInSeoul(iso: string | null | undefined): string {
  const d = parseApiDayjs(iso);
  if (!d) return "-";
  // 24시간 고정: hydration mismatch 방지
  return d.tz(DISPLAY_TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
}

/** null/undefined일 때 "" 반환 (라벨 등에서 사용) */
export function formatDateInSeoulOrEmpty(iso: string | null | undefined): string {
  const s = formatDateInSeoul(iso);
  return s === "-" ? "" : s;
}

/** 훈련시작일 검색 기본값: 오늘 기준 이전 달 1일 ~ 말일 (Asia/Seoul) */
export function getDefaultTraStartDateRange(): { start: string; end: string } {
  const prevMonth = dayjs().tz(DISPLAY_TIMEZONE).subtract(1, "month");
  return {
    start: prevMonth.startOf("month").format("YYYY-MM-DD"),
    end: prevMonth.endOf("month").format("YYYY-MM-DD"),
  };
}

const TRA_START_YEAR_MIN = 2020;

/** 과정 조회 훈련시작일 캘린더: 2020년 1월 ~ 내년 12월 (Asia/Seoul 기준) */
export function getTraStartCalendarBounds(): {
  startMonth: Date;
  endMonth: Date;
  minDate: Date;
  maxDate: Date;
} {
  const now = dayjs().tz(DISPLAY_TIMEZONE);
  const nextYear = now.year() + 1;
  return {
    startMonth: dayjs.tz(`${TRA_START_YEAR_MIN}-01-01`, DISPLAY_TIMEZONE).toDate(),
    endMonth: dayjs.tz(`${nextYear}-12-01`, DISPLAY_TIMEZONE).toDate(),
    minDate: dayjs.tz(`${TRA_START_YEAR_MIN}-01-01`, DISPLAY_TIMEZONE).toDate(),
    maxDate: dayjs.tz(`${nextYear}-12-31`, DISPLAY_TIMEZONE).toDate(),
  };
}

