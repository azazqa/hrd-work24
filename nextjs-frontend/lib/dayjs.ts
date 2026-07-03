import dayjsBase, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjsBase.extend(utc);
dayjsBase.extend(timezone);

export const DISPLAY_TIMEZONE = "Asia/Seoul";

/**
 * API에서 오는 datetime 문자열을 dayjs로 파싱 가능한 형태로 정규화한다.
 * - 끝에 Z / ±hh:mm 오프셋이 없으면 UTC로 간주하고 'Z'를 붙인다.
 * - `YYYY-MM-DD HH:mm:ss` 형태(공백 구분)는 `T`로 바꿔 ISO로 맞춘다.
 */
export function normalizeApiDateTime(iso: string | null | undefined): string | null {
  if (iso == null) return null;
  if (typeof iso !== "string") return null;
  let trimmed = iso.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}\s+\d/.test(trimmed)) {
    trimmed = trimmed.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
  }

  const hasOffsetOrZ = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  return hasOffsetOrZ ? trimmed : trimmed + "Z";
}

export function parseApiDayjs(iso: string | null | undefined): Dayjs | null {
  const normalized = normalizeApiDateTime(iso);
  if (!normalized) return null;
  const d = dayjsBase(normalized);
  return d.isValid() ? d : null;
}

export default dayjsBase;

