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
  addProductAliasDict,
  type ProductAliasDictDto,
  fetchProductsForAliasSelect,
  fetchProductAliasDictsByProductId,
  type ProductOption,
} from "@/components/actions/product-alias-dicts-action";
import { fetchChannelsForExcelSelect, type ChannelOption } from "@/components/actions/orders-excel-action";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submitButton";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { makeClientId } from "@/lib/utils";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const initialState = { message: "" };
const EMPTY_PRODUCT = "__empty__";
const EMPTY_CHANNEL = "__empty_channel__";

type AliasItemForm = {
  id: string;
  productId: string;
  quantity: string;
};

export default function AddProductAliasDictPage() {
  const [state, dispatch] = useActionState(addProductAliasDict, initialState);
  const [channelId, setChannelId] = useState<string>(EMPTY_CHANNEL);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [productId, setProductId] = useState<string>(EMPTY_PRODUCT);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [aliases, setAliases] = useState<ProductAliasDictDto[]>([]);
  const [items, setItems] = useState<AliasItemForm[]>([
    { id: makeClientId(), productId: EMPTY_PRODUCT, quantity: "1" },
  ]);
  const [aliasPrice, setAliasPrice] = useState<string>("");
  const [aliasCommission, setAliasCommission] = useState<string>("0");

  useEffect(() => {
    let cancelled = false;
    fetchProductsForAliasSelect().then((list) => {
      if (!cancelled && Array.isArray(list)) setProducts(list);
    });
    fetchChannelsForExcelSelect().then((list) => {
      if (!cancelled && Array.isArray(list)) setChannels(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (productId === EMPTY_PRODUCT || !productId) {
      setAliases([]);
      return;
    }
    let cancelled = false;
    fetchProductAliasDictsByProductId(productId).then((list) => {
      if (!cancelled) setAliases(list ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const itemsPayload = JSON.stringify(
    items
      .filter((it) => it.productId !== EMPTY_PRODUCT)
      .map((it) => ({
        product_id: it.productId,
        quantity: Number(it.quantity) || 0,
      })),
  );

  const totalQuantity = items.reduce((sum, it) => {
    const n = Number(it.quantity);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);

  const productById = new Map(products.map((p) => [p.id, p]));
  const computedSum = items.reduce((sum, it) => {
    if (it.productId === EMPTY_PRODUCT) return sum;
    const qty = Number(it.quantity) || 0;
    const unit = Number(productById.get(it.productId)?.price ?? 0) || 0;
    return sum + unit * Math.max(0, qty);
  }, 0);

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
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
          상품 별칭 등록
          <Tooltip>
            <TooltipTrigger className="inline-block ml-2">
              <CircleHelp className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>상품과 매칭할 별칭을 입력해주세요. (엑셀 등에서 사용되는 상품명과 매칭용)</p>
            </TooltipContent>
          </Tooltip>
        </h1>
      </header>

      <form
        action={dispatch}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6"
      >
        <input type="hidden" name="items_json" value={itemsPayload} />
        <input type="hidden" name="price" value={aliasPrice} />
        <input type="hidden" name="commission" value={aliasCommission} />
        {channelId !== EMPTY_CHANNEL && (
          <input type="hidden" name="channel_id" value={channelId} />
        )}

        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-gray-700 dark:text-gray-300">채널</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger className="w-full border-gray-300 dark:border-gray-600">
                <SelectValue placeholder="전체(공용)" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={EMPTY_CHANNEL}>전체(공용)</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              채널을 선택하면 해당 채널에서만 적용되는 별칭으로 저장됩니다. 선택하지 않으면 공용 별칭입니다.
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="alias" className="text-gray-700 dark:text-gray-300">
              별칭<span className="relative -top-1 text-sm text-red-500">*</span>
            </Label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              한 별칭에 여러 상품과 수량을 등록할 수 있습니다.
            </p>
            <Input
              id="alias"
              name="alias"
              type="text"
              placeholder="예: 쇼핑몰에 표시되는 상품명"
              required
              className="w-full border-gray-300 dark:border-gray-600"
            />
            {state.errors?.alias && (
              <p className="text-red-500 text-sm">{state.errors.alias}</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">
                  별칭에 매핑할 상품들
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  동일한 별칭으로 여러 상품과 수량을 한 번에 등록할 수 있습니다.
                </p>
              </div>
              <Button type="button" onClick={addItemRow}>
                추가
              </Button>
            </div>
            {state.errors?.items && (
              <p className="text-red-500 text-sm">{state.errors.items.join(", ")}</p>
            )}
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-3">
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
                    <SelectTrigger className="w-full border-gray-300 dark:border-gray-600">
                      <SelectValue placeholder="상품 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={EMPTY_PRODUCT}>상품 선택</SelectItem>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    className="w-24 border-gray-300 dark:border-gray-600"
                    value={it.quantity}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row) =>
                          row.id === it.id ? { ...row, quantity: e.target.value } : row,
                        ),
                      )
                    }
                  />
                  <div className="w-56 text-sm text-muted-foreground">
                    {it.productId !== EMPTY_PRODUCT ? (
                      <>
                        단가 {Number(productById.get(it.productId)?.price ?? 0) || 0} / 합계{" "}
                        {(Number(productById.get(it.productId)?.price ?? 0) || 0) *
                          (Number(it.quantity) || 0)}
                      </>
                    ) : (
                      "단가/합계 —"
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => removeItemRow(it.id)}
                    disabled={items.length <= 1}
                  >
                    삭제
                  </Button>
                </div>
              ))}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              총 수량: {totalQuantity} 개
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="price" className="text-gray-700 dark:text-gray-300">
              별칭 가격
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="price"
                name="price_visible"
                type="number"
                min={0}
                step={1}
                value={aliasPrice}
                onChange={(e) => setAliasPrice(e.target.value)}
                className="w-48 border-gray-300 dark:border-gray-600"
                placeholder="상품 전체 가격을 입력해 주세요."
              />
              <span className="text-sm text-muted-foreground">
                상품 가격 합계(참고): {computedSum}
              </span>
            </div>
            {state.errors?.price && (
              <p className="text-red-500 text-sm">{state.errors.price}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label htmlFor="commission" className="text-gray-700 dark:text-gray-300">
              수수료
            </Label>
            <Input
              id="commission"
              name="commission_visible"
              type="number"
              min={0}
              step={1}
              value={aliasCommission}
              onChange={(e) => setAliasCommission(e.target.value)}
              className="w-full border-gray-300 dark:border-gray-600"
              placeholder="기본값 0"
            />
            {state.errors?.commission && (
              <p className="text-red-500 text-sm">{state.errors.commission}</p>
            )}
          </div>

        </div>

        <div className="flex gap-3">
          <SubmitButton text="등록" />
          <Link href="/product-alias-dicts" className="w-full">
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

      {productId !== EMPTY_PRODUCT && (
        <section className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            선택된 상품의 별칭 목록
          </h2>
          {aliases.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              등록된 별칭이 없습니다.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-full">별칭</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aliases.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.alias}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}
    </div>
  );
}
