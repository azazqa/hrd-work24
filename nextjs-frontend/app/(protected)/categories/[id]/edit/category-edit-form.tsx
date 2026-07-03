"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submitButton";
import { editCategory } from "@/components/actions/categories-action";

interface CategoryOption {
  id: string;
  name: string;
}

interface CategoryInitial {
  id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
}

interface CategoryEditFormProps {
  category: CategoryInitial;
  rootCategories: CategoryOption[];
}

const initialState = { message: "" };
const NO_PARENT_VALUE = "__none__";

export function CategoryEditForm({ category, rootCategories }: CategoryEditFormProps) {
  const [state, dispatch] = useActionState(editCategory, initialState);

  const initialParentId = category.parent_id ? String(category.parent_id) : NO_PARENT_VALUE;
  const [parentId, setParentId] = useState<string>(initialParentId);

  const parentOptions = useMemo(
    () => rootCategories.filter((c) => c.id !== category.id),
    [rootCategories, category.id],
  );

  return (
    <form action={dispatch} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6">
      <input type="hidden" name="category_id" value={category.id} />
      <input type="hidden" name="parent_id" value={parentId === NO_PARENT_VALUE ? "" : parentId} />

      <div className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor="parent_id" className="text-gray-700 dark:text-gray-300">
            상위 카테고리
          </Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="상위 카테고리 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={NO_PARENT_VALUE}>상위 없음</SelectItem>
                {parentOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {state.errors?.parent_id && (
            <p className="text-red-500 text-sm">{state.errors.parent_id}</p>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">
            카테고리명<span className="relative -top-1 text-sm text-red-500">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={category.name}
            className="w-full border-gray-300 dark:border-gray-600"
          />
          {state.errors?.name && <p className="text-red-500 text-sm">{state.errors.name}</p>}
        </div>

        <div className="space-y-3">
          <Label htmlFor="description" className="text-gray-700 dark:text-gray-300">
            설명
          </Label>
          <Input
            id="description"
            name="description"
            type="text"
            defaultValue={category.description ?? ""}
            className="w-full border-gray-300 dark:border-gray-600"
          />
          {state.errors?.description && (
            <p className="text-red-500 text-sm">{state.errors.description}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <SubmitButton text="저장" />
        <Link href="/categories" className="w-full">
          <Button variant="outline" type="button" className="w-full">
            취소
          </Button>
        </Link>
      </div>

      {state?.message && (
        <div className="mt-2 text-center text-sm text-red-500">
          <p>{state.message}</p>
        </div>
      )}
    </form>
  );
}

