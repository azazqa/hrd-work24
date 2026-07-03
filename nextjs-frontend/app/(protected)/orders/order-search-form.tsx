"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, Loader2 } from "lucide-react";
import { format, parse } from "date-fns";

import { fetchChannelsForOrderSelect, fetchProductsForOrderSelect } from "@/components/actions/orders-action";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/multi-select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";

const ALL = "__all__";

type FormState = {
  order_date_start: string;
  order_date_end: string;
  status: string;
  invoice_number: string;
  channel_id: string;
  channel_ids: string[];
  product_query: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  has_memos: boolean;
};

export type OrderSearchInitial = Omit<Partial<FormState>, "channel_ids"> & {
  channel_ids?: string;
};

function getTodayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function fromInitial(initial: OrderSearchInitial): FormState {
  return {
    order_date_start: initial.order_date_start ?? getTodayStr(),
    order_date_end: initial.order_date_end ?? getTodayStr(),
    status: initial.status ?? ALL,
    invoice_number: initial.invoice_number ?? "",
    channel_id: initial.channel_id ?? ALL,
    channel_ids: initial.channel_ids
      ? initial.channel_ids
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    product_query: initial.product_query ?? "",
    receiver_name: initial.receiver_name ?? "",
    receiver_phone: initial.receiver_phone ?? "",
    receiver_address: initial.receiver_address ?? "",
    has_memos: initial.has_memos ?? false,
  };
}

function buildSearchQueryString(form: FormState, size: number): string {
  const q = new URLSearchParams();
  q.set("page", "1");
  q.set("size", String(size));

  // 테이블 컬럼 순서: 주문일 → 상태 → 배송번호 → 채널 → 상품 → 수취인 → 연락처 → 주소
  if (form.order_date_start.trim())
    q.set("order_date_start", form.order_date_start.trim());
  if (form.order_date_end.trim())
    q.set("order_date_end", form.order_date_end.trim());
  if (form.status && form.status !== ALL) q.set("status", form.status);
  if (form.invoice_number.trim()) q.set("invoice_number", form.invoice_number.trim());
  if (form.channel_ids.length > 0) q.set("channel_ids", form.channel_ids.join(","));
  else if (form.channel_id && form.channel_id !== ALL) q.set("channel_id", form.channel_id);
  if (form.product_query.trim()) q.set("product_query", form.product_query.trim());
  if (form.receiver_name.trim()) q.set("receiver_name", form.receiver_name.trim());
  if (form.receiver_phone.trim()) q.set("receiver_phone", form.receiver_phone.trim());
  if (form.receiver_address.trim())
    q.set("receiver_address", form.receiver_address.trim());
  if (form.has_memos) q.set("has_memos", "true");

  return q.toString();
}

export function OrderSearchForm({
  initial,
  size,
}: {
  initial: OrderSearchInitial;
  size: number;
}) {
  const router = useRouter();
  const snapshot = JSON.stringify(initial);
  const [form, setForm] = useState<FormState>(() => fromInitial(initial));

  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [channelsLoading, setChannelsLoading] = useState(true);

  const [products, setProducts] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const productAnchor = useComboboxAnchor();

  const filteredProducts = useMemo(() => {
    const q = (form.product_query ?? "").trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const code = (p.code ?? "").toLowerCase();
      const name = (p.name ?? "").toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [form.product_query, products]);

  const orderDateStart = useMemo(() => {
    const s = form.order_date_start.trim();
    if (!s) return undefined;
    try {
      return parse(s, "yyyy-MM-dd", new Date());
    } catch {
      return undefined;
    }
  }, [form.order_date_start]);

  const orderDateEnd = useMemo(() => {
    const s = form.order_date_end.trim();
    if (!s) return undefined;
    try {
      return parse(s, "yyyy-MM-dd", new Date());
    } catch {
      return undefined;
    }
  }, [form.order_date_end]);

  const [openOrderDatePicker, setOpenOrderDatePicker] = useState<
    "start" | "end" | null
  >(null);

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

  useEffect(() => {
    let cancelled = false;
    setProductsLoading(true);
    fetchProductsForOrderSelect()
      .then((list) => {
        if (cancelled) return;
        const mapped = (Array.isArray(list) ? list : [])
          .map((p: any) => ({
            id: String(p.id),
            name: String(p.name ?? ""),
            code: p.code ? String(p.code) : undefined,
          }))
          .filter((p) => p.id && p.name);
        setProducts(mapped);
      })
      .finally(() => {
        if (cancelled) return;
        setProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/orders?${buildSearchQueryString(form, size)}`);
  };

  const handleReset = () => {
    const today = getTodayStr();
    setForm({
      order_date_start: today,
      order_date_end: today,
      status: ALL,
      invoice_number: "",
      channel_id: ALL,
      channel_ids: [],
      product_query: "",
      receiver_name: "",
      receiver_phone: "",
      receiver_address: "",
      has_memos: false,
    });
    router.push(
      `/orders?page=1&size=${size}&order_date_start=${encodeURIComponent(
        today,
      )}&order_date_end=${encodeURIComponent(today)}`,
    );
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-8">
      <div className="lg:col-span-7">
        <FieldGroup>
          <FieldSet>
            <FieldGroup>
              <div className="flex flex-wrap gap-4">
                <Field className="w-[340px]">
                  <FieldLabel>주문일</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Popover
                      open={openOrderDatePicker === "start"}
                      onOpenChange={(o) =>
                        setOpenOrderDatePicker(o ? "start" : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          data-empty={!orderDateStart}
                          className="min-w-0 flex-1 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                        >
                          {orderDateStart ? (
                            format(orderDateStart, "yyyy-MM-dd")
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
                          selected={orderDateStart}
                          defaultMonth={orderDateStart ?? new Date()}
                          onSelect={(d) => {
                            setForm((p) => ({
                              ...p,
                              order_date_start: d ? format(d, "yyyy-MM-dd") : "",
                            }));
                            if (d !== undefined) setOpenOrderDatePicker(null);
                          }}
                        />
                      </PopoverContent>
                    </Popover>

                    <span className="shrink-0 text-muted-foreground">~</span>

                    <Popover
                      open={openOrderDatePicker === "end"}
                      onOpenChange={(o) =>
                        setOpenOrderDatePicker(o ? "end" : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          data-empty={!orderDateEnd}
                          className="min-w-0 flex-1 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                        >
                          {orderDateEnd ? (
                            format(orderDateEnd, "yyyy-MM-dd")
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
                          selected={orderDateEnd}
                          defaultMonth={orderDateEnd ?? new Date()}
                          onSelect={(d) => {
                            setForm((p) => ({
                              ...p,
                              order_date_end: d ? format(d, "yyyy-MM-dd") : "",
                            }));
                            if (d !== undefined) setOpenOrderDatePicker(null);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </Field>

                <Field className="w-[200px]">
                  <FieldLabel htmlFor="status">주문 상태</FieldLabel>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
                  >
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>전체</SelectItem>
                      <SelectItem value="order">주문</SelectItem>
                      <SelectItem value="order_placed">발주</SelectItem>
                      <SelectItem value="shipping_waiting">배송 대기</SelectItem>
                      <SelectItem value="shipping">배송</SelectItem>
                      <SelectItem value="cancelled">취소</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field className="w-[200px]">
                  <FieldLabel htmlFor="invoice_number">배송번호</FieldLabel>
                  <Input
                    id="invoice_number"
                    placeholder="부분 일치"
                    clearable
                    value={form.invoice_number}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, invoice_number: e.target.value }))
                    }
                  />
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

                <Field className="w-[260px]">
                  <FieldLabel htmlFor="product_query">상품</FieldLabel>
                  <div ref={productAnchor}>
                    <Combobox>
                      <ComboboxInput
                        placeholder="코드/이름 부분 일치"
                        value={form.product_query}
                        onChange={(e) => {
                          const v = e.currentTarget.value;
                          setForm((p) => ({ ...p, product_query: v }));
                        }}
                        showClear
                        disabled={productsLoading}
                      />
                      <ComboboxContent anchor={productAnchor}>
                        <ComboboxList>
                          <ComboboxEmpty>
                            {productsLoading ? "로딩 중…" : "검색 결과가 없습니다."}
                          </ComboboxEmpty>
                          <ComboboxItem
                            value="__all__"
                            onClick={() => setForm((p) => ({ ...p, product_query: "" }))}
                          >
                            전체
                          </ComboboxItem>
                          {(productsLoading ? [] : filteredProducts).map((p) => {
                            const label = p.code ? `[${p.code}] ${p.name}` : p.name;
                            return (
                              <ComboboxItem
                                key={p.id}
                                value={label}
                                onClick={() =>
                                  // 표시/검색 편의: 선택 시 상품명으로 채움 (코드는 직접 입력으로도 검색 가능)
                                  setForm((prev) => ({ ...prev, product_query: p.name }))
                                }
                              >
                                {label}
                              </ComboboxItem>
                            );
                          })}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>
                </Field>

                <Field className="w-[200px]">
                  <FieldLabel htmlFor="receiver_name">이름</FieldLabel>
                  <Input
                    id="receiver_name"
                    placeholder="부분 일치"
                    clearable
                    value={form.receiver_name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, receiver_name: e.target.value }))
                    }
                  />
                </Field>

                <Field className="w-[200px]">
                  <FieldLabel htmlFor="receiver_phone">연락처</FieldLabel>
                  <Input
                    id="receiver_phone"
                    placeholder="부분 일치"
                    clearable
                    value={form.receiver_phone}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, receiver_phone: e.target.value }))
                    }
                  />
                </Field>

                <Field className="flex-1 min-w-[260px]">
                  <FieldLabel htmlFor="receiver_address">주소</FieldLabel>
                  <Input
                    id="receiver_address"
                    placeholder="부분 일치"
                    clearable
                    value={form.receiver_address}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        receiver_address: e.target.value,
                      }))
                    }
                  />
                </Field>

                <Field className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="order_has_memos"
                      checked={form.has_memos}
                      onCheckedChange={(v) =>
                        setForm((p) => ({ ...p, has_memos: v === true }))
                      }
                    />
                    <FieldLabel
                      htmlFor="order_has_memos"
                      className="font-normal cursor-pointer"
                    >
                      메모 있음
                    </FieldLabel>
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
          onClick={handleReset}
        >
          초기화
        </Button>
        <Button type="submit" className="min-w-0 flex-1">
          검색
        </Button>
      </Field>
    </form>
  );
}

