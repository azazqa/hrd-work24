import type {
  AuthJwtLoginError,
  ResetForgotPasswordError,
  ResetResetPasswordError,
} from "@/app/clientService";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ClientApiError =
  | AuthJwtLoginError
  | ResetForgotPasswordError
  | ResetResetPasswordError;

export function getErrorMessage(error: ClientApiError): string {
  let errorMessage = "An unknown error occurred";

  const detail = error.detail;
  if (typeof detail === "string") {
    errorMessage =
      detail === "LOGIN_BAD_CREDENTIALS"
        ? "로그인 아이디 또는 비밀번호가 올바르지 않습니다."
        : detail;
  } else if (Array.isArray(detail) && detail.length > 0) {
    const parts = detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String(d.msg) : ""))
      .filter(Boolean);
    if (parts.length > 0) {
      errorMessage = parts.join("; ");
    }
  } else if (typeof detail === "object" && detail !== null && "reason" in detail) {
    errorMessage = String((detail as { reason: string }).reason);
  }

  if (errorMessage === "An unknown error occurred") {
    const maybeAxios = error as { message?: string };
    if (maybeAxios.message) {
      return `백엔드 API 연결 실패: ${maybeAxios.message}`;
    }
  }

  return errorMessage;
}

export function makeClientId(): string {
  // Some runtimes expose crypto without randomUUID.
  if (
    typeof globalThis !== "undefined" &&
    "crypto" in globalThis &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}