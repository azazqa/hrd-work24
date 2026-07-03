"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";
import { format, parse } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { fetchChannelsForExcelSelect, type ChannelOption } from "@/components/actions/orders-excel-action";
import { MultiSelect } from "@/components/multi-select";

type FormState = {
  state?: string;
  channel_ids?: string;
  mall_product_name?: string;
  invoice_number?: string;
  settled_date_start?: string;
  settled_date_end?: string;
  completed_date_start?: string;
  completed_date_end?: string;
};

export function SettlementSearchForm({
  size,
  initial,
}: {
  size: number;
  initial: FormState;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => ({ ...initial }));
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [openDatePicker, setOpenDatePicker] = useState<
    "settled_start" | "settled_end" | "completed_start" | "completed_end" | null
  >(null);

  const stateValue = useMemo(() => form.state ?? "__all__", [form.state]);
  const channelIdsValue = useMemo(() => {
    const raw = (form.channel_ids ?? "").trim();
    if (!raw) return [] as string[];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [form.channel_ids]);

  const settledStart = useMemo(() => {
    const s = (form.settled_date_start ?? "").trim();
    if (!s) return undefined;
    try {
      return parse(s, "yyyy-MM-dd", new Date());
    } catch {
      return undefined;
    }
  }, [form.settled_date_start]);

  const settledEnd = useMemo(() => {
    const s = (form.settled_date_end ?? "").trim();
    if (!s) return undefined;
    try {
      return parse(s, "yyyy-MM-dd", new Date());
    } catch {
      return undefined;
    }
  }, [form.settled_date_end]);

  const completedStart = useMemo(() => {
    const s = (form.completed_date_start ?? "").trim();
    if (!s) return undefined;
    try {
      return parse(s, "yyyy-MM-dd", new Date());
    } catch {
      return undefined;
    }
  }, [form.completed_date_start]);

  const completedEnd = useMemo(() => {
    const s = (form.completed_date_end ?? "").trim();
    if (!s) return undefined;
    try {
      return parse(s, "yyyy-MM-dd", new Date());
    } catch {
      return undefined;
    }
  }, [form.completed_date_end]);

  useEffect(() => {
    let cancelled = false;
    setChannelsLoading(true);
    fetchChannelsForExcelSelect()
      .then((list) => {
        if (cancelled) return;
        setChannels(Array.isArray(list) ? list : []);
      })
      .finally(() => {
        if (cancelled) return;
        setChannelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function buildQueryString(next: FormState) {
    const sp = new URLSearchParams();
    sp.set("page", "1");
    sp.set("size", String(size));
    const add = (k: string, v?: string) => {
      const t = v?.trim();
      if (t) sp.set(k, t);
    };
    if (next.state && next.state !== "__all__") sp.set("state", next.state);
    if (next.channel_ids && next.channel_ids.trim()) sp.set("channel_ids", next.channel_ids.trim());
    add("mall_product_name", next.mall_product_name);
    add("invoice_number", next.invoice_number);
    add("settled_date_start", next.settled_date_start);
    add("settled_date_end", next.settled_date_end);
    add("completed_date_start", next.completed_date_start);
    add("completed_date_end", next.completed_date_end);
    return sp.toString();
  }

  function onSearch() {
    const qs = buildQueryString(form);
    router.push(`/settlements?${qs}`);
  }

  function onReset() {
    setForm({});
    setOpenDatePicker(null);
    router.push(`/settlements?page=1&size=${encodeURIComponent(String(size))}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
      className="grid grid-cols-1 gap-4 lg:grid-cols-8"
    >
      <div className="lg:col-span-7">
        <FieldGroup>
          <FieldSet>
            <FieldGroup>
              <div className="flex flex-wrap gap-4">
                <Field className="w-[200px]">
                  <FieldLabel>상태</FieldLabel>
                  <Select
                    value={stateValue}
                    onValueChange={(v) =>
                      setForm((prev) => ({
                        ...prev,
                        state: v === "__all__" ? undefined : v,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">전체</SelectItem>
                      <SelectItem value="pending">대기</SelectItem>
                      <SelectItem value="settled">정산</SelectItem>
                      <SelectItem value="completed">완료</SelectItem>
                      <SelectItem value="reject">반려</SelectItem>
                      <SelectItem value="cancelled">취소</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field className="w-[260px]">
                  <FieldLabel>채널</FieldLabel>
                  <MultiSelect
                    options={channels.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="전체"
                    searchPlaceholder="채널 검색"
                    defaultValue={channelIdsValue}
                    hideSelectAll
                    className="w-full"
                    disabled={channelsLoading}
                    onValueChange={(values) =>
                      setForm((prev) => ({
                        ...prev,
                        channel_ids: values.length ? values.join(",") : undefined,
                      }))
                    }
                  />
                </Field>

                <Field className="w-[320px]">
                  <FieldLabel>쇼핑몰 상품명(별칭)</FieldLabel>
                  <Input
                    value={form.mall_product_name ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, mall_product_name: e.target.value }))
                    }
                    placeholder="상품명"
                  />
                </Field>

                <Field className="w-[220px]">
                  <FieldLabel>송장번호</FieldLabel>
                  <Input
                    value={form.invoice_number ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, invoice_number: e.target.value }))
                    }
                    placeholder="invoice"
                  />
                </Field>

                <Field className="w-[340px]">
                  <FieldLabel>정산일</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Popover
                      open={openDatePicker === "settled_start"}
                      onOpenChange={(o) =>
                        setOpenDatePicker(o ? "settled_start" : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          data-empty={!settledStart}
                          className="min-w-0 flex-1 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                        >
                          {settledStart ? (
                            format(settledStart, "yyyy-MM-dd")
                          ) : (
                            <span>시작일</span>
                          )}
                          <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={settledStart}
                          defaultMonth={settledStart ?? new Date()}
                          onSelect={(d) => {
                            setForm((p) => ({
                              ...p,
                              settled_date_start: d
                                ? format(d, "yyyy-MM-dd")
                                : undefined,
                            }));
                            if (d !== undefined) setOpenDatePicker(null);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="shrink-0 text-muted-foreground">~</span>
                    <Popover
                      open={openDatePicker === "settled_end"}
                      onOpenChange={(o) =>
                        setOpenDatePicker(o ? "settled_end" : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          data-empty={!settledEnd}
                          className="min-w-0 flex-1 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                        >
                          {settledEnd ? (
                            format(settledEnd, "yyyy-MM-dd")
                          ) : (
                            <span>종료일</span>
                          )}
                          <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={settledEnd}
                          defaultMonth={settledEnd ?? new Date()}
                          onSelect={(d) => {
                            setForm((p) => ({
                              ...p,
                              settled_date_end: d
                                ? format(d, "yyyy-MM-dd")
                                : undefined,
                            }));
                            if (d !== undefined) setOpenDatePicker(null);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </Field>

                <Field className="w-[340px]">
                  <FieldLabel>정산완료일</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Popover
                      open={openDatePicker === "completed_start"}
                      onOpenChange={(o) =>
                        setOpenDatePicker(o ? "completed_start" : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          data-empty={!completedStart}
                          className="min-w-0 flex-1 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                        >
                          {completedStart ? (
                            format(completedStart, "yyyy-MM-dd")
                          ) : (
                            <span>시작일</span>
                          )}
                          <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={completedStart}
                          defaultMonth={completedStart ?? new Date()}
                          onSelect={(d) => {
                            setForm((p) => ({
                              ...p,
                              completed_date_start: d
                                ? format(d, "yyyy-MM-dd")
                                : undefined,
                            }));
                            if (d !== undefined) setOpenDatePicker(null);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="shrink-0 text-muted-foreground">~</span>
                    <Popover
                      open={openDatePicker === "completed_end"}
                      onOpenChange={(o) =>
                        setOpenDatePicker(o ? "completed_end" : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          data-empty={!completedEnd}
                          className="min-w-0 flex-1 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                        >
                          {completedEnd ? (
                            format(completedEnd, "yyyy-MM-dd")
                          ) : (
                            <span>종료일</span>
                          )}
                          <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={completedEnd}
                          defaultMonth={completedEnd ?? new Date()}
                          onSelect={(d) => {
                            setForm((p) => ({
                              ...p,
                              completed_date_end: d
                                ? format(d, "yyyy-MM-dd")
                                : undefined,
                            }));
                            if (d !== undefined) setOpenDatePicker(null);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        </FieldGroup>
      </div>

      <Field orientation="horizontal" className="items-end gap-2 lg:col-span-1">
        <Button
          type="button"
          variant="outline"
          className="min-w-0 flex-1"
          onClick={onReset}
        >
          초기화
        </Button>
        <Button type="submit" className="min-w-0 flex-1">검색</Button>
      </Field>
    </form>
  );
}

