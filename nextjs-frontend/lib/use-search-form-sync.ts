"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SearchFieldValue = string | string[] | boolean | undefined | null;

export function buildSearchQuery(
  size: number,
  fields: Record<string, SearchFieldValue>,
): string {
  const q = new URLSearchParams();
  q.set("page", "1");
  q.set("size", String(size));

  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (typeof value === "boolean") {
      if (value) q.set(key, "true");
      continue;
    }
    if (Array.isArray(value)) {
      const items = value.map((s) => s.trim()).filter(Boolean);
      if (items.length > 0) q.set(key, items.join(","));
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) q.set(key, trimmed);
  }

  return q.toString();
}

export function useSearchFormSync<TForm, TInitial>({
  basePath,
  size,
  initial,
  fromInitial,
  buildQueryString,
  buildResetQueryString,
  resetForm,
}: {
  basePath: string;
  size: number;
  initial: TInitial;
  fromInitial: (initial: TInitial) => TForm;
  buildQueryString: (form: TForm, size: number) => string;
  buildResetQueryString?: (size: number) => string;
  resetForm?: () => TForm;
}) {
  const router = useRouter();
  const snapshot = JSON.stringify(initial);
  const [form, setForm] = useState<TForm>(() => fromInitial(initial));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setForm(fromInitial(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  const navigate = (url: string) => {
    startTransition(() => {
      router.push(url);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`${basePath}?${buildQueryString(form, size)}`);
  };

  const handleReset = () => {
    setForm(resetForm ? resetForm() : fromInitial({} as TInitial));
    const qs = buildResetQueryString
      ? buildResetQueryString(size)
      : `page=1&size=${size}`;
    navigate(`${basePath}?${qs}`);
  };

  return { form, setForm, handleSubmit, handleReset, isPending, navigate };
}
