import { z } from "zod";

/** 백엔드 EXPECTED_HEADERS / 주문 업로드와 동일한 표준 한글 필드명 */
export const ORDER_EXCEL_CANONICAL_LABELS = [
  "채널",
  "수취인명",
  "상품명",
  "수량",
  "총 주문금액",
  "수취인연락처",
  "우편번호",
  "통합배송지",
  "배송메세지",
] as const;

export type OrderExcelCanonicalLabel = (typeof ORDER_EXCEL_CANONICAL_LABELS)[number];

/** 채널 설정 UI에서는 주문 업로드 화면에서 채널을 고르므로 '채널' 열 매핑은 제외 */
export const ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG: OrderExcelCanonicalLabel[] =
  ORDER_EXCEL_CANONICAL_LABELS.filter((l) => l !== "채널");

const orderExcelColumnEntrySchema = z.object({
  label: z.string(),
});

export const orderExcelMappingSchema = z.object({
  header_row: z.number().int().min(1),
  columns: z.record(z.string(), orderExcelColumnEntrySchema),
  /** 샘플 엑셀 헤더 행의 전체 열 이름(원본 순서) */
  source_headers: z.array(z.string()).optional(),
});

export type OrderExcelMapping = z.infer<typeof orderExcelMappingSchema>;

/** API(OpenAPI) 응답 등 — `columns` / `header_row`가 생략될 수 있음 */
export type OrderExcelMappingLike = {
  header_row?: number;
  columns?: Record<string, { label?: string }>;
  /** OpenAPI는 `anyOf` 배열·null로 생성됨 */
  source_headers?: string[] | null;
} | null;

/** 표준 필드(채널 열 제외) → 엑셀 헤더 문자열, 빈 문자열은 미매칭 */
export function createEmptyExcelFieldMap(): Record<string, string> {
  const o: Record<string, string> = {};
  for (const c of ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG) {
    o[c] = "";
  }
  return o;
}

/** 폼의 헤더 행 + 열 이름 입력으로 API용 매핑 객체 생성 */
export function formExcelFieldsToMapping(
  headerRow: number,
  excelByCanonical: Record<string, string>,
  options?: { sourceHeaders?: string[] },
):
  | { ok: true; data: OrderExcelMapping | null }
  | { ok: false; error: string } {
  const hr = Math.max(1, Math.floor(Number(headerRow)) || 1);
  const columns: OrderExcelMapping["columns"] = {};
  const usedExcel = new Set<string>();
  for (const canon of ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG) {
    const ex = String(excelByCanonical[canon] ?? "").trim();
    if (!ex) continue;
    if (usedExcel.has(ex)) {
      return {
        ok: false,
        error: `엑셀 열 이름 "${ex}"이(가) 두 표준 필드에 중복으로 지정되었습니다.`,
      };
    }
    usedExcel.add(ex);
    columns[ex] = { label: canon };
  }
  const source_headers = options?.sourceHeaders;
  if (Object.keys(columns).length === 0) {
    if (hr === 1 && source_headers === undefined) return { ok: true, data: null };
    const base: OrderExcelMapping = { header_row: hr, columns: {} };
    if (source_headers !== undefined) {
      base.source_headers = [...source_headers];
    }
    return { ok: true, data: base };
  }
  const data: OrderExcelMapping = { header_row: hr, columns };
  if (source_headers !== undefined) {
    data.source_headers = [...source_headers];
  }
  return { ok: true, data };
}

export function mappingToFormExcelFields(
  mapping: OrderExcelMappingLike | undefined,
): { headerRow: number; excelByCanonical: Record<string, string> } {
  const excelByCanonical = createEmptyExcelFieldMap();
  if (!mapping) return { headerRow: 1, excelByCanonical };
  const hr =
    mapping.header_row != null && Number(mapping.header_row) >= 1
      ? Math.floor(Number(mapping.header_row))
      : 1;
  const cols = mapping.columns ?? {};
  for (const [exKey, meta] of Object.entries(cols)) {
    const lab = (meta?.label ?? "").trim();
    if (
      lab &&
      (ORDER_EXCEL_LABELS_FOR_CHANNEL_CONFIG as readonly string[]).includes(lab)
    ) {
      excelByCanonical[lab] = exKey;
    }
  }
  return { headerRow: hr, excelByCanonical };
}

/** 주문 raw(원본 엑셀 헤더 키)에서 표준 필드 값 읽기 — 매핑된 열 이름 우선, 없으면 한글 표준 키(레거시). */
export function pickOrderRawField(
  raw: Record<string, unknown>,
  canonical: (typeof ORDER_EXCEL_CANONICAL_LABELS)[number],
  excelByCanonical: Record<string, string>,
): unknown {
  const ex = String(excelByCanonical[canonical] ?? "").trim();
  if (ex && ex in raw) return raw[ex];
  return raw[canonical];
}

export function parseOrderExcelMappingJson(raw: string | null | undefined): {
  success: true;
  data: OrderExcelMapping | null;
} | {
  success: false;
  message: string;
} {
  if (raw == null || String(raw).trim() === "") {
    return { success: true, data: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return { success: false, message: "주문 양식 JSON 파싱에 실패했습니다." };
  }
  const r = orderExcelMappingSchema.safeParse(parsed);
  if (!r.success) {
    return {
      success: false,
      message:
        r.error.issues.map((e) => e.message).join(", ") || "주문 양식 형식이 올바르지 않습니다.",
    };
  }
  for (const [, entry] of Object.entries(r.data.columns)) {
    const lab = (entry.label || "").trim();
    if (lab && !ORDER_EXCEL_CANONICAL_LABELS.includes(lab as OrderExcelCanonicalLabel)) {
      return { success: false, message: `알 수 없는 표준 필드: ${lab}` };
    }
  }
  return { success: true, data: r.data };
}
