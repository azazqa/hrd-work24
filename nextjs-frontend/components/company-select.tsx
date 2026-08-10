"use client";

import { useEffect, useState } from "react";

import {
  fetchCompanies,
  type Company,
} from "@/components/actions/companies-action";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  value?: string;
  onValueChange: (value: string) => void;
  /** 빈 값 허용 시 플레이스홀더(전체 등). 없으면 필수 선택. */
  allowEmpty?: boolean;
  emptyLabel?: string;
  placeholder?: string;
  id?: string;
  activeOnly?: boolean;
  className?: string;
  disabled?: boolean;
};

export function CompanySelect({
  value,
  onValueChange,
  allowEmpty = false,
  emptyLabel = "전체",
  placeholder = "업체 선택",
  id,
  activeOnly = true,
  className,
  disabled,
}: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await fetchCompanies(1, 200, {
        is_active: activeOnly ? true : undefined,
      });
      if (cancelled) return;
      if ("message" in data) {
        setError(data.message);
        setCompanies([]);
      } else {
        setError(null);
        setCompanies(data.items ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeOnly]);

  const selectValue =
    value && value.trim() ? value : allowEmpty ? "__all__" : undefined;

  return (
    <div className={className}>
      <Select
        value={selectValue}
        onValueChange={(v) => onValueChange(v === "__all__" ? "" : v)}
        disabled={disabled || loading || Boolean(error)}
      >
        <SelectTrigger id={id}>
          <SelectValue
            placeholder={loading ? "불러오는 중…" : error ? "조회 실패" : placeholder}
          />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty ? (
            <SelectItem value="__all__">{emptyLabel}</SelectItem>
          ) : null}
          {companies.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
