"use server";

import { requireAccessToken } from "@/components/actions/auth-token";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { productAliasDictSchema } from "@/lib/definitions";
import {
  listProducts,
  listProductAliasDicts,
  createProductAliasDict,
  deleteProductAliasDict,
  updateProductAliasDict,
} from "@/app/clientService";
import { z } from "zod";

export interface ProductAliasDictDto {
  id: string;
  alias_id?: string | null;
  channel_id?: string | null;
  channel_name?: string | null;
  product_id: string;
  alias: string;
  price?: number | null;
  commission?: number | null;
  quantity?: number;
  created_at: string;
  updated_at: string;
  product_name?: string | null;
  product_price?: number | null;
}

interface PageProductAliasDictRead {
  items: ProductAliasDictDto[];
  total?: number;
}

export type ProductAliasDictListSearch = {
  alias?: string;
  product_name?: string;
  channel_ids?: string[];
  channel_id?: string; // backward-compatible
};

export async function fetchProductAliasDicts(
  page: number = 1,
  size: number = 10,
  search?: ProductAliasDictListSearch,
): Promise<PageProductAliasDictRead | { message: string }> {
  const token = await requireAccessToken();

  const query: {
    page: number;
    size: number;
    alias?: string;
    product_name?: string;
    channel_id?: string;
    channel_ids?: string;
  } = {
    page,
    size,
  };
  if (search?.alias?.trim()) {
    query.alias = search.alias.trim();
  }
  if (search?.product_name?.trim()) {
    query.product_name = search.product_name.trim();
  }
  const channelIds = (search?.channel_ids ?? []).map((s) => s.trim()).filter(Boolean);
  if (channelIds.length > 0) {
    query.channel_ids = channelIds.join(",");
  } else if (search?.channel_id?.trim()) {
    query.channel_id = search.channel_id.trim();
  }

  const { data, error } = await listProductAliasDicts({
    query: query as any,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { message: String(error?.detail ?? error ?? "Failed to fetch product alias dicts") };
  }

  return data as PageProductAliasDictRead;
}

/** 선택된 상품의 별칭 목록만 조회 (product_id 필터) */
export async function fetchProductAliasDictsByProductId(
  productId: string,
): Promise<ProductAliasDictDto[]> {
  const token = await requireAccessToken();

  const { data, error } = await listProductAliasDicts({
    query: { page: 1, size: 100, product_id: productId },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) return [];
  return (data?.items ?? []) as ProductAliasDictDto[];
}

export type ProductOption = { id: string; name: string; price?: number | null };

export async function fetchProductsForAliasSelect(): Promise<ProductOption[]> {
  const token = await requireAccessToken();

  const { data } = await listProducts({
    query: { page: 1, size: 100 },
    headers: { Authorization: `Bearer ${token}` },
  });
  const items = data?.items ?? [];
  return items.map((p: { id: string; name: string; price?: number | null }) => ({
    id: p.id,
    name: p.name,
    price: p.price ?? 0,
  }));
}

type AddProductAliasDictState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export async function addProductAliasDict(
  _prevState: AddProductAliasDictState,
  formData: FormData
): Promise<AddProductAliasDictState> {
  const token = await requireAccessToken();

  const validated = productAliasDictSchema.safeParse({
    channel_id: formData.get("channel_id") ?? undefined,
    alias: formData.get("alias"),
    price: formData.get("price") ?? undefined,
    commission: formData.get("commission") ?? undefined,
    items_json: formData.get("items_json"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { channel_id, alias, price, commission, items_json } = validated.data;
  const channelId =
    typeof channel_id === "string" && channel_id.trim().length > 0
      ? channel_id.trim()
      : undefined;
  const commissionValue =
    typeof commission === "number" && Number.isInteger(commission) ? commission : undefined;

  let items: Array<{ product_id: string; quantity: number }> = [];
  try {
    const parsed = JSON.parse(items_json) as unknown;
    const itemsSchema = z
      .array(
        z.object({
          product_id: z.string().min(1, { message: "상품을 선택해주세요" }),
          quantity: z
            .number()
            .int()
            .positive({ message: "수량은 1 이상의 정수여야 합니다" }),
        }),
      )
      .min(1, { message: "상품을 한 개 이상 추가해주세요" });
    const parsedResult = itemsSchema.safeParse(parsed);
    if (!parsedResult.success) {
      const fieldErrors = parsedResult.error.flatten().fieldErrors as unknown as Record<
        string,
        string[] | undefined
      >;
      return {
        errors: {
          items: fieldErrors[""] ?? ["상품/수량 정보를 확인해주세요"],
        },
      };
    }
    items = parsedResult.data;
  } catch {
    return {
      errors: {
        items: ["상품/수량 정보를 확인해주세요"],
      },
    };
  }

  // 동일 별칭으로 여러 상품을 한 번에 등록
  for (const it of items) {
    const { error } = await createProductAliasDict({
      body:
        price === undefined
          ? {
              product_id: it.product_id,
              alias,
              quantity: it.quantity,
              ...(channelId ? { channel_id: channelId } : {}),
              ...(commissionValue !== undefined ? { commission: commissionValue } : {}),
            }
          : {
              product_id: it.product_id,
              alias,
              quantity: it.quantity,
              price,
              ...(channelId ? { channel_id: channelId } : {}),
              ...(commissionValue !== undefined ? { commission: commissionValue } : {}),
            },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) {
      return { message: String(error?.detail ?? error ?? "등록 실패") };
    }
  }

  revalidatePath("/product-alias-dicts");
  redirect("/product-alias-dicts");
}

export async function removeProductAliasDict(id: string) {
  const token = await requireAccessToken();

  const { error } = await deleteProductAliasDict({
    headers: { Authorization: `Bearer ${token}` },
    path: { alias_item_id: id },
  });
  if (error) {
    return { message: String(error?.detail ?? error ?? "삭제 실패") };
  }

  revalidatePath("/product-alias-dicts");
}

/** 별칭(dict) 단위 삭제: 동일 alias의 item들을 모두 삭제 */
export async function removeProductAliasDictGroup(alias: string) {
  const token = await requireAccessToken();
  const a = String(alias ?? "").trim();
  if (!a) return { message: "별칭이 없습니다." };

  // alias로 해당 그룹 item들을 최대 100개까지 조회 후 모두 삭제
  const { data, error } = await listProductAliasDicts({
    query: { page: 1, size: 100, alias: a },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    return { message: String(error?.detail ?? error ?? "삭제 대상 조회 실패") };
  }

  const items = (data?.items ?? []) as Array<{ id: string; alias: string }>;
  const targets = items.filter((it) => String(it.alias ?? "").trim() === a);

  for (const it of targets) {
    const r = await deleteProductAliasDict({
      headers: { Authorization: `Bearer ${token}` },
      path: { alias_item_id: it.id },
    });
    if (r.error) {
      return { message: String(r.error?.detail ?? r.error ?? "삭제 실패") };
    }
  }

  revalidatePath("/product-alias-dicts");
  return { message: "" };
}

/** 별칭(dict) 단위 수정: 대표 item 하나를 통해 alias 문자열을 수정 */
export async function updateProductAliasDictGroup(args: {
  representativeAliasItemId: string;
  alias: string;
}) {
  const token = await requireAccessToken();
  const id = String(args.representativeAliasItemId ?? "").trim();
  const alias = String(args.alias ?? "").trim();
  if (!id) return { message: "별칭 항목 ID가 없습니다." };
  if (!alias) return { message: "별칭을 입력해주세요." };

  const { error } = await updateProductAliasDict({
    path: { alias_item_id: id },
    headers: { Authorization: `Bearer ${token}` },
    body: { alias },
  });
  if (error) {
    return { message: String(error?.detail ?? error ?? "수정 실패") };
  }

  revalidatePath("/product-alias-dicts");
  return { message: "" };
}

export async function updateProductAliasDictGroupDetailed(args: {
  originalAlias: string;
  originalChannelId?: string | null;
  channel_id?: string | null;
  alias: string;
  price?: number | null;
  commission?: number | null;
  items: Array<{ product_id: string; quantity: number }>;
}) {
  const token = await requireAccessToken();
  const originalAlias = String(args.originalAlias ?? "").trim();
  const originalChannelId =
    typeof args.originalChannelId === "string" && args.originalChannelId.trim().length > 0
      ? args.originalChannelId.trim()
      : undefined;
  const nextChannelId =
    typeof args.channel_id === "string" && args.channel_id.trim().length > 0
      ? args.channel_id.trim()
      : undefined;
  const nextAlias = String(args.alias ?? "").trim();
  const hasPrice = args.price !== undefined && args.price !== null && String(args.price) !== "";
  const price = hasPrice ? Number(args.price) : undefined;
  const hasCommission =
    args.commission !== undefined && args.commission !== null && String(args.commission) !== "";
  const commission = hasCommission ? Number(args.commission) : undefined;
  if (!originalAlias) return { message: "기존 별칭이 없습니다." };
  if (!nextAlias) return { message: "별칭을 입력해주세요." };
  if (
    hasPrice &&
    (price === undefined || !Number.isInteger(price) || (price as number) < 0)
  ) {
    return { message: "가격은 0 이상의 정수여야 합니다." };
  }

  const desired = (args.items ?? []).filter((it) => it.product_id && it.quantity > 0);
  if (desired.length === 0) return { message: "상품을 한 개 이상 추가해주세요." };

  // 현재 그룹 로드 (최대 100개)
  const { data, error } = await listProductAliasDicts({
    query: {
      page: 1,
      size: 100,
      alias: originalAlias,
      ...(originalChannelId ? { channel_id: originalChannelId } : {}),
    } as any,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) return { message: String(error?.detail ?? error ?? "조회 실패") };

  const current = ((data?.items ?? []) as ProductAliasDictDto[]).filter(
    (it) => String(it.alias ?? "").trim() === originalAlias,
  );
  if (current.length === 0) return { message: "수정할 별칭을 찾지 못했습니다." };

  const repId = String(current[0]!.id);
  const byProductId = new Map<string, ProductAliasDictDto>();
  for (const it of current) {
    byProductId.set(String(it.product_id), it);
  }

  // 1) 헤더(alias, price) 갱신은 대표 item 하나로 처리
  const head = await updateProductAliasDict({
    path: { alias_item_id: repId },
    headers: { Authorization: `Bearer ${token}` },
    body: {
      alias: nextAlias,
      ...(hasPrice ? { price } : {}),
      ...(hasCommission ? { commission } : {}),
      ...(nextChannelId !== undefined ? { channel_id: nextChannelId } : {}),
    } as any,
  });
  if (head.error) return { message: String(head.error?.detail ?? head.error ?? "수정 실패") };

  // 2) item reconcile: update qty / create missing / delete removed
  const desiredProductIds = new Set(desired.map((d) => d.product_id));

  for (const d of desired) {
    const existing = byProductId.get(d.product_id);
    if (existing) {
      const r = await updateProductAliasDict({
        path: { alias_item_id: String(existing.id) },
        headers: { Authorization: `Bearer ${token}` },
        body: { quantity: d.quantity },
      });
      if (r.error) return { message: String(r.error?.detail ?? r.error ?? "수정 실패") };
    } else {
      const r = await createProductAliasDict({
        headers: { Authorization: `Bearer ${token}` },
        body: {
          alias: nextAlias,
          product_id: d.product_id,
          quantity: d.quantity,
          ...(hasPrice ? { price } : {}),
          ...(hasCommission ? { commission } : {}),
          ...(nextChannelId !== undefined ? { channel_id: nextChannelId } : {}),
        } as any,
      });
      if (r.error) return { message: String(r.error?.detail ?? r.error ?? "추가 실패") };
    }
  }

  for (const it of current) {
    if (!desiredProductIds.has(String(it.product_id))) {
      const r = await deleteProductAliasDict({
        headers: { Authorization: `Bearer ${token}` },
        path: { alias_item_id: String(it.id) },
      });
      if (r.error) return { message: String(r.error?.detail ?? r.error ?? "삭제 실패") };
    }
  }

  revalidatePath("/product-alias-dicts");
  return { message: "" };
}

