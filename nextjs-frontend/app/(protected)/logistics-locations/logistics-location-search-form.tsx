"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type FormState = {
  name: string;
  description: string;
};

export type LogisticsLocationSearchInitial = Partial<FormState>;

function fromInitial(initial: LogisticsLocationSearchInitial): FormState {
  return {
    name: initial.name ?? "",
    description: initial.description ?? "",
  };
}

function buildSearchQueryString(form: FormState, size: number): string {
  const q = new URLSearchParams();
  q.set("page", "1");
  q.set("size", String(size));

  if (form.name.trim()) q.set("name", form.name.trim());
  if (form.description.trim()) q.set("description", form.description.trim());

  return q.toString();
}

export function LogisticsLocationSearchForm({
  initial,
  size,
}: {
  initial: LogisticsLocationSearchInitial;
  size: number;
}) {
  const router = useRouter();
  const snapshot = JSON.stringify(initial);
  const [form, setForm] = useState<FormState>(() => fromInitial(initial));

  useEffect(() => {
    setForm(fromInitial(initial));
  }, [snapshot]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/logistics-locations?${buildSearchQueryString(form, size)}`);
  };

  const handleReset = () => {
    setForm({ name: "", description: "" });
    router.push(`/logistics-locations?page=1&size=${size}`);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-8">
      <div className="lg:col-span-7">
        <FieldGroup>
          <FieldSet>
            <FieldGroup>
              <div className="flex flex-wrap gap-4">
                <Field className="w-[260px]">
                  <FieldLabel htmlFor="name">물류지명</FieldLabel>
                  <Input
                    id="name"
                    placeholder="부분 일치"
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </Field>
                <Field className="w-[360px]">
                  <FieldLabel htmlFor="description">설명</FieldLabel>
                  <Input
                    id="description"
                    placeholder="부분 일치"
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        </FieldGroup>
      </div>

      <Field orientation="horizontal" className="items-end gap-2 lg:col-span-1">
        <Button
          type="button"
          variant="outline"
          className="min-w-0 flex-1"
          onClick={handleReset}
        >
          초기화
        </Button>
        <Button type="submit" className="min-w-0 flex-1">
          검색
        </Button>
      </Field>
    </form>
  );
}

