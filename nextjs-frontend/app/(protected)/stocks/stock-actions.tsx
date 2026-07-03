"use client";

import { useState, useEffect } from "react";
import {
  restockStock,
  releaseStockAction,
  updateStockAction,
  changeStockConditionAction,
  transferStockAction,
} from "@/components/actions/stocks-action";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ButtonGroup } from "@/components/ui/button-group"
import { StockDeleteButton } from "./deleteButton";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { ArrowLeftRight, Plus, Minus, Pencil, RefreshCw } from "lucide-react";
import type { StockListRead } from "@/app/openapi-client";

const CONDITION_OPTIONS: { value: string; label: string }[] = [
  { value: "normal", label: "정상" },
  { value: "refurb", label: "리퍼" },
  { value: "disposal", label: "폐기" },
  { value: "undecided", label: "미정" },
];

interface StockActionsProps {
  stock: StockListRead;
  logisticsLocations: { id: string; name: string }[];
}

/** 재고 목록에서 버튼 4개(수정/재입고/출고/삭제) 사용 */
export function StockActions({
  stock,
  logisticsLocations,
}: StockActionsProps) {
  const stockId = stock.id;
  const currentQuantity = stock.quantity ?? 0;
  const currentLocationId =
    stock.logistics_location_id ?? stock.logistics_location?.id ?? "";
  const currentLocationName = stock.logistics_location?.name ?? "물류지 없음";
  const transferableLocations = logisticsLocations.filter(
    (l) => l.id !== currentLocationId,
  );

  const [restockOpen, setRestockOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [changeConditionOpen, setChangeConditionOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [restockQty, setRestockQty] = useState("");
  const [restockReason, setRestockReason] = useState("");
  const [releaseQty, setReleaseQty] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [restockError, setRestockError] = useState("");
  const [releaseError, setReleaseError] = useState("");
  const [editError, setEditError] = useState("");
  const [restockLoading, setRestockLoading] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [changeConditionLoading, setChangeConditionLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [changeConditionQty, setChangeConditionQty] = useState("");
  const [toCondition, setToCondition] = useState("refurb");
  const [changeConditionReason, setChangeConditionReason] = useState("");
  const [changeConditionError, setChangeConditionError] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferError, setTransferError] = useState("");

  const [editLocationId, setEditLocationId] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editBatchCode, setEditBatchCode] = useState("");
  const [editStockDate, setEditStockDate] = useState<Date | undefined>();
  const [editExpirationDate, setEditExpirationDate] = useState<Date | undefined>();
  const [editCondition, setEditCondition] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [editProductBarcode, setEditProductBarcode] = useState("");
  const [editStockDateCalendarOpen, setEditStockDateCalendarOpen] =
    useState(false);
  const [editExpirationDateCalendarOpen, setEditExpirationDateCalendarOpen] =
    useState(false);

  useEffect(() => {
    if (!editOpen) {
      setEditStockDateCalendarOpen(false);
      setEditExpirationDateCalendarOpen(false);
      return;
    }
    setEditLocationId(stock.logistics_location_id ?? stock.logistics_location?.id ?? "");
    setEditQuantity(String(stock.quantity ?? ""));
    setEditBatchCode(stock.batch_code ?? "");
    setEditStockDate(stock.stock_date ? new Date(stock.stock_date) : undefined);
    setEditExpirationDate(stock.expiration_date ? new Date(stock.expiration_date) : undefined);
    setEditCondition(stock.condition ?? "normal");
    setEditMemo(stock.memo ?? "");
    setEditProductBarcode(stock.product_barcode ?? "");
    setEditError("");
  }, [editOpen, stock]);

  const handleRestockSubmit = async () => {
    const qty = Number(restockQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setRestockError("1 이상의 정수를 입력해주세요");
      return;
    }
    setRestockLoading(true);
    const result = await restockStock(stockId, qty, restockReason.trim() || undefined);
    setRestockLoading(false);
    if (result?.message) {
      setRestockError(result.message);
    } else {
      setRestockOpen(false);
      setRestockQty("");
      setRestockReason("");
      setRestockError("");
    }
  };

  const handleReleaseSubmit = async () => {
    const qty = Number(releaseQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setReleaseError("1 이상의 정수를 입력해주세요");
      return;
    }
    if (qty > currentQuantity) {
      setReleaseError(`재고 부족: 현재 ${currentQuantity}개`);
      return;
    }
    setReleaseLoading(true);
    const result = await releaseStockAction(stockId, qty, releaseReason.trim() || undefined);
    setReleaseLoading(false);
    if (result?.message) {
      setReleaseError(result.message);
    } else {
      setReleaseOpen(false);
      setReleaseQty("");
      setReleaseReason("");
      setReleaseError("");
    }
  };

  const handleEditSubmit = async () => {
    const qty = Number(editQuantity);
    if (!Number.isInteger(qty) || qty < 0) {
      setEditError("수량은 0 이상의 정수여야 합니다.");
      return;
    }
    if (!editExpirationDate) {
      setEditError("유통기한을 선택해주세요.");
      return;
    }
    setEditLoading(true);
    const result = await updateStockAction(stockId, {
      logistics_location_id: editLocationId || null,
      quantity: qty,
      batch_code: editBatchCode.trim() || null,
      stock_date: editStockDate ? format(editStockDate, "yyyy-MM-dd") : null,
      expiration_date: format(editExpirationDate, "yyyy-MM-dd"),
      condition: editCondition,
      memo: editMemo.trim() || null,
      product_barcode: editProductBarcode.trim() || null,
    });
    setEditLoading(false);
    if (result?.message) {
      setEditError(result.message);
    } else {
      setEditOpen(false);
      setEditError("");
    }
  };

  const handleChangeConditionSubmit = async () => {
    const qty = Number(changeConditionQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setChangeConditionError("1 이상의 정수를 입력해주세요");
      return;
    }
    if (qty > currentQuantity) {
      setChangeConditionError(`재고 부족: 현재 ${currentQuantity}개`);
      return;
    }
    if (toCondition === (stock.condition ?? "normal")) {
      setChangeConditionError("현재 상태와 동일한 상태로는 변경할 수 없습니다.");
      return;
    }
    setChangeConditionLoading(true);
    const result = await changeStockConditionAction(
      stockId,
      qty,
      toCondition as "normal" | "refurb" | "disposal" | "undecided",
      changeConditionReason.trim() || undefined,
    );
    setChangeConditionLoading(false);
    if (result?.message) {
      setChangeConditionError(result.message);
    } else {
      setChangeConditionOpen(false);
      setChangeConditionQty("");
      setChangeConditionReason("");
      setChangeConditionError("");
    }
  };

  const handleTransferSubmit = async () => {
    const qty = Number(transferQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setTransferError("1 이상의 정수를 입력해주세요");
      return;
    }
    if (qty > currentQuantity) {
      setTransferError(`재고 부족: 현재 ${currentQuantity}개`);
      return;
    }
    if (!toLocationId) {
      setTransferError("대상 물류지를 선택해주세요.");
      return;
    }
    if (toLocationId === currentLocationId) {
      setTransferError("현재 물류지와 동일한 물류지로는 이동할 수 없습니다.");
      return;
    }
    setTransferLoading(true);
    const result = await transferStockAction(
      stockId,
      qty,
      toLocationId,
      transferReason.trim() || undefined,
    );
    setTransferLoading(false);
    if (result?.message) {
      setTransferError(result.message);
    } else {
      setTransferOpen(false);
      setTransferQty("");
      setTransferReason("");
      setTransferError("");
    }
  };

  return (
    <>
      <div className="flex items-center justify-center gap-1">
      <ButtonGroup>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="w-7 h-7 text-muted-foreground text-indigo-700 hover:text-indigo-900 hover:bg-accent"
          onClick={() => {
            setToCondition(
              (stock.condition ?? "normal") === "refurb" ? "normal" : "refurb",
            );
            setChangeConditionError("");
            setChangeConditionQty("");
            setChangeConditionReason("");
            setChangeConditionOpen(true);
          }}
          title="상태 변경"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="w-7 h-7 text-muted-foreground text-cyan-700 hover:text-cyan-900 hover:bg-accent"
          onClick={() => {
            setToLocationId("");
            setTransferError("");
            setTransferQty("");
            setTransferReason("");
            setTransferOpen(true);
          }}
          title="물류지 이동"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="w-7 h-7 text-muted-foreground text-blue-700 hover:text-blue-900 hover:bg-accent"
          onClick={() => setRestockOpen(true)}
          title="재입고"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="w-7 h-7 text-muted-foreground text-amber-700 hover:text-amber-900 hover:bg-accent"
          onClick={() => setReleaseOpen(true)}
          title="출고"
        >
          <Minus className="w-4 h-4" />
        </Button>
      </ButtonGroup>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary hover:bg-accent"
          onClick={() => setEditOpen(true)}
          title="수정"
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <StockDeleteButton stock={stock} />
      </div>

      <Dialog open={restockOpen} onOpenChange={setRestockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>재입고</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="restock-qty">추가 수량</Label>
              <Input
                id="restock-qty"
                type="number"
                min={1}
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                placeholder="수량 입력"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restock-reason">사유 (선택)</Label>
              <Input
                id="restock-reason"
                value={restockReason}
                onChange={(e) => setRestockReason(e.target.value)}
                placeholder="재입고 사유"
                maxLength={500}
              />
            </div>
            {restockError && (
              <p className="text-red-500 text-sm">{restockError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockOpen(false)}>
              취소
            </Button>
            <Button onClick={handleRestockSubmit} disabled={restockLoading}>
              {restockLoading ? "처리중..." : "확인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>출고 (현재 재고: {currentQuantity}개)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="release-qty">출고 수량</Label>
              <Input
                id="release-qty"
                type="number"
                min={1}
                max={currentQuantity}
                value={releaseQty}
                onChange={(e) => setReleaseQty(e.target.value)}
                placeholder="수량 입력"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="release-reason">사유 (선택)</Label>
              <Input
                id="release-reason"
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                placeholder="출고 사유"
                maxLength={500}
              />
            </div>
            {releaseError && (
              <p className="text-red-500 text-sm">{releaseError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseOpen(false)}>
              취소
            </Button>
            <Button onClick={handleReleaseSubmit} disabled={releaseLoading}>
              {releaseLoading ? "처리중..." : "확인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>재고 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>상품</Label>
              <p className="text-sm text-muted-foreground">
                {stock.product
                  ? `[${stock.product.product_code}] ${stock.product.name}`
                  : "-"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">물류지</Label>
              <Select
                value={editLocationId || "__none__"}
                onValueChange={(v) => setEditLocationId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger id="edit-location">
                  <SelectValue placeholder="물류지 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__none__">없음</SelectItem>
                    {logisticsLocations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-quantity">수량 *</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  min={0}
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-condition">상품 상태</Label>
                <Select value={editCondition} onValueChange={setEditCondition}>
                  <SelectTrigger id="edit-condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>배치코드</Label>
                <Input
                  value={editBatchCode}
                  onChange={(e) => setEditBatchCode(e.target.value)}
                  placeholder="선택"
                />
              </div>
              <div className="space-y-2">
                <Label>상품바코드</Label>
                <Input
                  value={editProductBarcode}
                  onChange={(e) => setEditProductBarcode(e.target.value)}
                  maxLength={50}
                  placeholder="선택"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>입고일</Label>
                <Popover
                  open={editStockDateCalendarOpen}
                  onOpenChange={setEditStockDateCalendarOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start font-normal"
                    >
                      {editStockDate
                        ? format(editStockDate, "yyyy-MM-dd")
                        : "선택"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto overflow-hidden p-0"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      selected={editStockDate}
                      defaultMonth={editStockDate ?? new Date()}
                      onSelect={(d) => {
                        setEditStockDate(d);
                        if (d !== undefined) setEditStockDateCalendarOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>유통기한 *</Label>
                <Popover
                  open={editExpirationDateCalendarOpen}
                  onOpenChange={setEditExpirationDateCalendarOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start font-normal"
                    >
                      {editExpirationDate
                        ? format(editExpirationDate, "yyyy-MM-dd")
                        : "선택"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto overflow-hidden p-0"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      selected={editExpirationDate}
                      defaultMonth={editExpirationDate ?? new Date()}
                      onSelect={(d) => {
                        setEditExpirationDate(d);
                        if (d !== undefined)
                          setEditExpirationDateCalendarOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-memo">비고</Label>
              <Input
                id="edit-memo"
                value={editMemo}
                onChange={(e) => setEditMemo(e.target.value)}
                maxLength={500}
                placeholder="선택 (최대 500자)"
              />
            </div>
            {editError && (
              <p className="text-red-500 text-sm">{editError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              취소
            </Button>
            <Button onClick={handleEditSubmit} disabled={editLoading}>
              {editLoading ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changeConditionOpen} onOpenChange={setChangeConditionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상태 변경 (현재 재고: {currentQuantity}개)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="change-condition-qty">변경 수량</Label>
              <Input
                id="change-condition-qty"
                type="number"
                min={1}
                max={currentQuantity}
                value={changeConditionQty}
                onChange={(e) => setChangeConditionQty(e.target.value)}
                placeholder="수량 입력"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-condition-to">변경할 상태</Label>
              <Select value={toCondition} onValueChange={setToCondition}>
                <SelectTrigger id="change-condition-to">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-condition-reason">사유 (선택)</Label>
              <Input
                id="change-condition-reason"
                value={changeConditionReason}
                onChange={(e) => setChangeConditionReason(e.target.value)}
                placeholder="상태 변경 사유"
                maxLength={500}
              />
            </div>
            {changeConditionError && (
              <p className="text-red-500 text-sm">{changeConditionError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeConditionOpen(false)}>
              취소
            </Button>
            <Button onClick={handleChangeConditionSubmit} disabled={changeConditionLoading}>
              {changeConditionLoading ? "처리중..." : "확인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              물류지 이동 ({currentLocationName} - 현재 재고: {currentQuantity}개)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="transfer-qty">이동 수량</Label>
              <Input
                id="transfer-qty"
                type="number"
                min={1}
                max={currentQuantity}
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                placeholder="수량 입력"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to-location">대상 물류지</Label>
              <Select value={toLocationId} onValueChange={setToLocationId}>
                <SelectTrigger id="to-location">
                  <SelectValue placeholder="물류지 선택" />
                </SelectTrigger>
                <SelectContent>
                  {transferableLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-reason">사유 (선택)</Label>
              <Input
                id="transfer-reason"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="물류지 이동 사유"
                maxLength={500}
              />
            </div>
            {transferError && (
              <p className="text-red-500 text-sm">{transferError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              취소
            </Button>
            <Button onClick={handleTransferSubmit} disabled={transferLoading}>
              {transferLoading ? "처리중..." : "확인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

