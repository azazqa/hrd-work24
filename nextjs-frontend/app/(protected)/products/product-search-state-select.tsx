"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

function normalizeInitial(state: string | undefined): string {
  if (state === "active" || state === "inactive" || state === "discontinued") {
    return state;
  }
  return ALL;
}

type Props = {
  defaultState?: string;
  /** 제어 모드: 폼 초기화 등에서 상위가 값을 직접 관리 */
  value?: string;
  onValueChange?: (v: string) => void;
};

export function ProductSearchStateSelect({
  defaultState,
  value: valueProp,
  onValueChange,
}: Props) {
  const controlled =
    valueProp !== undefined && onValueChange !== undefined;
  const [internal, setInternal] = useState(() =>
    normalizeInitial(defaultState),
  );

  useEffect(() => {
    if (!controlled) {
      setInternal(normalizeInitial(defaultState));
    }
  }, [defaultState, controlled]);

  const value = controlled ? valueProp! : internal;
  const setValue = controlled ? onValueChange! : setInternal;

  return (
    <>
      {!controlled && (
        <input
          type="hidden"
          name="state"
          value={value === ALL ? "" : value}
          disabled={value === ALL}
        />
      )}
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id="state" className="w-full">
          <SelectValue placeholder="상태" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>전체</SelectItem>
          <SelectItem value="active">판매중</SelectItem>
          <SelectItem value="inactive">비활성</SelectItem>
          <SelectItem value="discontinued">단종</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}
