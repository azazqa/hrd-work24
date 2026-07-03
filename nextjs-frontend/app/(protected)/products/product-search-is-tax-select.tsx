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

function normalizeInitial(isTax: string | undefined): string {
  if (isTax === "true" || isTax === "false") {
    return isTax;
  }
  return ALL;
}

type Props = {
  defaultIsTax?: string;
  value?: string;
  onValueChange?: (v: string) => void;
};

export function ProductSearchIsTaxSelect({
  defaultIsTax,
  value: valueProp,
  onValueChange,
}: Props) {
  const controlled =
    valueProp !== undefined && onValueChange !== undefined;
  const [internal, setInternal] = useState(() =>
    normalizeInitial(defaultIsTax),
  );

  useEffect(() => {
    if (!controlled) {
      setInternal(normalizeInitial(defaultIsTax));
    }
  }, [defaultIsTax, controlled]);

  const value = controlled ? valueProp! : internal;
  const setValue = controlled ? onValueChange! : setInternal;

  return (
    <>
      {!controlled && (
        <input
          type="hidden"
          name="is_tax"
          value={value === ALL ? "" : value}
          disabled={value === ALL}
        />
      )}
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id="is_tax" className="w-full">
          <SelectValue placeholder="과세" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>전체</SelectItem>
          <SelectItem value="true">과세</SelectItem>
          <SelectItem value="false">비과세</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}
