"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { addStock } from "@/components/actions/stocks-action";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submitButton";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";

interface ProductOption {
  id: string;
  name: string;
  product_code: string;
}

interface StockFormProps {
  products: ProductOption[];
  logisticsLocations: { id: string; name: string }[];
}

const initialState = { message: "" };
const EMPTY_SELECT = "__empty__";

const CONDITION_OPTIONS: { value: string; label: string }[] = [
  { value: "normal", label: "정상" },
  { value: "refurb", label: "리퍼" },
  { value: "disposal", label: "폐기" },
  { value: "undecided", label: "미정" },
];

export function StockForm({ products, logisticsLocations }: StockFormProps) {
  const [state, dispatch] = useActionState(addStock, initialState);
  const [productId, setProductId] = useState<string>(EMPTY_SELECT);
  const [locationId, setLocationId] = useState<string>(EMPTY_SELECT);
  const [condition, setCondition] = useState<string>("normal");
  const [stockDate, setStockDate] = useState<Date | undefined>(new Date());
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();
  const [stockCalendarOpen, setStockCalendarOpen] = useState(false);
  const [expirationCalendarOpen, setExpirationCalendarOpen] = useState(false);

  return (
    <form
      action={dispatch}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6"
    >
      <input
        type="hidden"
        name="logistics_location_id"
        value={locationId === EMPTY_SELECT ? "" : locationId}
      />
      <input
        type="hidden"
        name="product_id"
        value={productId === EMPTY_SELECT ? "" : productId}
      />
      <input type="hidden" name="condition" value={condition} />
      <div className="space-y-6">
        <div className="space-y-3">
          <Label
            htmlFor="logistics_location_id"
            className="text-gray-700 dark:text-gray-300"
          >
            물류지<span className="relative -top-1 text-sm text-red-500">*</span>
          </Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="물류지 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={EMPTY_SELECT}>물류지 선택</SelectItem>
                {logisticsLocations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {state.errors?.logistics_location_id && (
            <p className="text-red-500 text-sm">
              {state.errors.logistics_location_id}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="product_id"
            className="text-gray-700 dark:text-gray-300"
          >
            상품<span className="relative -top-1 text-sm text-red-500">*</span>
          </Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="상품 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={EMPTY_SELECT}>상품 선택</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    [{p.product_code}] {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {state.errors?.product_id && (
            <p className="text-red-500 text-sm">{state.errors.product_id}</p>
          )}
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="condition"
            className="text-gray-700 dark:text-gray-300"
          >
            상품 상태
          </Label>
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="상품 상태 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {CONDITION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {state.errors?.condition && (
            <p className="text-red-500 text-sm">{state.errors.condition}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label
              htmlFor="batch_code"
              className="text-gray-700 dark:text-gray-300"
            >
              배치코드<span className="relative -top-1 text-sm text-red-500">*</span>
            </Label>
            <input
              id="batch_code"
              name="batch_code"
              type="text"
              required
              maxLength={255}
              placeholder="고유 배치코드"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
            {state.errors?.batch_code && (
              <p className="text-red-500 text-sm">{state.errors.batch_code}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label
              htmlFor="product_barcode"
              className="text-gray-700 dark:text-gray-300"
            >
              상품바코드
            </Label>
            <input
              id="product_barcode"
              name="product_barcode"
              type="text"
              maxLength={50}
              placeholder="상품바코드 (선택)"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>

          <div className="space-y-3">
            <Label
              htmlFor="quantity"
              className="text-gray-700 dark:text-gray-300"
            >
              수량<span className="relative -top-1 text-sm text-red-500">*</span>
            </Label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              placeholder="입고 수량"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
            {state.errors?.quantity && (
              <p className="text-red-500 text-sm">{state.errors.quantity}</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="memo"
            className="text-gray-700 dark:text-gray-300"
          >
            비고
          </Label>
          <input
            id="memo"
            name="memo"
            type="text"
            maxLength={500}
            placeholder="비고 (선택, 최대 500자)"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label
              htmlFor="stock_date"
              className="text-gray-700 dark:text-gray-300"
            >
              입고일
            </Label>
            <input
              type="hidden"
              name="stock_date"
              value={stockDate ? format(stockDate, "yyyy-MM-dd") : ""}
            />
            <Popover open={stockCalendarOpen} onOpenChange={setStockCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  id="stock_date"
                  variant="outline"
                  data-empty={!stockDate}
                  className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                >
                  {stockDate ? format(stockDate, "yyyy-MM-dd") : <span>입고일 선택</span>}
                  <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                <Calendar
                  mode="single"
                  selected={stockDate}
                  defaultMonth={stockDate ?? new Date()}
                  onSelect={(d) => {
                    setStockDate(d);
                    if (d !== undefined) setStockCalendarOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-3">
            <Label
              htmlFor="expiration_date"
              className="text-gray-700 dark:text-gray-300"
            >
              유통기한<span className="relative -top-1 text-sm text-red-500">*</span>
            </Label>
            <input
              type="hidden"
              name="expiration_date"
              value={
                expirationDate ? format(expirationDate, "yyyy-MM-dd") : ""
              }
              required
            />
            <Popover open={expirationCalendarOpen} onOpenChange={setExpirationCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  id="expiration_date"
                  variant="outline"
                  data-empty={!expirationDate}
                  className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                >
                  {expirationDate
                    ? format(expirationDate, "yyyy-MM-dd")
                    : <span>유통기한 선택</span>}
                  <ChevronDownIcon className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expirationDate}
                  defaultMonth={expirationDate ?? new Date()}
                  onSelect={(d) => {
                    setExpirationDate(d);
                    if (d !== undefined) setExpirationCalendarOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            {state.errors?.expiration_date && (
              <p className="text-red-500 text-sm">
                {state.errors.expiration_date}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <SubmitButton text="입고 등록" />
        <Link href="/stocks" className="w-full">
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
  );
}

