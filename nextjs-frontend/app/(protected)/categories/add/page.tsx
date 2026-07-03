import { CategoryForm } from "./category-form";
import { fetchRootCategoriesForSelect } from "@/components/actions/categories-action";

export default async function CreateCategoryPage() {
  const categories = await fetchRootCategoriesForSelect();

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-white">
            카테고리 등록
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            새로운 상품 카테고리 정보를 입력해주세요.
          </p>
        </header>
        <CategoryForm categories={categories} />
      </div>
    </div>
  );
}
