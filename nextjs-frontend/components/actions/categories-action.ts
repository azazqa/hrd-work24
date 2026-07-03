"use server";

import { requireAccessToken } from "@/components/actions/auth-token";
import {
  listCategories,
  createCategory,
  deleteCategory,
  getCategory,
  updateCategory,
} from "@/app/clientService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { categorySchema } from "@/lib/definitions";

export async function fetchCategories(
  page: number = 1,
  size: number = 10,
  parentId?: string,
  search?: { name?: string; description?: string },
) {
  const token = await requireAccessToken();

  const query: {
    page: number;
    size: number;
    parent_id?: string;
    name?: string;
    description?: string;
  } = { page, size, parent_id: parentId };
  if (search?.name?.trim()) {
    query.name = search.name.trim();
  }
  if (search?.description?.trim()) {
    query.description = search.description.trim();
  }

  const { data, error } = await listCategories({
    query,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { message: error };
  }

  return data;
}

export async function fetchCategoriesForSelect() {
  const token = await requireAccessToken();

  const { data } = await listCategories({
    query: { page: 1, size: 100 },
    headers: { Authorization: `Bearer ${token}` },
  });

  return data?.items ?? [];
}

/** 상위 카테고리 선택용: 최상위(parent_id=null) 카테고리만 반환 (2단계 구성) */
export async function fetchRootCategoriesForSelect() {
  const token = await requireAccessToken();

  const { data } = await listCategories({
    query: { page: 1, size: 100, roots_only: true },
    headers: { Authorization: `Bearer ${token}` },
  });

  return data?.items ?? [];
}

export async function addCategory(prevState: {}, formData: FormData) {
  const token = await requireAccessToken();

  const rawParentId = formData.get("parent_id");
  const parentIdForValidation =
    rawParentId === "" || rawParentId === undefined ? undefined : rawParentId;

  const validatedFields = categorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    parent_id: parentIdForValidation,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, description, parent_id } = validatedFields.data;

  const { error } = await createCategory({
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name,
      description: description || null,
      parent_id: parent_id || null,
    },
  });

  if (error) {
    return { message: `${error.detail}` };
  }

  redirect("/categories");
}

export async function removeCategory(id: string) {
  const token = await requireAccessToken();

  const { error } = await deleteCategory({
    headers: { Authorization: `Bearer ${token}` },
    path: { category_id: id },
  });

  if (error) {
    return { message: error };
  }

  revalidatePath("/categories");
}

export async function fetchCategory(categoryId: string) {
  const token = await requireAccessToken();
  const { data, error } = await getCategory({
    headers: { Authorization: `Bearer ${token}` },
    path: { category_id: categoryId },
  });
  if (error) return { message: error };
  return data;
}

export async function editCategory(prevState: {}, formData: FormData) {
  const token = await requireAccessToken();

  const categoryId = String(formData.get("category_id") ?? "").trim();
  if (!categoryId) return { message: "category_id가 필요합니다." };

  const rawParentId = formData.get("parent_id");
  const parentIdForValidation =
    rawParentId === "" || rawParentId === undefined ? undefined : rawParentId;

  const validatedFields = categorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    parent_id: parentIdForValidation,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, description, parent_id } = validatedFields.data;

  const { error } = await updateCategory({
    headers: { Authorization: `Bearer ${token}` },
    path: { category_id: categoryId },
    body: {
      name,
      description: description || null,
      parent_id: parent_id || null,
    },
  });

  if (error) {
    return { message: `${error.detail}` };
  }

  revalidatePath("/categories");
  redirect("/categories");
}
