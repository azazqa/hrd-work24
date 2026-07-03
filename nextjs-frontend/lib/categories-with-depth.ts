export type CategoryTreeNode = {
  id: string;
  name: string;
  parent_id?: string | null;
};

/** parent_id 기준 계층 순서(depth 포함) — 상품 등록·재고 검색 등 동일 UX용 */
export function categoriesWithDepth(
  categories: CategoryTreeNode[],
): { id: string; name: string; depth: number }[] {
  const result: { id: string; name: string; depth: number }[] = [];

  function addChildren(parentId: string | null, depth: number) {
    for (const c of categories) {
      const pid = c.parent_id ?? null;
      if (pid !== parentId) continue;
      result.push({ id: c.id, name: c.name, depth });
      addChildren(c.id, depth + 1);
    }
  }

  addChildren(null, 0);
  return result;
}
