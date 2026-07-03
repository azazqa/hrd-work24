"use server";

import { requireAccessToken } from "@/components/actions/auth-token";
import {
  listChannels,
  createChannel,
  getChannel,
  updateChannel,
} from "@/app/clientService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { channelSchema } from "@/lib/definitions";
import { parseOrderExcelMappingJson } from "@/lib/order-excel-mapping";

export type ChannelListSearch = {
  name?: string;
  description?: string;
  courier_name?: string;
};

export async function fetchChannels(
  page: number = 1,
  size: number = 10,
  search?: ChannelListSearch,
) {
  const token = await requireAccessToken();

  const query: Record<string, unknown> = { page, size };
  if (search?.name?.trim()) query.name = search.name.trim();
  if (search?.description?.trim()) query.description = search.description.trim();
  if (search?.courier_name?.trim()) query.courier_name = search.courier_name.trim();

  const { data, error } = await listChannels({
    query: query as any,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { message: error };
  }

  return data;
}

export async function fetchChannelById(id: string) {
  const token = await requireAccessToken();
  const { data, error } = await getChannel({
    path: { channel_id: id },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    const d = error.detail;
    const msg =
      typeof d === "string"
        ? d
        : d && typeof d === "object" && "reason" in d
          ? String((d as { reason: string }).reason)
          : "채널을 불러오지 못했습니다.";
    return { message: msg };
  }
  return data;
}

export async function addChannel(prevState: {}, formData: FormData) {
  const token = await requireAccessToken();

  const validatedFields = channelSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    url: formData.get("url"),
    courier_id: formData.get("courier_id") || undefined,
    order_excel_mapping: formData.get("order_excel_mapping") ?? undefined,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, description, url, courier_id, order_excel_mapping: mappingRaw } =
    validatedFields.data;

  const mappingStr =
    mappingRaw == null || String(mappingRaw).trim() === ""
      ? ""
      : String(mappingRaw).trim();
  const mappingParsed = parseOrderExcelMappingJson(mappingStr);
  if (!mappingParsed.success) {
    return {
      errors: { order_excel_mapping: [mappingParsed.message] },
    };
  }

  const { error } = await createChannel({
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name,
      description: description || null,
      url: url ?? null,
      courier_id: courier_id || null,
      order_excel_mapping: mappingParsed.data,
    },
  });

  if (error) {
    return { message: `${error.detail}` };
  }

  redirect("/channels");
}

export async function updateChannelAction(prevState: {}, formData: FormData) {
  const token = await requireAccessToken();
  const channelId = formData.get("channel_id");
  if (!channelId || typeof channelId !== "string") {
    return { message: "channel_id가 없습니다." };
  }

  const validatedFields = channelSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    url: formData.get("url"),
    courier_id: formData.get("courier_id") || undefined,
    order_excel_mapping: formData.get("order_excel_mapping") ?? undefined,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, description, url, courier_id, order_excel_mapping: mappingRaw } =
    validatedFields.data;

  const mappingStr =
    mappingRaw == null || String(mappingRaw).trim() === ""
      ? ""
      : String(mappingRaw).trim();
  const mappingParsed = parseOrderExcelMappingJson(mappingStr);
  if (!mappingParsed.success) {
    return {
      errors: { order_excel_mapping: [mappingParsed.message] },
    };
  }

  const { error } = await updateChannel({
    headers: { Authorization: `Bearer ${token}` },
    path: { channel_id: channelId },
    body: {
      name,
      description: description ?? null,
      url: url ?? null,
      courier_id: courier_id || null,
      order_excel_mapping: mappingParsed.data,
    },
  });

  if (error) {
    const d = error.detail;
    const msg = typeof d === "string" ? d : JSON.stringify(d);
    return { message: msg };
  }

  revalidatePath("/channels");
  redirect("/channels");
}
