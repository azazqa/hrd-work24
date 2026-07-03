"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { addCourier } from "@/components/actions/couriers-action";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submitButton";
import Link from "next/link";

const initialState = { message: "" };

export default function AddCourierPage() {
  const [state, dispatch] = useActionState(addCourier, initialState);

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-white">
            택배사 등록
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            택배사 정보를 입력해주세요.
          </p>
        </header>

        <form
          action={dispatch}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6"
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">
                택배사명<span className="relative -top-1 text-sm text-red-500">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="예: CJ대한통운, 한진택배"
                required
                className="w-full border-gray-300 dark:border-gray-600"
              />
              {state.errors?.name && (
                <p className="text-red-500 text-sm">{state.errors.name}</p>
              )}
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="url"
                className="text-gray-700 dark:text-gray-300"
              >
                배송조회 URL
              </Label>
              <Input
                id="url"
                name="url"
                type="url"
                placeholder="https://..."
                className="w-full border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <SubmitButton text="등록" />
            <Link href="/couriers" className="w-full">
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
      </div>
    </div>
  );
}
