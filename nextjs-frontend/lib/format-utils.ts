/** 숫자 문자열에 천 단위 콤마를 붙입니다. 숫자가 아니면 원문을 반환합니다. */
export function formatNumberWithCommas(value: string | null | undefined): string {
  if (value == null) return "-";
  const trimmed = value.trim();
  if (!trimmed) return "-";
  const num = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(num)) return trimmed;
  return num.toLocaleString("ko-KR");
}
