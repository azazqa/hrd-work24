import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any

from fastapi_users import schemas
from pydantic import BaseModel, Field, PlainSerializer, field_validator
from uuid import UUID

from app.models import (
    ProductState,
    StockHistoryActionType,
    OrderStatus,
    OrderHistoryActionType,
    SettlementState,
    LogisticsLocationState,
    StockCondition,
)


def _serialize_datetime_utc(dt: datetime) -> str:
    """
    Backward-compatible datetime serialization.
    - naive datetime: treat as UTC and append 'Z'
    - aware datetime: keep its offset
    """
    if dt.tzinfo is None:
        return dt.isoformat() + "Z"
    return dt.isoformat()


DateTimeUtc = Annotated[
    datetime, PlainSerializer(_serialize_datetime_utc, when_used="always")
]

class UserRead(schemas.BaseUser[uuid.UUID]):
    logistics_location_id: UUID | None = None
    # 목록 등 join 로드 시에만 채움 (미로드 시 None)
    logistics_location_name: str | None = None
    department: str | None = None
    full_name: str | None = None
    phone: str | None = None
    extension_number: str | None = None


class UserCreate(schemas.BaseUserCreate):
    department: str | None = Field(default=None, max_length=128)
    full_name: str | None = Field(default=None, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    extension_number: str | None = Field(default=None, max_length=32)


class UserUpdate(schemas.BaseUserUpdate):
    logistics_location_id: UUID | None = None
    department: str | None = Field(default=None, max_length=128)
    full_name: str | None = Field(default=None, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    extension_number: str | None = Field(default=None, max_length=32)

# ---------- Courier ----------

class CourierBase(BaseModel):
    name: str
    url: str | None = None


class CourierCreate(CourierBase):
    pass


class CourierUpdate(BaseModel):
    name: str | None = None
    url: str | None = None


class CourierRead(CourierBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Channel ----------

ORDER_EXCEL_CANONICAL_LABELS: frozenset[str] = frozenset(
    {
        "채널",
        "수취인명",
        "상품명",
        "수량",
        "총 주문금액",
        "수취인연락처",
        "우편번호",
        "통합배송지",
        "배송메세지",
    }
)


class OrderExcelColumnMapEntry(BaseModel):
    label: str = ""

    @field_validator("label")
    @classmethod
    def label_must_be_canonical_or_empty(cls, v: str) -> str:
        s = (v or "").strip()
        if s and s not in ORDER_EXCEL_CANONICAL_LABELS:
            raise ValueError(f"Unknown order excel label: {s}")
        return s


class OrderExcelMapping(BaseModel):
    header_row: int = Field(default=1, ge=1)
    columns: dict[str, OrderExcelColumnMapEntry] = Field(default_factory=dict)
    source_headers: list[str] | None = Field(
        default=None,
        description="업로드 샘플 엑셀의 헤더 행 전체(열 순서대로, 원본 문자열).",
    )


class ChannelBase(BaseModel):
    name: str
    description: str | None = None
    url: str | None = Field(default=None, max_length=2048)
    courier_id: UUID | None = None
    order_excel_mapping: OrderExcelMapping | None = None


class ChannelCreate(ChannelBase):
    pass


class ChannelUpdate(ChannelBase):
    name: str | None = None
    courier_id: UUID | None = None


class ChannelRead(ChannelBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    courier_name: str | None = None
    order_excel_mapping_warnings: list[str] = Field(
        default_factory=list,
        description="DB 매핑과 현재 표준 필드 불일치 등 안내(저장 원본 JSONB는 변경 없음)",
    )

    model_config = {"from_attributes": True}


# ---------- Notice ----------

class NoticeCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class NoticeRead(BaseModel):
    id: UUID
    content: str
    update_user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Category ----------

class CategoryBase(BaseModel):
    name: str
    description: str | None = None
    parent_id: UUID | None = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(CategoryBase):
    name: str | None = None


class CategoryRead(CategoryBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    parent_name: str | None = None

    model_config = {"from_attributes": True}


# ---------- Product ----------

class ProductBase(BaseModel):
    category_id: UUID
    product_code: str
    name: str
    description: str | None = None
    price: int | None = 0
    is_tax: bool = False
    tax_rate: float | None = None
    max_shipping_number: int | None = None
    state: ProductState = ProductState.ACTIVE


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    category_id: UUID | None = None
    product_code: str | None = None
    name: str | None = None
    description: str | None = None
    price: int | None = None
    is_tax: bool | None = None
    tax_rate: float | None = None
    max_shipping_number: int | None = None
    state: ProductState | None = None


class ProductRead(ProductBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- ProductAliasDict ----------

class ProductAliasDictBase(BaseModel):
    channel_id: UUID | None = None
    product_id: UUID
    alias: str
    quantity: int = 1
    price: int | None = 0
    commission: int | None = 0


class ProductAliasDictCreate(ProductAliasDictBase):
    pass


class ProductAliasDictUpdate(BaseModel):
    channel_id: UUID | None = None
    product_id: UUID | None = None
    alias: str | None = None
    quantity: int | None = None
    price: int | None = None
    commission: int | None = None


class ProductAliasDictRead(ProductAliasDictBase):
    id: UUID
    alias_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    channel_name: str | None = None
    product_name: str | None = None
    product_price: int | None = None

    model_config = {"from_attributes": True}

# ---------- Stock ----------

class LogisticsLocationSummary(BaseModel):
    id: UUID
    name: str

    model_config = {"from_attributes": True}


class StockBase(BaseModel):
    product_id: UUID
    logistics_location_id: UUID | None = None
    quantity: int
    batch_code: str = Field(..., min_length=1, max_length=255)
    stock_date: datetime | None = None
    expiration_date: datetime
    condition: StockCondition = StockCondition.NORMAL
    memo: str | None = None
    product_barcode: str | None = None

    @field_validator("batch_code", mode="before")
    @classmethod
    def _strip_batch_code(cls, v: object) -> str:
        if v is None:
            return ""
        s = str(v).strip()
        return s


class StockCreate(StockBase):
    logistics_location_id: UUID


class StockUpdate(BaseModel):
    """재고 수정 시 전달. 모두 선택."""
    logistics_location_id: UUID | None = None
    quantity: int | None = None
    batch_code: str | None = None
    stock_date: datetime | None = None
    expiration_date: datetime | None = None
    condition: StockCondition | None = None
    memo: str | None = None
    product_barcode: str | None = None


class StockRestock(BaseModel):
    quantity: int
    reason: str | None = None


class StockRelease(BaseModel):
    quantity: int
    reason: str | None = None


class StockConditionChange(BaseModel):
    quantity: int
    to_condition: StockCondition
    reason: str | None = None


class StockTransfer(BaseModel):
    quantity: int
    to_logistics_location_id: UUID
    reason: str | None = None


class StockRead(StockBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    logistics_location: LogisticsLocationSummary | None = None

    model_config = {"from_attributes": True}


# ---------- StockHistory ----------

class StockHistoryRead(BaseModel):
    id: UUID
    stock_id: UUID
    product_id: UUID
    logistics_location_id: UUID | None = None
    quantity: int
    batch_code: str | None = None
    stock_date: datetime
    expiration_date: datetime
    action_type: StockHistoryActionType
    action_quantity: int
    update_user_id: UUID
    created_at: DateTimeUtc
    before_update: dict[str, Any] | None = None
    reason: str | None = None

    model_config = {"from_attributes": True}


# ---------- OrderHistory ----------

class OrderHistoryRead(BaseModel):
    id: UUID
    order_id: UUID
    action_type: OrderHistoryActionType
    update_user_id: UUID
    created_at: DateTimeUtc
    reason: str | None = None
    from_status: OrderStatus | None = None
    to_status: OrderStatus | None = None
    before_update: dict[str, Any] | None = None
    after_update: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


# ---------- Receiver ----------

class ReceiverBase(BaseModel):
    name: str
    phone: str
    zip_code: str
    address: str
    address_detail: str | None = None
    email: str | None = None


class ReceiverCreate(ReceiverBase):
    pass


class ReceiverUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    zip_code: str | None = None
    address: str | None = None
    address_detail: str | None = None
    email: str | None = None


class ReceiverRead(ReceiverBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Order ----------


class OrderItemBase(BaseModel):
    product_id: UUID
    quantity: int


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemRead(OrderItemBase):
    pass


class OrderBase(BaseModel):
    receiver_id: UUID
    channel_id: UUID | None = None
    mall_product_name: str | None = None
    raw: dict[str, Any] | None = None
    price: Decimal
    commission: int | None = 0
    # 주문 전체 상품 수량 합계
    quantity: int
    memo: str | None = None
    order_date: datetime | None = None
    status: OrderStatus = OrderStatus.ORDER
    order_placed_date: datetime | None = None
    shipping_date: datetime | None = None
    invoice_number: str | None = None


class OrderCreate(BaseModel):
    receiver_id: UUID
    channel_id: UUID
    mall_product_name: str | None = None
    raw: dict[str, Any] | None = None
    price: Decimal
    memo: str | None = None
    order_date: datetime | None = None
    status: OrderStatus = OrderStatus.ORDER
    invoice_number: str | None = None
    items: list[OrderItemCreate]


class OrderUpdate(BaseModel):
    receiver_id: UUID | None = None
    price: Decimal | None = None
    memo: str | None = None
    order_date: datetime | None = None
    status: OrderStatus | None = None
    invoice_number: str | None = None
    items: list[OrderItemCreate] | None = None


class OrderRead(OrderBase):
    id: UUID
    update_user_id: UUID
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemRead] = []

    model_config = {"from_attributes": True}


# 목록용: id, created_at, updated_at, is_delete 제외
class ProductSummary(BaseModel):
    product_code: str
    name: str
    description: str | None = None
    price: int | None = 0
    category_name: str | None = Field(
        default=None,
        description="상품에 매핑된 카테고리(보통 최하위) 이름.",
    )
    parent_category_name: str | None = Field(
        default=None,
        description="2단 카테고리일 때 상위(부모) 카테고리 이름.",
    )
    is_tax: bool = False
    tax_rate: Decimal | None = None
    max_shipping_number: int | None = None
    state: ProductState | None = None

    model_config = {"from_attributes": True}


class StockHistoryListRead(StockHistoryRead):
    """이력 목록: 상품·물류지 요약, 처리자 이메일(user.id = update_user_id 조인)."""

    product: ProductSummary | None = None
    logistics_location: LogisticsLocationSummary | None = None
    update_user_email: str | None = None


class OrderItemListRead(OrderItemRead):
    """목록용: 상품 요약 포함."""
    product: ProductSummary | None = None

    model_config = {"from_attributes": True}


class StockListRead(StockRead):
    """목록용: product 요약 포함."""

    product: ProductSummary | None = None

    model_config = {"from_attributes": True}


class StockByProductSummary(BaseModel):
    product_id: UUID
    quantity: int
    product: ProductSummary | None = None

    model_config = {"from_attributes": True}


class StockByProductConditionSummary(BaseModel):
    product_id: UUID
    condition: StockCondition
    quantity: int
    batch_code: str | None = None
    expiration_date: datetime
    product: ProductSummary | None = None

    model_config = {"from_attributes": True}


class ReceiverSummary(BaseModel):
    name: str
    phone: str
    zip_code: str
    address: str
    address_detail: str | None = None
    email: str | None = None

    model_config = {"from_attributes": True}


class ChannelSummary(BaseModel):
    id: UUID
    name: str
    courier_name: str | None = None
    courier_url: str | None = None
    url: str | None = None

    model_config = {"from_attributes": True}


class OrderListRead(OrderBase):
    id: UUID
    update_user_id: UUID
    created_at: datetime
    updated_at: datetime
    items: list["OrderItemListRead"] = []
    receiver: ReceiverSummary | None = None
    channel: ChannelSummary | None = None
    memo_count: int = 0
    consolidated_to_order_id: UUID | None = None

    model_config = {"from_attributes": True}


class OrderMemoCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class OrderMemoRead(BaseModel):
    id: UUID
    order_id: UUID
    user_id: UUID
    user_display: str
    content: str
    created_at: DateTimeUtc

    model_config = {"from_attributes": False}


# ---------- Excel upload ----------
class ExcelOrderUploadItem(BaseModel):
    product_id: UUID
    quantity: int


class ExcelOrderUploadRow(BaseModel):
    channel: str
    raw: dict[str, Any]
    items: list[ExcelOrderUploadItem]
    commission: int | None = None


class ExcelOrderUploadRequest(BaseModel):
    rows: list[ExcelOrderUploadRow]


class ExcelOrderUploadResponse(BaseModel):
    created_orders: int
    created_receivers: int


class ExcelOrderPreviewRowOut(BaseModel):
    row_index: int
    channel: str
    product_name: str
    raw: dict[str, Any]
    matched_product_id: UUID | None = None
    matched_product_label: str | None = None
    match_type: str  # alias | product_name | none
    alias_quantity: int | None = None
    commission: int | None = 0
    # 별칭이 여러 상품에 매핑된 경우, 기본으로 제안할 상품/수량 목록
    matched_items: list[ExcelOrderUploadItem] = []
    errors: list[str] = []


class ExcelOrderPreviewResponse(BaseModel):
    rows: list[ExcelOrderPreviewRowOut]
    active_products: list[ProductRead] = []
    warnings: list[str] = Field(
        default_factory=list,
        description="채널 매핑 누락·구버전 라벨 등 안내",
    )


# ---------- Shipment (발주/배송) ----------
class ShipmentItemRead(BaseModel):
    product_id: UUID
    quantity: int

    model_config = {"from_attributes": True}


class ShipmentRead(BaseModel):
    id: UUID
    order_id: UUID
    invoice_number: str | None = None
    order_placed_date: DateTimeUtc
    shipping_date: DateTimeUtc | None = None
    receiver_id: UUID

    model_config = {"from_attributes": True}


class ShipmentProductSummary(BaseModel):
    id: UUID
    product_code: str
    name: str


class ShipmentItemDetailRead(BaseModel):
    product: ShipmentProductSummary
    quantity: int


class ShipmentListRead(BaseModel):
    id: UUID
    order_id: UUID
    invoice_number: str | None = None
    receiver: ReceiverSummary | None = None
    items: list[ShipmentItemDetailRead] = []
    total_quantity: int = 0
    order_placed_date: DateTimeUtc
    shipping_date: DateTimeUtc | None = None
    # Order fields
    order_date: DateTimeUtc
    order_status: OrderStatus
    channel: ChannelSummary | None = None
    memo: str | None = None

    model_config = {"from_attributes": False}


class PlaceOrderRequest(BaseModel):
    """발주: ORDER 상태 주문을 ORDER_PLACED로 변경하고 배송 정보 생성."""
    order_ids: list[UUID] | None = None
    """기존 방식: 주문당 1건 배송 자동 생성."""

    order_shipments: list["PlaceOrderOrderShipments"] | None = None
    """발주 프리뷰에서 편집한 대로 배송 생성: 주문별 복수 배송건 + 상품/수량 할당."""


class PlaceOrderShipmentItem(BaseModel):
    product_id: UUID
    quantity: int


class PlaceOrderShipment(BaseModel):
    items: list[PlaceOrderShipmentItem]


class PlaceOrderOrderShipments(BaseModel):
    order_id: UUID
    shipments: list[PlaceOrderShipment]
    consolidated_sub_order_ids: list[UUID] = []
    """합배송 하위 주문 id 목록. 비어 있으면 단일 주문 발주."""


class PlaceOrderResponse(BaseModel):
    updated_count: int
    shipments_created: int


# ---------- LogisticsLocation ----------

class LogisticsLocationBase(BaseModel):
    name: str
    description: str | None = None
    courier_id: UUID | None = None
    state: LogisticsLocationState = LogisticsLocationState.ACTIVE


class LogisticsLocationCreate(LogisticsLocationBase):
    pass


class LogisticsLocationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    courier_id: UUID | None = None
    state: LogisticsLocationState | None = None


class LogisticsLocationRead(LogisticsLocationBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Settlement ----------

class SettlementRead(BaseModel):
    id: UUID
    order_id: UUID
    order_price: Decimal
    price: Decimal
    commission: int | None = 0
    state: SettlementState
    created_at: DateTimeUtc
    updated_at: DateTimeUtc
    settled_at: DateTimeUtc | None = None
    completed_at: DateTimeUtc | None = None

    # denormalized order/channel fields for list/search
    channel_name: str | None = None
    mall_product_name: str | None = None
    quantity: int | None = None
    invoice_number: str | None = None
    shipping_date: DateTimeUtc | None = None

    model_config = {"from_attributes": False}


class SettlementListRead(SettlementRead):
    """목록용(현재는 SettlementRead와 동일)."""


class SettlementUploadResult(BaseModel):
    updated: int
    skipped: list[dict] = Field(default_factory=list)


class SettlementActionResponse(BaseModel):
    ok: bool
    settlement: SettlementRead


class SettlementBulkActionResponse(BaseModel):
    ok: bool
    updated: int
