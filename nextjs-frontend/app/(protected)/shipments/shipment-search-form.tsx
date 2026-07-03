"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, Loader2 } from "lucide-react";
import { format, parse } from "date-fns";

import { fetchChannelsForOrderSelect } from "@/components/actions/orders-action";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/multi-select";

const ALL = "__all__";

type FormState = {
  order_placed_date_start: string;
  order_placed_date_end: string;
  shipping_date_start: string;
  shipping_date_end: string;
  order_date_start: string;
  order_date_end: string;

  order_status: string;
  channel_id: string;
  channel_ids: string[];
  invoice_number: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_zip_code: string;
  receiver_address: string;
  product_query: string;
};

export type ShipmentSearchInitial = Omit<Partial<FormState>, "channel_ids"> & {
  channel_ids?: string;
};

function fromInitial(initial: ShipmentSearchInitial): FormState {
  return {
    order_placed_date_start: initial.order_placed_date_start ?? "",
    order_placed_date_end: initial.order_placed_date_end ?? "",
    shipping_date_start: initial.shipping_date_start ?? "",
    shipping_date_end: initial.shipping_date_end ?? "",
    order_date_start: initial.order_date_start ?? "",
    order_date_end: initial.order_date_end ?? "",
    order_status: initial.order_status ?? ALL,
    channel_id: initial.channel_id ?? ALL,
    channel_ids: initial.channel_ids
      ? initial.channel_ids
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    invoice_number: initial.invoice_number ?? "",
    receiver_name: initial.receiver_name ?? "",
    receiver_phone: initial.receiver_phone ?? "",
    receiver_zip_code: initial.receiver_zip_code ?? "",
    receiver_address: initial.receiver_address ?? "",
    product_query: initial.product_query ?? "",
  };
}

function buildSearchQueryString(form: FormState, size: number): string {
  const q = new URLSearchParams();
  q.set("page", "1");
  q.set("size", String(size));

  const add = (k: string, v: string) => {
    const t = v.trim();
    if (t) q.set(k, t);
  };

  add("order_placed_date_start", form.order_placed_date_start);
  add("order_placed_date_end", form.order_placed_date_end);
  add("shipping_date_start", form.shipping_date_start);
  add("shipping_date_end", form.shipping_date_end);
  add("order_date_start", form.order_date_start);
  add("order_date_end", form.order_date_end);

  if (form.order_status && form.order_status !== ALL)
    q.set("order_status", form.order_status);
  if (form.channel_ids.length > 0) q.set("channel_ids", form.channel_ids.join(","));
  else if (form.channel_id && form.channel_id !== ALL) q.set("channel_id", form.channel_id);

  add("invoice_number", form.invoice_number);
  add("receiver_name", form.receiver_name);
  add("receiver_phone", form.receiver_phone);
  add("receiver_zip_code", form.receiver_zip_code);
  add("receiver_address", form.receiver_address);
  add("product_query", form.product_query);

  return q.toString();
}

function useParsedDate(s: string) {
  return useMemo(() => {
    const t = s.trim();
    if (!t) return undefined;
    try {
      return parse(t, "yyyy-MM-dd", new Date());
    } catch {
      return undefined;
    }
  }, [s]);
}

type ShipmentPickerKey =
  | "opdStart"
  | "opdEnd"
  | "sdStart"
  | "sdEnd"
  | "odStart"
  | "odEnd";

export function ShipmentSearchForm({
  initial,
  size,
}: {
  initial: ShipmentSearchInitial;
  size: number;
}) {
  const router = useRouter();
  const snapshot = JSON.stringify(initial);
  const [form, setForm] = useState<FormState>(() => fromInitial(initial));

  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);

  useEffect(() => {
    setForm(fromInitial(initial));
  }, [snapshot]);

  useEffect(() => {
    let cancelled = false;
    setChannelsLoading(true);
    fetchChannelsForOrderSelect()
      .then((list) => {
        if (cancelled) return;
        const mapped = (Array.isArray(list) ? list : [])
          .map((c: any) => ({ id: String(c.id), name: String(c.name ?? "") }))
          .filter((c) => c.id && c.name);
        setChannels(mapped);
      })
      .finally(() => {
        if (cancelled) return;
        setChannelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const opdStart = useParsedDate(form.order_placed_date_start);
  const opdEnd = useParsedDate(form.order_placed_date_end);
  const sdStart = useParsedDate(form.shipping_date_start);
  const sdEnd = useParsedDate(form.shipping_date_end);
  const odStart = useParsedDate(form.order_date_start);
  const odEnd = useParsedDate(form.order_date_end);

  const [openShipmentPicker, setOpenShipmentPicker] =
    useState<ShipmentPickerKey | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/shipments?${buildSearchQueryString(form, size)}`);
  };

  const handleReset = () => {
    setForm(fromInitial({}));
    router.push(`/shipments?page=1&size=${size}`);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-8">
      <div className="lg:col-span-7">
        <FieldGroup>
          <FieldSet>
            <FieldGroup>
              <div className="flex flex-wrap gap-4">
                <Field className="w-[340px]">
                  <FieldLabel>발주일</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Popover
                      open={openShipmentPicker === "opdStart"}
                      onOpenChange={(o) =>
                        setOpenShipmentPicker(o ? "opdStart" : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          data-empty={!opdStart}
                          className="min-w-0 flex-1 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                        >
                          {opdStart ? format(opdStart, "yyyy-MM-dd") : <span>시작일</span>}
                          <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={opdStart}
                          defaultMonth={opdStart ?? new Date()}
                          onSelect={(d) => {
                            setForm((p) => ({
                              ...p,
                              order_placed_date_start: d ? format(d, "yyyy-MM-dd") : "",
                            }));
                            if (d !== undefined) setOpenShipmentPicker(null);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="shrink-0 text-muted-foreground">~</span>
                    <Popover
                      open={openShipmentPicker === "opdEnd"}
                      onOpenChange={(o) =>
                        setOpenShipmentPicker(o ? "opdEnd" : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          data-empty={!opdEnd}
                          className="min-w-0 flex-1 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                        >
                          {opdEnd ? format(opdEnd, "yyyy-MM-dd") : <span>종료일</span>}
                          <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={opdEnd}
                          defaultMonth={opdEnd ?? new Date()}
                          onSelect={(d) => {
                            setForm((p) => ({
                              ...p,
                              order_placed_date_end: d ? format(d, "yyyy-MM-dd") : "",
                            }));
                            if (d !== undefined) setOpenShipmentPicker(null);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </Field>

                <Field className="w-[340px]">
                  <FieldLabel>배송일</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Popover
                      open={openShipmentPicker === "sdStart"}
                      onOpenChange={(o) =>
                        setOpenShipmentPicker(o ? "sdStart" : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          data-empty={!sdStart}
                          className="min-w-0 flex-1 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                        >
                          {sdStart ? format(sdStart, "yyyy-MM-dd") : <span>시작일</span>}
                          <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={sdStart}
                          defaultMonth={sdStart ?? new Date()}
                          onSelect={(d) => {
                            setForm((p) => ({
                              ...p,
                              shipping_date_start: d ? format(d, "yyyy-MM-dd") : "",
                            }));
                            if (d !== undefined) setOpenShipmentPicker(null);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="shrink-0 text-muted-foreground">~</span>
                    <Popover
                      open={openShipmentPicker === "sdEnd"}
                      onOpenChange={(o) =>
                        setOpenShipmentPicker(o ? "sdEnd" : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          data-empty={!sdEnd}
                          className="min-w-0 flex-1 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                        >
                          {sdEnd ? format(sdEnd, "yyyy-MM-dd") : <span>종료일</span>}
                          <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={sdEnd}
                          defaultMonth={sdEnd ?? new Date()}
                          onSelect={(d) => {
                            setForm((p) => ({
                              ...p,
                              shipping_date_end: d ? format(d, "yyyy-MM-dd") : "",
                            }));
                            if (d !== undefined) setOpenShipmentPicker(null);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </Field>

                <Field className="w-[340px]">
                  <FieldLabel>주문일</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Popover
                      open={openShipmentPicker === "odStart"}
                      onOpenChange={(o) =>
                        setOpenShipmentPicker(o ? "odStart" : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          data-empty={!odStart}
                          className="min-w-0 flex-1 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                        >
                          {odStart ? format(odStart, "yyyy-MM-dd") : <span>시작일</span>}
                          <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={odStart}
                          defaultMonth={odStart ?? new Date()}
                          onSelect={(d) => {
                            setForm((p) => ({
                              ...p,
                              order_date_start: d ? format(d, "yyyy-MM-dd") : "",
                            }));
                            if (d !== undefined) setOpenShipmentPicker(null);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="shrink-0 text-muted-foreground">~</span>
                    <Popover
                      open={openShipmentPicker === "odEnd"}
                      onOpenChange={(o) =>
                        setOpenShipmentPicker(o ? "odEnd" : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          data-empty={!odEnd}
                          className="min-w-0 flex-1 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                        >
                          {odEnd ? format(odEnd, "yyyy-MM-dd") : <span>종료일</span>}
                          <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={odEnd}
                          defaultMonth={odEnd ?? new Date()}
                          onSelect={(d) => {
                            setForm((p) => ({
                              ...p,
                              order_date_end: d ? format(d, "yyyy-MM-dd") : "",
                            }));
                            if (d !== undefined) setOpenShipmentPicker(null);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </Field>

                <Field className="w-[200px]">
                  <FieldLabel htmlFor="order_status">주문 상태</FieldLabel>
                  <Select
                    value={form.order_status}
                    onValueChange={(v) => setForm((p) => ({ ...p, order_status: v }))}
                  >
                    <SelectTrigger id="order_status" className="w-full">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>전체</SelectItem>
                      <SelectItem value="order">주문</SelectItem>
                      <SelectItem value="order_placed">발주</SelectItem>
                      <SelectItem value="shipping_waiting">배송 대기</SelectItem>
                      <SelectItem value="shipping">배송</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field className="w-[240px]">
                  <FieldLabel htmlFor="channel_id">채널</FieldLabel>
                  <MultiSelect
                    options={channels.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="전체"
                    searchPlaceholder="채널 검색"
                    defaultValue={form.channel_ids}
                    hideSelectAll
                    className="w-full"
                    disabled={channelsLoading}
                    onValueChange={(values) =>
                      setForm((p) => ({ ...p, channel_ids: values, channel_id: ALL }))
                    }
                  />
                </Field>

                <Field className="w-[220px]">
                  <FieldLabel htmlFor="invoice_number">배송번호</FieldLabel>
                  <Input
                    id="invoice_number"
                    placeholder="부분 일치"
                    value={form.invoice_number}
                    onChange={(e) => setForm((p) => ({ ...p, invoice_number: e.target.value }))}
                  />
                </Field>

                <Field className="w-[200px]">
                  <FieldLabel htmlFor="receiver_name">이름</FieldLabel>
                  <Input
                    id="receiver_name"
                    placeholder="부분 일치"
                    value={form.receiver_name}
                    onChange={(e) => setForm((p) => ({ ...p, receiver_name: e.target.value }))}
                  />
                </Field>

                <Field className="w-[200px]">
                  <FieldLabel htmlFor="receiver_phone">연락처</FieldLabel>
                  <Input
                    id="receiver_phone"
                    placeholder="부분 일치"
                    value={form.receiver_phone}
                    onChange={(e) => setForm((p) => ({ ...p, receiver_phone: e.target.value }))}
                  />
                </Field>

                <Field className="w-[160px]">
                  <FieldLabel htmlFor="receiver_zip_code">우편번호</FieldLabel>
                  <Input
                    id="receiver_zip_code"
                    placeholder="부분 일치"
                    value={form.receiver_zip_code}
                    onChange={(e) => setForm((p) => ({ ...p, receiver_zip_code: e.target.value }))}
                  />
                </Field>

                <Field className="flex-1 min-w-[260px]">
                  <FieldLabel htmlFor="receiver_address">주소</FieldLabel>
                  <Input
                    id="receiver_address"
                    placeholder="부분 일치"
                    value={form.receiver_address}
                    onChange={(e) => setForm((p) => ({ ...p, receiver_address: e.target.value }))}
                  />
                </Field>

                <Field className="w-[260px]">
                  <FieldLabel htmlFor="product_query">상품</FieldLabel>
                  <Input
                    id="product_query"
                    placeholder="코드/이름 부분 일치"
                    value={form.product_query}
                    onChange={(e) => setForm((p) => ({ ...p, product_query: e.target.value }))}
                  />
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        </FieldGroup>
      </div>

      <Field orientation="horizontal" className="items-end gap-2 lg:col-span-1">
        <Button type="button" variant="outline" className="min-w-0 flex-1" onClick={handleReset}>
          초기화
        </Button>
        <Button type="submit" className="min-w-0 flex-1">
          검색
        </Button>
      </Field>
    </form>
  );
}

