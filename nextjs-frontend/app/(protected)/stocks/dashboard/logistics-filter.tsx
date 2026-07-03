"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchLogisticsLocationsForSelect } from "@/components/actions/logistics-locations-action";

const ALL = "__all__";

export function LogisticsLocationFilter({
  locations,
  paramName = "location",
}: {
  locations?: { id: string; name: string }[];
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [internalLocations, setInternalLocations] = useState(
    locations ?? [],
  );
  const [loading, setLoading] = useState(locations === undefined);

  useEffect(() => {
    if (locations !== undefined) return;

    let cancelled = false;
    setLoading(true);
    fetchLogisticsLocationsForSelect()
      .then((list) => {
        if (cancelled) return;
        setInternalLocations(Array.isArray(list) ? list : []);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locations]);

  const raw = searchParams.get(paramName) ?? "";
  const validIds = useMemo(
    () => new Set(internalLocations.map((l) => l.id)),
    [internalLocations],
  );
  const current =
    raw && validIds.has(raw) ? raw : ALL;

  function onChange(v: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (!v || v === ALL) {
      p.delete(paramName);
    } else {
      p.set(paramName, v);
    }
    p.delete("page");
    const q = p.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground shrink-0">
        물류지
      </span>
      <Select value={current} onValueChange={onChange}>
        <SelectTrigger
          className="w-[min(100%,240px)]"
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">로딩 중</span>
            </div>
          ) : (
            <SelectValue placeholder="물류지 선택" />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL} disabled={loading}>
            전체
          </SelectItem>
          {internalLocations.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
