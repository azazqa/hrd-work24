"use server";

import { requireAccessToken } from "@/components/actions/auth-token";
import {
  listLogisticsLocations,
  createLogisticsLocation,
  deleteLogisticsLocation,
} from "@/app/clientService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function fetchLogisticsLocations(
  page: number = 1,
  size: number = 10,
  search?: { name?: string; description?: string },
) {
  const token = await requireAccessToken();

  const query: Record<string, unknown> = { page, size };
  if (search?.name?.trim()) {
    query.name = search.name.trim();
  }
  if (search?.description?.trim()) {
    query.description = search.description.trim();
  }

  const { data, error } = await listLogisticsLocations({
    query: query as any,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { message: String(error?.detail ?? error) };
  }

  return data;
}

export async function fetchLogisticsLocationsForSelect() {
  const result = await fetchLogisticsLocations(1, 100);
  if ("message" in result) return [];
  return result.items ?? [];
}

type AddLogisticsLocationState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export async function addLogisticsLocation(
  _prevState: AddLogisticsLocationState,
  formData: FormData
): Promise<AddLogisticsLocationState> {
  const token = await requireAccessToken();

  const name = formData.get("name") as string | null;
  const description = (formData.get("description") as string) || null;
  const state = (formData.get("state") as string) || "active";

  if (!name?.trim()) {
    return { errors: { name: ["물류지명을 입력해주세요"] } };
  }

  const { error } = await createLogisticsLocation({
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name: name.trim(),
      description: description?.trim() || null,
      courier_id: null,
      state: state === "inactive" ? "inactive" : "active",
    },
  });

  if (error) {
    return { message: String(error?.detail ?? error) };
  }

  revalidatePath("/logistics-locations");
  redirect("/logistics-locations");
}

export async function removeLogisticsLocation(id: string) {
  const token = await requireAccessToken();

  const { error } = await deleteLogisticsLocation({
    headers: { Authorization: `Bearer ${token}` },
    path: { location_id: id },
  });

  if (error) {
    return { message: String(error) };
  }

  revalidatePath("/logistics-locations");
}
