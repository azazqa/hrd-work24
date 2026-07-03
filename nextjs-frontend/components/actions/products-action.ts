"use server";

import { requireAccessToken } from "@/components/actions/auth-token";
import {
  listProducts,
  createProduct,
  deleteProduct,
  updateProduct,
  listChannels,
  listCategories,
  getProduct,
} from "@/app/clientService";
import type { ProductRead } from "@/app/openapi-client";
import type { ListProductsData } from "@/app/openapi-client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { productSchema } from "@/lib/definitions";

const TAX_RANGE_DEFAULT_MIN = 0;
const TAX_RANGE_DEFAULT_MAX = 100;
const SHIP_RANGE_DEFAULT_MIN = 0;
const SHIP_RANGE_DEFAULT_MAX = 12;

export type ProductListSearch = {
  product_code?: string;
  name?: string;
  description?: string;
  is_tax?: string;
  tax_rate_min?: string;
  tax_rate_max?: string;
  max_shipping_min?: string;
  max_shipping_max?: string;
  state?: string;
};

export async function fetchProducts(
  page: number = 1,
  size: number = 10,
  search?: ProductListSearch,
) {
  const token = await requireAccessToken();

  const query: NonNullable<ListProductsData["query"]> = {
    page,
    size,
  };

  if (search) {
    if (search.product_code?.trim()) {
      query.product_code = search.product_code.trim();
    }
    if (search.name?.trim()) {
      query.name = search.name.trim();
    }
    if (search.description?.trim()) {
      query.description = search.description.trim();
    }
    if (search.is_tax === "true" || search.is_tax === "false") {
      query.is_tax = search.is_tax;
    }
    const hasTaxRange =
      search.tax_rate_min !== undefined || search.tax_rate_max !== undefined;
    if (hasTaxRange) {
      const tMin = Number(
        search.tax_rate_min !== undefined && search.tax_rate_min !== ""
          ? search.tax_rate_min
          : TAX_RANGE_DEFAULT_MIN,
      );
      const tMax = Number(
        search.tax_rate_max !== undefined && search.tax_rate_max !== ""
          ? search.tax_rate_max
          : TAX_RANGE_DEFAULT_MAX,
      );
      if (!Number.isNaN(tMin) && !Number.isNaN(tMax)) {
        if (tMin > tMax) {
          return { message: "세율 최소값은 최대값 이하여야 합니다." };
        }
        if (tMin !== TAX_RANGE_DEFAULT_MIN || tMax !== TAX_RANGE_DEFAULT_MAX) {
          query.tax_rate_min = tMin;
          query.tax_rate_max = tMax;
        }
      }
    }

    const hasShipRange =
      search.max_shipping_min !== undefined ||
      search.max_shipping_max !== undefined;
    if (hasShipRange) {
      const sMin = parseInt(
        search.max_shipping_min !== undefined && search.max_shipping_min !== ""
          ? search.max_shipping_min
          : String(SHIP_RANGE_DEFAULT_MIN),
        10,
      );
      const sMax = parseInt(
        search.max_shipping_max !== undefined && search.max_shipping_max !== ""
          ? search.max_shipping_max
          : String(SHIP_RANGE_DEFAULT_MAX),
        10,
      );
      if (!Number.isNaN(sMin) && !Number.isNaN(sMax)) {
        if (sMin > sMax) {
          return { message: "최대 배송 최소값은 최대값 이하여야 합니다." };
        }
        if (sMin !== SHIP_RANGE_DEFAULT_MIN || sMax !== SHIP_RANGE_DEFAULT_MAX) {
          query.max_shipping_min = sMin;
          query.max_shipping_max = sMax;
        }
      }
    }
    if (
      search.state === "active" ||
      search.state === "inactive" ||
      search.state === "discontinued"
    ) {
      query.state = search.state;
    }
  }

  const { data, error } = await listProducts({
    query,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { message: error };
  }

  return data;
}

export async function fetchProductById(
  productId: string,
): Promise<ProductRead | { message: string }> {
  const token = await requireAccessToken();

  const { data, error } = await getProduct({
    path: { product_id: productId },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return {
      message: String(error?.detail ?? error ?? "상품 정보를 불러오지 못했습니다."),
    };
  }

  if (!data) {
    return { message: "상품 정보를 불러오지 못했습니다." };
  }

  return data;
}

export async function fetchChannelsForSelect() {
  const token = await requireAccessToken();

  const { data } = await listChannels({
    query: { page: 1, size: 100 },
    headers: { Authorization: `Bearer ${token}` },
  });

  return data?.items || [];
}

export async function fetchCategoriesForSelect() {
  const token = await requireAccessToken();

  const { data } = await listCategories({
    query: { page: 1, size: 100 },
    headers: { Authorization: `Bearer ${token}` },
  });

  return data?.items || [];
}

export async function addProduct(prevState: {}, formData: FormData) {
  const token = await requireAccessToken();

  const validatedFields = productSchema.safeParse({
    product_code: formData.get("product_code"),
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price") || undefined,
    category_id: formData.get("category_id"),
    is_tax: formData.get("is_tax") === "on",
    tax_rate: formData.get("tax_rate") || undefined,
    max_shipping_number: formData.get("max_shipping_number") || undefined,
    state: formData.get("state") || "active",
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { product_code, name, description, price, category_id, is_tax, tax_rate, max_shipping_number, state } =
    validatedFields.data;

  const { error } = await createProduct({
    headers: { Authorization: `Bearer ${token}` },
    body: {
      product_code,
      name,
      description: description || null,
      price,
      category_id,
      is_tax,
      tax_rate: tax_rate ?? null,
      max_shipping_number: max_shipping_number ?? null,
      state,
    },
  });

  if (error) {
    return { message: `${error.detail}` };
  }

  redirect("/products");
}

export async function updateProductAction(
  prevState: { message?: string; errors?: Record<string, string[]> } | {},
  formData: FormData,
) {
  const token = await requireAccessToken();
  const productId = String(formData.get("product_id") ?? "").trim();
  if (!productId) {
    return { message: "상품 ID가 없습니다." };
  }

  const validatedFields = productSchema.safeParse({
    product_code: formData.get("product_code"),
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price") || undefined,
    category_id: formData.get("category_id"),
    is_tax: formData.get("is_tax") === "on",
    tax_rate: formData.get("tax_rate") || undefined,
    max_shipping_number: formData.get("max_shipping_number") || undefined,
    state: formData.get("state") || "active",
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const {
    product_code,
    name,
    description,
    price,
    category_id,
    is_tax,
    tax_rate,
    max_shipping_number,
    state,
  } = validatedFields.data;

  const { error } = await updateProduct({
    path: { product_id: productId },
    headers: { Authorization: `Bearer ${token}` },
    body: {
      product_code,
      name,
      description: description || null,
      price,
      category_id,
      is_tax,
      tax_rate: tax_rate ?? null,
      max_shipping_number: max_shipping_number ?? null,
      state,
    },
  });

  if (error) {
    return { message: String((error as any)?.detail ?? error ?? "상품 수정에 실패했습니다.") };
  }

  revalidatePath("/products");
  return { message: "" };
}

export async function removeProduct(id: string) {
  const token = await requireAccessToken();

  const { error } = await deleteProduct({
    headers: { Authorization: `Bearer ${token}` },
    path: { product_id: id },
  });

  if (error) {
    return { message: error };
  }

  revalidatePath("/products");
}
