"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { addReceiver } from "@/components/actions/receivers-action";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submitButton";
import Link from "next/link";

const initialState = { message: "" };

export default function CreateReceiverPage() {
  const [state, dispatch] = useActionState(addReceiver, initialState);

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-white">
            수취인 등록
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            주문 수취인 정보를 입력해주세요.
          </p>
        </header>

        <form
          action={dispatch}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label
                  htmlFor="name"
                  className="text-gray-700 dark:text-gray-300"
                >
                  수취인명<span className="relative -top-1 text-sm text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="수취인 이름"
                  required
                  className="w-full border-gray-300 dark:border-gray-600"
                />
                {state.errors?.name && (
                  <p className="text-red-500 text-sm">{state.errors.name}</p>
                )}
              </div>
              <div className="space-y-3">
                <Label
                  htmlFor="phone"
                  className="text-gray-700 dark:text-gray-300"
                >
                  연락처<span className="relative -top-1 text-sm text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="text"
                  placeholder="010-0000-0000"
                  required
                  className="w-full border-gray-300 dark:border-gray-600"
                />
                {state.errors?.phone && (
                  <p className="text-red-500 text-sm">{state.errors.phone}</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="zip_code"
                className="text-gray-700 dark:text-gray-300"
              >
                우편번호<span className="relative -top-1 text-sm text-red-500">*</span>
              </Label>
              <Input
                id="zip_code"
                name="zip_code"
                type="text"
                placeholder="우편번호"
                required
                className="w-full border-gray-300 dark:border-gray-600"
              />
              {state.errors?.zip_code && (
                <p className="text-red-500 text-sm">
                  {state.errors.zip_code}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="address"
                className="text-gray-700 dark:text-gray-300"
              >
                주소<span className="relative -top-1 text-sm text-red-500">*</span>
              </Label>
              <Input
                id="address"
                name="address"
                type="text"
                placeholder="기본 주소"
                required
                className="w-full border-gray-300 dark:border-gray-600"
              />
              {state.errors?.address && (
                <p className="text-red-500 text-sm">{state.errors.address}</p>
              )}
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="address_detail"
                className="text-gray-700 dark:text-gray-300"
              >
                상세주소
              </Label>
              <Input
                id="address_detail"
                name="address_detail"
                type="text"
                placeholder="상세주소 (선택)"
                className="w-full border-gray-300 dark:border-gray-600"
              />
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="email"
                className="text-gray-700 dark:text-gray-300"
              >
                이메일
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="email@example.com (선택)"
                className="w-full border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <SubmitButton text="등록" />
            <Link href="/receivers" className="w-full">
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
