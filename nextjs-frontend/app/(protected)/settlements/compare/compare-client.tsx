"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { createClientMappingAction } from "@/components/actions/client-mappings-action";
import type {
  OwnedSettlementCompareItem,
  OwnedSettlementCompareResult,
} from "@/components/actions/settlements-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  year?: number;
  result?: OwnedSettlementCompareResult | null;
  error?: string | null;
};

function CompareTable({
  items,
  showClient,
  onAddMapping,
}: {
  items: OwnedSettlementCompareItem[];
  showClient: boolean;
  onAddMapping?: (institutionName: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">해당 항목이 없습니다.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table className="[&_td]:text-center">
        <TableHeader>
          <TableRow>
            <TableHead>훈련기관명</TableHead>
            {showClient ? <TableHead>고객사명</TableHead> : null}
            <TableHead>과정명</TableHead>
            <TableHead>훈련시작일</TableHead>
            <TableHead>훈련종료일</TableHead>
            <TableHead>수강신청 인원</TableHead>
            {!showClient ? <TableHead className="w-28">맵핑</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row, idx) => (
            <TableRow
              key={`${row.institution_name}-${row.course_name}-${row.tra_start_date}-${idx}`}
            >
              <TableCell className="text-left">
                {row.institution_name ?? "-"}
              </TableCell>
              {showClient ? (
                <TableCell className="text-left">{row.client_name ?? "-"}</TableCell>
              ) : null}
              <TableCell className="text-left">{row.course_name ?? "-"}</TableCell>
              <TableCell>{row.tra_start_date ?? "-"}</TableCell>
              <TableCell>{row.tra_end_date ?? "-"}</TableCell>
              <TableCell>{row.reg_course_man ?? "-"}</TableCell>
              {!showClient ? (
                <TableCell>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!row.institution_name}
                    onClick={() =>
                      row.institution_name && onAddMapping?.(row.institution_name)
                    }
                  >
                    맵핑 추가
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CompareOwnedClient({ year, result, error }: Props) {
  const router = useRouter();
  const [yearInput, setYearInput] = useState(
    String(year ?? new Date().getFullYear()),
  );
  const [mapInst, setMapInst] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [mapError, setMapError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const summary = useMemo(() => {
    if (!result) return null;
    return [
      { label: "전체", value: result.total },
      { label: "정산됨", value: result.matched },
      { label: "미정산", value: result.unsettled },
      { label: "맵핑 없음", value: result.unmapped },
    ];
  }, [result]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const y = Number(yearInput);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) return;
    router.push(`/settlements/compare?year=${y}`);
  };

  const onCreateMapping = async () => {
    if (!mapInst) return;
    setPending(true);
    setMapError(null);
    const res = await createClientMappingAction({
      institution_name: mapInst,
      client_name: clientName.trim(),
    });
    setPending(false);
    if (!res.ok) {
      setMapError(res.message);
      return;
    }
    setMapInst(null);
    setClientName("");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onSearch} className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="year">비교 연도</Label>
          <Input
            id="year"
            type="number"
            min={2000}
            max={2100}
            value={yearInput}
            onChange={(e) => setYearInput(e.target.value)}
            className="w-40"
          />
        </div>
        <Button type="submit">비교</Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/settlements/mappings">고객사 맵핑 관리</Link>
        </Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summary.map((s) => (
            <div key={s.label} className="rounded-md border px-4 py-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-semibold">
                {s.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {result ? (
        <Tabs defaultValue="unsettled">
          <TabsList>
            <TabsTrigger value="unsettled">
              미정산 ({result.unsettled})
            </TabsTrigger>
            <TabsTrigger value="unmapped">
              맵핑 없음 ({result.unmapped})
            </TabsTrigger>
            <TabsTrigger value="matched">정산됨 ({result.matched})</TabsTrigger>
          </TabsList>
          <TabsContent value="unsettled" className="mt-4">
            <CompareTable items={result.items_unsettled} showClient />
          </TabsContent>
          <TabsContent value="unmapped" className="mt-4">
            <CompareTable
              items={result.items_unmapped}
              showClient={false}
              onAddMapping={(name) => {
                setMapInst(name);
                setClientName("");
                setMapError(null);
              }}
            />
          </TabsContent>
          <TabsContent value="matched" className="mt-4">
            <CompareTable items={result.items_matched} showClient />
          </TabsContent>
        </Tabs>
      ) : !error ? (
        <p className="text-sm text-muted-foreground">
          연도를 선택하고 비교를 실행하세요.
        </p>
      ) : null}

      <Dialog
        open={mapInst != null}
        onOpenChange={(open) => {
          if (!open) {
            setMapInst(null);
            setMapError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>고객사 맵핑 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>훈련기관명</Label>
              <Input value={mapInst ?? ""} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="map_client">고객사명</Label>
              <Input
                id="map_client"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="정산 고객사명"
              />
            </div>
            {mapError ? <p className="text-sm text-destructive">{mapError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMapInst(null)}>
              취소
            </Button>
            <Button type="button" onClick={onCreateMapping} disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
