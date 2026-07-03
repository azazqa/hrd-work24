import enum
from datetime import datetime

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    column_property,
    foreign,
)
from sqlalchemy import (
    Boolean, Column, String, Integer, Numeric, DateTime, Enum,
    ForeignKey, func, false, select,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from uuid import uuid4


class Base(DeclarativeBase):
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    is_delete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default=false())


class ProductState(str, enum.Enum):
    """상품 상태: 판매중, 비활성, 단종"""

    ACTIVE = "active"
    INACTIVE = "inactive"
    DISCONTINUED = "discontinued"


class StockHistoryActionType(str, enum.Enum):
    """재고 이력 타입: 입고, 재고, 출고, 관리자 수정, 삭제"""

    INBOUND = "inbound"
    RESTOCK = "restock"
    OUTBOUND = "outbound"
    CONDITION_CHANGE = "condition_change"
    TRANSFER = "transfer"
    ADMIN_EDIT = "admin_edit"
    DELETED = "deleted"


class OrderStatus(str, enum.Enum):
    """주문 상태: 주문, 발주, 배송 대기, 배송"""
    
    ORDER = "order"
    ORDER_PLACED = "order_placed"
    SHIPPING_WAITING = "shipping_waiting"
    SHIPPING = "shipping"
    CANCELLED = "cancelled"


class OrderHistoryActionType(str, enum.Enum):
    """주문 이력 타입: 생성/수정/상태변경/삭제 등 감사 로그."""

    CREATED = "created"
    UPDATED = "updated"
    STATUS_CHANGED = "status_changed"
    PLACED = "placed"
    SHIPPING_WAITING = "shipping_waiting"
    SHIPPING = "shipping"
    CANCELLED = "cancelled"
    DELETED = "deleted"


class SettlementState(str, enum.Enum):
    """정산 상태: 대기, 정산, 완료, reject, 취소"""

    PENDING = "pending"
    SETTLED = "settled"
    COMPLETED = "completed"
    REJECT = "reject"
    CANCELLED = "cancelled"


class SettlementHistoryActionType(str, enum.Enum):
    """정산 이력 타입(only insert)."""

    CREATED = "created"
    PRICE_UPDATED = "price_updated"
    STATE_CHANGED = "state_changed"
    CANCELLED_BY_ORDER = "cancelled_by_order"


class LogisticsLocationState(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class StockCondition(str, enum.Enum):
    """입고 상품 상태: 정상, 리퍼, 폐기, 미정"""

    NORMAL = "normal"
    REFURB = "refurb"
    DISPOSAL = "disposal"
    UNDECIDED = "undecided"


class User(SQLAlchemyBaseUserTableUUID, Base):
    department = Column(String(128), nullable=True)
    full_name = Column(String(128), nullable=True)
    phone = Column(String(32), nullable=True)
    extension_number = Column(String(32), nullable=True)
    # 담당 출고지(물류지). 송장 업로드 시 일반 사용자는 이 값으로 고정된다.
    logistics_location_id = Column(
        UUID(as_uuid=True),
        ForeignKey("logistics_locations.id"),
        nullable=True,
    )
    logistics_location = relationship(
        "LogisticsLocation",
        foreign_keys=[logistics_location_id],
    )
    orders = relationship("Order", back_populates="update_user")
    order_histories = relationship("OrderHistory", back_populates="update_user")
    stock_histories = relationship("StockHistory", back_populates="update_user")
    order_memos = relationship("OrderMemo", back_populates="user")
    notices = relationship("Notice", back_populates="update_user")
    permissions = relationship(
        "UserPermission",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserPermission(Base):
    __tablename__ = "user_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False, index=True)
    resource = Column(String(64), nullable=False, index=True)
    can_create = Column(Boolean, default=False, nullable=False, server_default=false())
    can_read = Column(Boolean, default=False, nullable=False, server_default=false())
    can_update = Column(Boolean, default=False, nullable=False, server_default=false())
    can_delete = Column(Boolean, default=False, nullable=False, server_default=false())

    user = relationship("User", back_populates="permissions")


class Notice(Base):
    __tablename__ = "notices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    content = Column(String(4000), nullable=False)
    update_user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)

    update_user = relationship("User", back_populates="notices")


class Courier(Base):
    __tablename__ = "couriers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=False, unique=True)
    url = Column(String, nullable=True)

    channels = relationship("Channel", back_populates="courier")


class Channel(Base):
    __tablename__ = "channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=False, unique=True)
    description = Column(String, nullable=True)
    url = Column(String(2048), nullable=True)
    courier_id = Column(UUID(as_uuid=True), ForeignKey("couriers.id"), nullable=True)
    # 즉시 전환: 채널 엑셀 매핑은 버전 테이블이 source of truth이며,
    # 채널은 current 포인터로 현재 버전을 가리킨다.
    current_mapping_version_id = Column(
        UUID(as_uuid=True),
        nullable=True,
    )

    courier = relationship("Courier", back_populates="channels")
    current_mapping_version = relationship(
        "ChannelOrderExcelMappingVersion",
        foreign_keys=[current_mapping_version_id],
        primaryjoin=lambda: Channel.current_mapping_version_id
        == foreign(ChannelOrderExcelMappingVersion.id),
        uselist=False,
        lazy="selectin",
    )
    mapping_versions = relationship(
        "ChannelOrderExcelMappingVersion",
        back_populates="channel",
        cascade="all, delete-orphan",
    )
    orders = relationship("Order", back_populates="channel")


class ChannelOrderExcelMappingVersion(Base):
    __tablename__ = "channel_order_excel_mapping_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    channel_id = Column(
        UUID(as_uuid=True),
        ForeignKey("channels.id"),
        nullable=False,
        index=True,
    )
    mapping = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    channel = relationship("Channel", back_populates="mapping_versions")


class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    parent = relationship("Category", remote_side="Category.id", back_populates="children")
    children = relationship("Category", back_populates="parent")
    products = relationship("Product", back_populates="category")

class ProductAliasDict(Base):
    __tablename__ = "product_alias_dicts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    channel_id = Column(UUID(as_uuid=True), ForeignKey("channels.id"), nullable=True, index=True)
    alias = Column(String, nullable=False, index=True)
    # 별칭 가격(사용자 입력). 기본값은 0, 필요 시 NULL도 허용한다.
    price = Column(Integer, nullable=True, default=0, server_default="0")
    # 수수료(사용자 입력). 기본값은 0, 필요 시 NULL도 허용한다.
    commission = Column(Integer, nullable=True, default=0, server_default="0")

    channel = relationship("Channel")
    items = relationship(
        "ProductAliasItem",
        back_populates="alias",
        cascade="all, delete-orphan",
    )


class ProductAliasItem(Base):
    __tablename__ = "product_alias_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    alias_id = Column(
        UUID(as_uuid=True),
        ForeignKey("product_alias_dicts.id"),
        nullable=False,
        index=True,
    )
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)

    alias = relationship("ProductAliasDict", back_populates="items")
    product = relationship("Product")

class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=False)
    product_code = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    # 판매가/정가 등 "상품 가격". 통화/부가세 포함 여부 등 정책은 상위에서 결정한다.
    price = Column(Integer, nullable=True, default=0, server_default="0")
    is_tax = Column(Boolean, default=False, nullable=False)
    tax_rate = Column(Numeric(8, 4), default=0, nullable=True)
    # 카테고리별/상품별 최대 배송 갯수 (없으면 제한 없음)
    max_shipping_number = Column(Integer, nullable=True)
    state = Column(Enum(ProductState), nullable=False, default=ProductState.ACTIVE)

    category = relationship("Category", back_populates="products")
    stocks = relationship("Stock", back_populates="product")


class Receiver(Base):
    __tablename__ = "receivers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    zip_code = Column(String, nullable=False)
    address = Column(String, nullable=False)
    address_detail = Column(String, nullable=True)
    email = Column(String, nullable=True)

    # 1:1 관계: 수취인 1명당 주문 1건
    order = relationship("Order", back_populates="receiver", uselist=False)


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    receiver_id = Column(UUID(as_uuid=True), ForeignKey("receivers.id"), nullable=False, unique=True)
    channel_id = Column(UUID(as_uuid=True), ForeignKey("channels.id"), nullable=True)
    channel_mapping_version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("channel_order_excel_mapping_versions.id"),
        nullable=True,
        index=True,
    )
    mall_product_name = Column(String, nullable=True)
    # 상품 별칭(채널별/공용) 매칭 시 확정되는 수수료(원)
    commission = Column(Integer, nullable=True, default=0, server_default="0")
    price = Column(Numeric(12, 2), nullable=False)
    # 주문 전체 상품 수량 합계 (OrderItem.quantity 합)
    quantity = Column(Integer, nullable=False)
    memo = Column(String, nullable=True)
    order_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    invoice_number = Column(String, nullable=True)
    update_user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)
    status = Column(Enum(OrderStatus), nullable=False, default=OrderStatus.ORDER)
    order_placed_date = Column(DateTime(timezone=True), nullable=True)
    shipping_date = Column(DateTime(timezone=True), nullable=True)
    raw = Column(JSONB, nullable=True)
    # 합배송 그룹: 대표 주문 id를 하위 주문에 저장. 대표 주문은 NULL.
    consolidated_to_order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("orders.id"),
        nullable=True,
        index=True,
    )
    consolidated_to = relationship(
        "Order",
        remote_side="Order.id",
        foreign_keys=[consolidated_to_order_id],
        backref="consolidated_sub_orders",
    )
    receiver = relationship("Receiver", back_populates="order")
    update_user = relationship("User", back_populates="orders")
    channel = relationship("Channel", back_populates="orders")
    channel_mapping_version = relationship(
        "ChannelOrderExcelMappingVersion",
        foreign_keys=[channel_mapping_version_id],
        lazy="selectin",
    )
    order_items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
    )
    shipments = relationship("Shipment", back_populates="order")
    memos = relationship(
        "OrderMemo",
        back_populates="order",
        cascade="all, delete-orphan",
    )
    histories = relationship(
        "OrderHistory",
        back_populates="order",
        cascade="all, delete-orphan",
    )
    settlement = relationship(
        "Settlement",
        back_populates="order",
        uselist=False,
    )


class OrderHistory(Base):
    __tablename__ = "order_histories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True)
    action_type = Column(Enum(OrderHistoryActionType), nullable=False)
    update_user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False, index=True)
    reason = Column(String(500), nullable=True)

    from_status = Column(Enum(OrderStatus), nullable=True)
    to_status = Column(Enum(OrderStatus), nullable=True)

    before_update = Column(JSONB, nullable=True)
    after_update = Column(JSONB, nullable=True)

    order = relationship("Order", back_populates="histories")
    update_user = relationship("User", back_populates="order_histories")


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("orders.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    # 주문 결제금액 스냅샷 (orders.price)
    order_price = Column(Numeric(12, 2), nullable=False)
    # 정산금액(관리자가 검토/수정 가능)
    price = Column(Numeric(12, 2), nullable=False)
    # 주문 업로드 시 확정된 수수료(원) 스냅샷 (orders.commission)
    commission = Column(Integer, nullable=True, default=0, server_default="0")
    state = Column(Enum(SettlementState), nullable=False, default=SettlementState.PENDING, index=True)
    # 상태 전환 시각(UTC). 정산/완료 처리를 위한 스냅샷 필드.
    settled_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    update_user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)

    __table_args__ = (
        Index("ix_settlements_state_created_at", "state", "created_at"),
    )

    order = relationship("Order", back_populates="settlement")
    update_user = relationship("User")
    histories = relationship(
        "SettlementHistory",
        back_populates="settlement",
        cascade="all, delete-orphan",
    )


class SettlementHistory(Base):
    __tablename__ = "settlement_histories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    settlement_id = Column(UUID(as_uuid=True), ForeignKey("settlements.id"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True)
    action_type = Column(Enum(SettlementHistoryActionType), nullable=False)
    update_user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False, index=True)
    reason = Column(String(500), nullable=True)
    from_state = Column(Enum(SettlementState), nullable=True)
    to_state = Column(Enum(SettlementState), nullable=True)
    before_price = Column(Numeric(12, 2), nullable=True)
    after_price = Column(Numeric(12, 2), nullable=True)

    settlement = relationship("Settlement", back_populates="histories")
    update_user = relationship("User")


class OrderMemo(Base):
    __tablename__ = "order_memos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False, index=True)
    content = Column(String(2000), nullable=False)

    order = relationship("Order", back_populates="memos")
    user = relationship("User", back_populates="order_memos")


Order.memo_count = column_property(
    select(func.count(OrderMemo.id))
    .where(
        OrderMemo.order_id == Order.id,
        OrderMemo.is_delete == False,
    )
    .correlate_except(OrderMemo)
    .scalar_subquery(),
)


class OrderItem(Base):
    """
    주문-상품 맵핑 테이블.
    한 주문(Order)에 여러 상품과 수량이 매핑될 수 있다.
    """

    __tablename__ = "order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)

    order = relationship("Order", back_populates="order_items")
    product = relationship("Product")


class Shipment(Base):
    """
    배송 테이블.
    주문 정보를 기반으로 재정리한 배송건. 묶음/분리 시 1주문 대비 N배송 또는 N주문 1배송이 될 수 있음.
    """
    __tablename__ = "shipments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True)
    invoice_number = Column(String, nullable=True)
    # 발주 시각(=배송건 생성 시각)
    order_placed_date = Column(DateTime(timezone=True), nullable=False)
    # 실제 배송 시작 시각 (배송 처리 전엔 NULL)
    shipping_date = Column(DateTime(timezone=True), nullable=True)
    receiver_id = Column(UUID(as_uuid=True), ForeignKey("receivers.id"), nullable=False, index=True)
    # 출고지(물류지). 송장 업로드 시 어떤 출고지에서 출고되는지 기록한다.
    logistics_location_id = Column(
        UUID(as_uuid=True),
        ForeignKey("logistics_locations.id"),
        nullable=True,
    )

    order = relationship("Order", back_populates="shipments")
    receiver = relationship("Receiver")
    shipment_items = relationship(
        "ShipmentItem",
        back_populates="shipment",
        cascade="all, delete-orphan",
    )


class ShipmentItem(Base):
    """배송-상품 맵핑 테이블."""
    __tablename__ = "shipment_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)

    shipment = relationship("Shipment", back_populates="shipment_items")
    product = relationship("Product")


class LogisticsLocation(Base):
    __tablename__ = "logistics_locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    courier_id = Column(UUID(as_uuid=True), ForeignKey("couriers.id"), nullable=True)
    state = Column(Enum(LogisticsLocationState), nullable=False, default=LogisticsLocationState.ACTIVE)


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    logistics_location_id = Column(UUID(as_uuid=True), ForeignKey("logistics_locations.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    batch_code = Column(String(255), nullable=False)
    stock_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expiration_date = Column(DateTime, nullable=False)
    condition = Column(Enum(StockCondition), nullable=False, default=StockCondition.NORMAL)
    memo = Column(String(500), nullable=True)
    product_barcode = Column(String(50), nullable=True)

    product = relationship("Product", back_populates="stocks")
    histories = relationship("StockHistory", back_populates="stock")
    logistics_location = relationship("LogisticsLocation")


class StockHistory(Base):
    __tablename__ = "stock_histories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    stock_id = Column(UUID(as_uuid=True), ForeignKey("stocks.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    logistics_location_id = Column(UUID(as_uuid=True), ForeignKey("logistics_locations.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    batch_code = Column(String, nullable=True)
    stock_date = Column(DateTime(timezone=True), nullable=False)
    expiration_date = Column(DateTime(timezone=True), nullable=False)
    action_type = Column(Enum(StockHistoryActionType), nullable=False)
    action_quantity = Column(Integer, nullable=False)
    update_user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)
    before_update = Column(JSONB, nullable=True)
    reason = Column(String(500), nullable=True)

    stock = relationship("Stock", back_populates="histories")
    update_user = relationship("User", back_populates="stock_histories")