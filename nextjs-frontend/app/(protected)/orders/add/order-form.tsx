"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  addOrder,
  fetchProductsForOrderSelect,
  fetchChannelsForOrderSelect,
} from "@/components/actions/orders-action";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submitButton";
import Link from "next/link";
import { makeClientId } from "@/lib/utils";

type ProductOption = { id: string; name: string; code?: string };
type ChannelOption = { id: string; name: string };

interface OrderFormProps {
  products?: ProductOption[];
}

type OrderFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

const initialState: OrderFormState = { message: "" };
const EMPTY_PRODUCT = "__empty__";
const EMPTY_CHANNEL = "__empty_channel__";

type OrderItemForm = {
  id: string;
  productId: string;
  quantity: string;
};

export function OrderForm({ products: initialProducts = [] }: OrderFormProps) {
  const [state, dispatch] = useActionState<OrderFormState, FormData>(addOrder, initialState);
  const [products, setProducts] = useState<ProductOption[]>(initialProducts);
  const [channelId, setChannelId] = useState<string>(EMPTY_CHANNEL);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [items, setItems] = useState<OrderItemForm[]>([
    { id: makeClientId(), productId: EMPTY_PRODUCT, quantity: "1" },
  ]);

  useEffect(() => {
    let cancelled = false;
    fetchProductsForOrderSelect().then((list) => {
      if (!cancelled && Array.isArray(list)) setProducts(list);
    });
    fetchChannelsForOrderSelect().then((list) => {
      if (
        !cancelled &&
        Array.isArray(list) &&
        list.every((c) => typeof c?.id === "string" && typeof c?.name === "string")
      ) {
        setChannels(list as ChannelOption[]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalQuantity = items.reduce((sum, it) => {
    const n = Number(it.quantity);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);

  const itemsPayload = JSON.stringify(
    items
      .filter((it) => it.productId !== EMPTY_PRODUCT)
      .map((it) => ({
        product_id: it.productId,
        quantity: Number(it.quantity) || 0,
      })),
  );

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { id: makeClientId(), productId: EMPTY_PRODUCT, quantity: "1" },
    ]);
  };

  const removeItemRow = (id: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.id !== id)));
  };

  return (
    <form
      action={dispatch}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6"
    >
      <input
        type="hidden"
        name="channel_id"
        value={channelId === EMPTY_CHANNEL ? "" : channelId}
      />
      <input type="hidden" name="items_json" value={itemsPayload} />
      <div className="space-y-8">
        {/* 주문 정보 */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white border-b pb-2">
            주문 정보
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label
                htmlFor="channel_id"
                className="text-gray-700 dark:text-gray-300"
              >
                채널<span className="relative -top-1 text-sm text-red-500">*</span>
              </Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="채널 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={EMPTY_CHANNEL}>채널 선택</SelectItem>
                    {channels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {state.errors?.channel_id && (
                <p className="text-red-500 text-sm">
                  {state.errors.channel_id}
                </p>
              )}
            </div>
            <div className="space-y-3">
              <Label className="text-gray-700 dark:text-gray-300">
                총 수량
              </Label>
              <div className="text-lg font-semibold">
                {totalQuantity} 개
              </div>
              {state.errors?.items && (
                <p className="text-red-500 text-sm">
                  {state.errors.items.join(", ")}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-gray-700 dark:text-gray-300">
                주문 상품 라인
              </Label>
              <Button type="button" variant="outline" onClick={addItemRow}>
                추가
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex gap-3 items-center">
                  <Select
                    value={it.productId}
                    onValueChange={(v) =>
                      setItems((prev) =>
                        prev.map((row) =>
                          row.id === it.id ? { ...row, productId: v } : row,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="상품 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={EMPTY_PRODUCT}>상품 선택</SelectItem>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.code ? `[${p.code}] ` : ""}
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    className="w-24"
                    value={it.quantity}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row) =>
                          row.id === it.id ? { ...row, quantity: e.target.value } : row,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeItemRow(it.id)}
                    disabled={items.length <= 1}
                  >
                    삭제
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label
                htmlFor="price"
                className="text-gray-700 dark:text-gray-300"
              >
                금액<span className="relative -top-1 text-sm text-red-500">*</span>
              </Label>
              <Input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                required
                className="w-full border-gray-300 dark:border-gray-600"
              />
              {state.errors?.price && (
                <p className="text-red-500 text-sm">{state.errors.price}</p>
              )}
            </div>
            <div className="space-y-3">
              <Label
                htmlFor="quantity"
                className="text-gray-700 dark:text-gray-300"
              >
                수량<span className="relative -top-1 text-sm text-red-500">*</span>
              </Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                step="1"
                placeholder="1"
                required
                className="w-full border-gray-300 dark:border-gray-600"
              />
              {state.errors?.quantity && (
                <p className="text-red-500 text-sm">
                  {state.errors.quantity}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label htmlFor="memo" className="text-gray-700 dark:text-gray-300">
                메모
              </Label>
              <Input
                id="memo"
                name="memo"
                type="text"
                placeholder="주문 메모 (선택)"
                className="w-full border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>
        </section>

        {/* 수취인 정보 */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white border-b pb-2">
            수취인 정보
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label
                htmlFor="receiver_name"
                className="text-gray-700 dark:text-gray-300"
              >
                수취인명<span className="relative -top-1 text-sm text-red-500">*</span>
              </Label>
              <Input
                id="receiver_name"
                name="receiver_name"
                type="text"
                placeholder="수취인 이름"
                required
                className="w-full border-gray-300 dark:border-gray-600"
              />
              {state.errors?.receiver_name && (
                <p className="text-red-500 text-sm">
                  {state.errors.receiver_name}
                </p>
              )}
            </div>
            <div className="space-y-3">
              <Label
                htmlFor="receiver_phone"
                className="text-gray-700 dark:text-gray-300"
              >
                연락처<span className="relative -top-1 text-sm text-red-500">*</span>
              </Label>
              <Input
                id="receiver_phone"
                name="receiver_phone"
                type="text"
                placeholder="010-0000-0000"
                required
                className="w-full border-gray-300 dark:border-gray-600"
              />
              {state.errors?.receiver_phone && (
                <p className="text-red-500 text-sm">
                  {state.errors.receiver_phone}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <Label
              htmlFor="receiver_zip_code"
              className="text-gray-700 dark:text-gray-300"
            >
              우편번호<span className="relative -top-1 text-sm text-red-500">*</span>
            </Label>
            <Input
              id="receiver_zip_code"
              name="receiver_zip_code"
              type="text"
              placeholder="우편번호"
              required
              className="w-full border-gray-300 dark:border-gray-600"
            />
            {state.errors?.receiver_zip_code && (
              <p className="text-red-500 text-sm">
                {state.errors.receiver_zip_code}
              </p>
            )}
          </div>
          <div className="space-y-3">
            <Label
              htmlFor="receiver_address"
              className="text-gray-700 dark:text-gray-300"
            >
              주소<span className="relative -top-1 text-sm text-red-500">*</span>
            </Label>
            <Input
              id="receiver_address"
              name="receiver_address"
              type="text"
              placeholder="기본 주소"
              required
              className="w-full border-gray-300 dark:border-gray-600"
            />
            {state.errors?.receiver_address && (
              <p className="text-red-500 text-sm">
                {state.errors.receiver_address}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label
                htmlFor="receiver_address_detail"
                className="text-gray-700 dark:text-gray-300"
              >
                상세주소
              </Label>
              <Input
                id="receiver_address_detail"
                name="receiver_address_detail"
                type="text"
                placeholder="상세주소 (선택)"
                className="w-full border-gray-300 dark:border-gray-600"
              />
            </div>
            <div className="space-y-3">
              <Label
                htmlFor="receiver_email"
                className="text-gray-700 dark:text-gray-300"
              >
                이메일
              </Label>
              <Input
                id="receiver_email"
                name="receiver_email"
                type="email"
                placeholder="email@example.com (선택)"
                className="w-full border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="flex gap-3">
        <SubmitButton text="등록" />
        <Link href="/orders" className="w-full">
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
