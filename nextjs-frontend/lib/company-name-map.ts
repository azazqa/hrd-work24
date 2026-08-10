import { fetchCompanies } from "@/components/actions/companies-action";

/** 목록 표시용 id → 업체명. 비활성 포함(소프트삭제 제외). */
export async function loadCompanyNameById(): Promise<Record<number, string>> {
  const data = await fetchCompanies(1, 200);
  if ("message" in data) return {};
  const map: Record<number, string> = {};
  for (const c of data.items ?? []) {
    map[c.id] = c.name;
  }
  return map;
}

export function companyLabel(
  companyId: number | null | undefined,
  nameById: Record<number, string>,
): string {
  if (companyId == null) return "-";
  return nameById[companyId] ?? `업체#${companyId}`;
}
