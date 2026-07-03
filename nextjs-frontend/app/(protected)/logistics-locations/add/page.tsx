"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addLogisticsLocation } from "@/components/actions/logistics-locations-action";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submitButton";
import Link from "next/link";

const formInitialState = { message: "" };

export default function AddLogisticsLocationPage() {
  const [state, dispatch] = useActionState(addLogisticsLocation, formInitialState);
  const [locationState, setLocationState] = useState<"active" | "inactive">("active");

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-white">
            물류지 등록
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            물류지(창고/배송지) 정보를 입력해주세요.
          </p>
        </header>

        <form
          action={dispatch}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6"
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">
                물류지명<span className="relative -top-1 text-sm text-red-500">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="예: 본사 창고, A동"
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
                placeholder="설명 (선택)"
                className="w-full border-gray-300 dark:border-gray-600"
              />
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="state"
                className="text-gray-700 dark:text-gray-300"
              >
                상태
              </Label>
              <Select
                value={locationState}
                onValueChange={(v) => setLocationState(v as "active" | "inactive")}
              >
                <SelectTrigger className="w-full border-gray-300 dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">사용</SelectItem>
                  <SelectItem value="inactive">미사용</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="state" value={locationState} />
            </div>
          </div>

          <div className="flex gap-3">
            <SubmitButton text="등록" />
            <Link href="/logistics-locations" className="w-full">
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
