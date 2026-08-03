"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  size: number;
  initial: { q?: string };
};

export function MappingsSearchForm({ size, initial }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initial.q ?? "");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("size", String(size));
    if (q.trim()) params.set("q", q.trim());
    router.push(`/settlements/mappings?${params.toString()}`);
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4">
      <div className="space-y-2">
        <Label htmlFor="q">검색</Label>
        <Input
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="훈련기관명 / 고객사"
          className="w-64"
        />
      </div>
      <Button type="submit">검색</Button>
    </form>
  );
}
