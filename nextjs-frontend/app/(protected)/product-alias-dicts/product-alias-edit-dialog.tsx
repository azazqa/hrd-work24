"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { Pencil } from "lucide-react";

import {
  fetchProductsForAliasSelect,
  updateProductAliasDictGroupDetailed,
  type ProductAliasDictDto,
  type ProductOption,
} from "@/components/actions/product-alias-dicts-action";
import type { ChannelOption } from "@/components/actions/orders-excel-action";
import { makeClientId } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/ui/submitButton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ActionState = { message: string; errors?: Record<string, string[] | undefined> };

const initialState: ActionState = { message: "" };
const EMPTY_PRODUCT = "__empty__";
const EMPTY_CHANNEL = "__empty_channel__";

type Row = { id: string; productId: string; quantity: string };

export function ProductAliasEditDialog({
  representativeAliasItemId,
  channelId,
  alias,
  price,
  commission,
  items,
  channels,
}: {
  representativeAliasItemId: string;
  channelId?: string | null;
  alias: string;
  price: number;
  commission?: number | null;
  items: Array<
    Pick<ProductAliasDictDto, "product_id" | "quantity" | "product_name" | "product_price">
  >;
  channels: ChannelOption[];
}) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [aliasPrice, setAliasPrice] = useState<string>("");
  const [aliasCommission, setAliasCommission] = useState<string>("0");
  const [selectedChannelId, setSelectedChannelId] = useState<string>(EMPTY_CHANNEL);
  const [submitted, setSubmitted] = useState(false);
  const [rows, setRows] = useState<Row[]>(
    items.length
      ? items.map((it) => ({
          id: makeClientId(),
          productId: it.product_id,
          quantity: String(it.quantity ?? 1),
        }))
      : [{ id: makeClientId(), productId: EMPTY_PRODUCT, quantity: "1" }],
  );

  useEffect(() => {
    if (!open) return;
    // 기본은 공란이지만, DB에 값이 있으면 그 값을 보여준다.
    setAliasPrice(price != null ? String(price) : "");
    setAliasCommission(commission != null ? String(commission) : "0");
    setSelectedChannelId(channelId?.trim() ? String(channelId) : EMPTY_CHANNEL);
    setSubmitted(false);
    let cancelled = false;
    fetchProductsForAliasSelect().then((list) => {
      if (cancelled) return;
      setProducts(Array.isArray(list) ? list : []);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const [state, dispatch] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, fd: FormData): Promise<ActionState> => {
      const nextAlias = String(fd.get("alias") ?? "").trim();
      const nextChannelIdRaw = String(fd.get("channel_id") ?? "").trim();
      const nextChannelId =
        nextChannelIdRaw && nextChannelIdRaw !== EMPTY_CHANNEL ? nextChannelIdRaw : null;
      const rawPrice = String(fd.get("price") ?? "").trim();
      const nextPrice = rawPrice === "" ? null : Number(rawPrice);
      const rawCommission = String(fd.get("commission") ?? "").trim();
      const nextCommission = rawCommission === "" ? null : Number(rawCommission);
      const itemsJson = String(fd.get("items_json") ?? "[]");
      let parsed: unknown;
      try {
        parsed = JSON.parse(itemsJson);
      } catch {
        return { message: "상품/수량 정보를 확인해주세요." };
      }
      const desired = (Array.isArray(parsed) ? parsed : [])
        .map((x) => ({
          product_id: String((x as any).product_id ?? ""),
          quantity: Number((x as any).quantity ?? 0),
        }))
        .filter((x) => x.product_id && Number.isInteger(x.quantity) && x.quantity > 0);

      return await updateProductAliasDictGroupDetailed({
        originalAlias: alias,
        originalChannelId: channelId ?? null,
        channel_id: nextChannelId,
        alias: nextAlias,
        price: nextPrice,
        commission: nextCommission,
        items: desired,
      });
    },
    initialState,
  );

  useEffect(() => {
    if (!open) return;
    const hasErrors = Boolean(state?.errors && Object.keys(state.errors).length > 0);
    if (submitted && state?.message === "" && !hasErrors) {
      setOpen(false);
      setSubmitted(false);
    }
  }, [open, submitted, state]);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const computedSum = useMemo(() => {
    return rows.reduce((sum, r) => {
      if (r.productId === EMPTY_PRODUCT) return sum;
      const unit = Number(productById.get(r.productId)?.price ?? 0) || 0;
      const qty = Number(r.quantity) || 0;
      return sum + unit * Math.max(0, qty);
    }, 0);
  }, [rows, productById]);

  const itemsPayload = useMemo(() => {
    return JSON.stringify(
      rows
        .filter((r) => r.productId !== EMPTY_PRODUCT)
        .map((r) => ({
          product_id: r.productId,
          quantity: Number(r.quantity) || 0,
        })),
    );
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground hover:bg-accent"
          title="수정"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>별칭 수정</DialogTitle>
          <DialogDescription>별칭 가격/매핑 상품/수량을 수정합니다.</DialogDescription>
        </DialogHeader>

        <form
          action={(fd) => {
            // 공란이면 price를 보내지 않음(기본값 0 유지)
            const t = aliasPrice.trim();
            if (t !== "") fd.set("price", t);
            const c = aliasCommission.trim();
            if (c !== "") fd.set("commission", c);
            fd.set("items_json", itemsPayload);
            setSubmitted(true);
            dispatch(fd);
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label>채널</Label>
            <Select
              value={selectedChannelId}
              onValueChange={(v) => setSelectedChannelId(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="공용" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={EMPTY_CHANNEL}>공용</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <input
              type="hidden"
              name="channel_id"
              value={selectedChannelId === EMPTY_CHANNEL ? "" : selectedChannelId}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`alias_${representativeAliasItemId}`}>별칭</Label>
            <Input
              id={`alias_${representativeAliasItemId}`}
              name="alias"
              type="text"
              defaultValue={alias}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`price_${representativeAliasItemId}`}>별칭 가격</Label>
            <div className="flex items-center gap-3">
              <Input
                id={`price_${representativeAliasItemId}`}
                name="price_visible"
                type="number"
                min={0}
                step={1}
                value={aliasPrice}
                onChange={(e) => setAliasPrice(e.target.value)}
                className="w-56"
                placeholder="상품 전체 가격을 입력해 주세요."
              />
              <span className="text-sm text-muted-foreground">
                상품 가격 합계(참고): {computedSum}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`commission_${representativeAliasItemId}`}>수수료</Label>
            <Input
              id={`commission_${representativeAliasItemId}`}
              name="commission_visible"
              type="number"
              min={0}
              step={1}
              value={aliasCommission}
              onChange={(e) => setAliasCommission(e.target.value)}
              className="w-56"
              placeholder="기본값 0"
            />
          </div>

          <div className="space-y-2">
            <Label>매핑 상품</Label>
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <Select
                    value={r.productId}
                    onValueChange={(v) =>
                      setRows((prev) =>
                        prev.map((x) => (x.id === r.id ? { ...x, productId: v } : x)),
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
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    min={1}
                    step={1}
                    className="w-24"
                    value={r.quantity}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id === r.id ? { ...x, quantity: e.target.value } : x,
                        ),
                      )
                    }
                  />

                  <div className="w-52 text-xs text-muted-foreground">
                    단가 {Number(productById.get(r.productId)?.price ?? 0) || 0} / 합계{" "}
                    {(Number(productById.get(r.productId)?.price ?? 0) || 0) *
                      (Number(r.quantity) || 0)}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setRows((prev) =>
                        prev.length <= 1 ? prev : prev.filter((x) => x.id !== r.id),
                      )
                    }
                    disabled={rows.length <= 1}
                  >
                    삭제
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  { id: makeClientId(), productId: EMPTY_PRODUCT, quantity: "1" },
                ])
              }
            >
              추가
            </Button>
          </div>

          <DialogFooter className="gap-2">
            <SubmitButton text="저장" />
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
          </DialogFooter>

          {state?.message && (
            <p className="text-sm text-destructive text-center">{state.message}</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

