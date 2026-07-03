import { notFound } from "next/navigation";

import { fetchCategory, fetchRootCategoriesForSelect } from "@/components/actions/categories-action";
import { CategoryEditForm } from "./category-edit-form";

interface EditCategoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const { id } = await params;
  const categoryRes = await fetchCategory(id);
  if (!categoryRes || "message" in (categoryRes as any)) {
    notFound();
  }

  const category = categoryRes as any;
  const roots = await fetchRootCategoriesForSelect();

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-white">
            카테고리 수정
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            카테고리 정보를 수정하고 저장할 수 있습니다.
          </p>
        </header>

        <CategoryEditForm
          category={{
            id: String(category.id),
            name: String(category.name ?? ""),
            description: category.description ?? null,
            parent_id: category.parent_id ?? null,
          }}
          rootCategories={(roots ?? []).map((c: any) => ({
            id: String(c.id),
            name: String(c.name ?? ""),
          }))}
        />
      </div>
    </div>
  );
}

