"use client";

import { useState } from "react";
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
import { addCategory } from "@/components/actions/categories-action";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submitButton";
import Link from "next/link";

interface CategoryOption {
  id: string;
  name: string;
}

interface CategoryFormProps {
  categories: CategoryOption[];
}

const initialState = { message: "" };

const NO_PARENT_VALUE = "__none__";

export function CategoryForm({ categories }: CategoryFormProps) {
  const [state, dispatch] = useActionState(addCategory, initialState);
  const [parentId, setParentId] = useState<string>(NO_PARENT_VALUE);

  return (
    <form
      action={dispatch}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6"
    >
      <input type="hidden" name="parent_id" value={parentId === NO_PARENT_VALUE ? "" : parentId} />
      <div className="space-y-6">
        <div className="space-y-3">
          <Label
            htmlFor="parent_id"
            className="text-gray-700 dark:text-gray-300"
          >
            상위 카테고리
          </Label>
          <Select
            value={parentId}
            onValueChange={setParentId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="상위 카테고리 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={NO_PARENT_VALUE}>상위 없음</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
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
            placeholder="예: 의류, 전자제품"
            required
            className="w-full border-gray-300 dark:border-gray-600"
          />
          {state.errors?.name && (
            <p className="text-red-500 text-sm">{state.errors.name}</p>
          )}
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="description"
            className="text-gray-700 dark:text-gray-300"
          >
            설명
          </Label>
          <Input
            id="description"
            name="description"
            type="text"
            placeholder="카테고리에 대한 설명 (선택)"
            className="w-full border-gray-300 dark:border-gray-600"
          />
          {state.errors?.description && (
            <p className="text-red-500 text-sm">
              {state.errors.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <SubmitButton text="등록" />
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
