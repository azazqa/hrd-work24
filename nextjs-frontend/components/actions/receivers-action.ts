"use server";

import { requireAccessToken } from "@/components/actions/auth-token";
import {
  listReceivers,
  createReceiver,
  deleteReceiver,
} from "@/app/clientService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { receiverSchema } from "@/lib/definitions";

export async function fetchReceivers(page: number = 1, size: number = 10) {
  const token = await requireAccessToken();

  const { data, error } = await listReceivers({
    query: { page, size },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { message: error };
  }

  return data;
}

export async function addReceiver(prevState: {}, formData: FormData) {
  const token = await requireAccessToken();

  const validatedFields = receiverSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    zip_code: formData.get("zip_code"),
    address: formData.get("address"),
    address_detail: formData.get("address_detail"),
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, phone, zip_code, address, address_detail, email } =
    validatedFields.data;

  const { error } = await createReceiver({
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name,
      phone,
      zip_code,
      address,
      address_detail: address_detail || null,
      email: email || null,
    },
  });

  if (error) {
    return { message: `${error.detail}` };
  }

  redirect("/receivers");
}

export async function removeReceiver(id: string) {
  const token = await requireAccessToken();

  const { error } = await deleteReceiver({
    headers: { Authorization: `Bearer ${token}` },
    path: { receiver_id: id },
  });

  if (error) {
    return { message: error };
  }

  revalidatePath("/receivers");
}
