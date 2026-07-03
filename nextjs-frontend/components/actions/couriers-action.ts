"use server";

import { requireAccessToken } from "@/components/actions/auth-token";
import {
  listCouriers,
  createCourier,
  deleteCourier,
} from "@/app/clientService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function fetchCouriers(page: number = 1, size: number = 10) {
  const token = await requireAccessToken();

  const { data, error } = await listCouriers({
    query: { page, size },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { message: String(error?.detail ?? error) };
  }

  return data;
}

export async function fetchCouriersForSelect(): Promise<
  { id: string; name: string }[]
> {
  const token = await requireAccessToken();

  const { data } = await listCouriers({
    query: { page: 1, size: 100 },
    headers: { Authorization: `Bearer ${token}` },
  });
  const items = data?.items ?? [];
  return items.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));
}

type AddCourierState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export async function addCourier(
  _prevState: AddCourierState,
  formData: FormData
): Promise<AddCourierState> {
  const token = await requireAccessToken();

  const name = formData.get("name") as string | null;
  const url = (formData.get("url") as string) || null;

  if (!name?.trim()) {
    return { errors: { name: ["택배사명을 입력해주세요"] } };
  }

  const { error } = await createCourier({
    headers: { Authorization: `Bearer ${token}` },
    body: { name: name.trim(), url: url?.trim() || null },
  });

  if (error) {
    return { message: String(error?.detail ?? error) };
  }

  revalidatePath("/couriers");
  redirect("/couriers");
}

export async function removeCourier(id: string) {
  const token = await requireAccessToken();

  const { error } = await deleteCourier({
    headers: { Authorization: `Bearer ${token}` },
    path: { courier_id: id },
  });

  if (error) {
    return { message: String(error) };
  }

  revalidatePath("/couriers");
}
