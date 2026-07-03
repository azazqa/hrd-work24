from datetime import datetime as dt
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from sqlalchemy.orm import selectinload

from app.database import User, get_async_session
from app.models import (
    Stock,
    StockHistory,
    StockHistoryActionType,
    Product,
    LogisticsLocation,
    Category,
    StockCondition,
)
from app.schemas import (
    StockRead,
    StockListRead,
    StockByProductSummary,
    StockByProductConditionSummary,
    StockCreate,
    StockUpdate,
    StockRestock,
    StockRelease,
    StockConditionChange,
    StockTransfer,
    StockHistoryRead,
    StockHistoryListRead,
    ProductSummary,
    LogisticsLocationSummary,
)
from app.users import current_active_user
from app.utils import datetime_as_utc_aware
from app.permissions import require_permission

router = APIRouter(tags=["stock"])


def _product_summary_from_product(p: Product | None) -> ProductSummary | None:
    if p is None:
        return None
    cat = getattr(p, "category", None)
    category_name = cat.name if cat is not None else None
    parent_category_name = None
    if cat is not None:
        par = getattr(cat, "parent", None)
        parent_category_name = par.name if par is not None else None
    return ProductSummary(
        product_code=p.product_code,
        name=p.name,
        description=p.description,
        category_name=category_name,
        parent_category_name=parent_category_name,
        is_tax=p.is_tax,
        tax_rate=p.tax_rate,
        state=p.state,
    )


def _stock_to_read(stock: Stock) -> StockRead:
    """Build StockRead from Stock. Caller must have loaded logistics_location (selectinload)."""
    return StockRead.model_validate(stock)


def _stock_to_list_read(stock) -> StockListRead:
    """Build StockListRead; caller must have loaded product.category.parent."""
    base = StockRead.model_validate(stock)
    product_summary = _product_summary_from_product(getattr(stock, "product", None))
    return StockListRead(
        **base.model_dump(),
        product=product_summary,
    )


def transform_stock(rows):
    return [_stock_to_list_read(r) for r in rows]


def transform_history(rows):
    return [StockHistoryRead.model_validate(r) for r in rows]


def _history_to_list_read(h: StockHistory) -> StockHistoryListRead:
    base = StockHistoryRead.model_validate(h)
    product_summary = None
    stock = getattr(h, "stock", None)
    if stock is not None:
        product_summary = _product_summary_from_product(getattr(stock, "product", None))
    loc_summary = None
    if stock is not None and getattr(stock, "logistics_location", None):
        ll = stock.logistics_location
        loc_summary = LogisticsLocationSummary(id=ll.id, name=ll.name)
    # update_user_id → user.id (FK), 이메일 표시용
    u = getattr(h, "update_user", None)
    update_user_email = u.email if u is not None and getattr(u, "email", None) else None
    return StockHistoryListRead(
        **base.model_dump(),
        product=product_summary,
        logistics_location=loc_summary,
        update_user_email=update_user_email,
    )


def transform_history_list(rows):
    return [_history_to_list_read(h) for h in rows]


def _stock_snapshot(stock: Stock) -> dict:
    """수정 전 재고 상태를 JSON 저장용 dict로 반환."""

    def _ser(v):
        if v is None:
            return None
        if isinstance(v, dt):
            return v.isoformat()
        if hasattr(v, "hex"):
            return str(v)
        if isinstance(v, Decimal):
            return float(v)
        return v

    return {
        "product_id": _ser(stock.product_id),
        "logistics_location_id": _ser(getattr(stock, "logistics_location_id", None)),
        "quantity": stock.quantity,
        "batch_code": stock.batch_code,
        "stock_date": _ser(stock.stock_date),
        "expiration_date": _ser(stock.expiration_date),
        "condition": stock.condition.value if hasattr(stock.condition, "value") else stock.condition,
        "memo": stock.memo,
        "product_barcode": stock.product_barcode,
    }


_STOCK_CONDITION_LABEL_KO: dict[StockCondition, str] = {
    StockCondition.NORMAL: "정상",
    StockCondition.REFURB: "리퍼",
    StockCondition.DISPOSAL: "폐기",
    StockCondition.UNDECIDED: "미정",
}


def _stock_condition_label_ko(condition: StockCondition) -> str:
    return _STOCK_CONDITION_LABEL_KO.get(condition, condition.value)


def _build_history(
    stock: Stock,
    action_type: StockHistoryActionType,
    action_quantity: int,
    user_id,
    before_update: dict | None = None,
    reason: str | None = None,
) -> StockHistory:
    return StockHistory(
        stock_id=stock.id,
        product_id=stock.product_id,
        logistics_location_id=stock.logistics_location_id,
        quantity=stock.quantity,
        batch_code=stock.batch_code,
        stock_date=datetime_as_utc_aware(stock.stock_date),
        expiration_date=datetime_as_utc_aware(stock.expiration_date),
        action_type=action_type,
        action_quantity=action_quantity,
        update_user_id=user_id,
        before_update=before_update,
        reason=reason,
    )


@router.get("/", response_model=Page[StockListRead])
async def list_stocks(
    page: int = 1,
    size: int = 10,
    product_id: UUID | None = None,
    product_query: str | None = Query(default=None),
    logistics_location_name: str | None = Query(default=None),
    product_barcode: str | None = Query(default=None),
    batch_code: str | None = Query(default=None),
    memo: str | None = Query(default=None),
    condition: StockCondition | None = Query(
        default=None,
        description="입고 상품 상태(정상/리퍼/폐기/미정)",
    ),
    category_id: UUID | None = Query(
        default=None,
        description="상품 카테고리 ID(상품 등록과 동일한 카테고리 선택)",
    ),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("stocks", "read")(user, db)
    params = Params(page=page, size=size)
    query = (
        select(Stock)
        .join(Product, Product.id == Stock.product_id)
        .outerjoin(
            LogisticsLocation,
            LogisticsLocation.id == Stock.logistics_location_id,
        )
        .filter(Stock.is_delete == False)
        .options(
            selectinload(Stock.logistics_location),
            selectinload(Stock.product)
            .selectinload(Product.category)
            .selectinload(Category.parent),
        )
    )
    if product_id is not None:
        query = query.filter(Stock.product_id == product_id)
    if product_query is not None and product_query.strip():
        pq = product_query.strip()
        query = query.filter(
            or_(
                Product.product_code.ilike(f"%{pq}%"),
                Product.name.ilike(f"%{pq}%"),
            )
        )
    if logistics_location_name is not None and logistics_location_name.strip():
        query = query.filter(
            LogisticsLocation.name.ilike(f"%{logistics_location_name.strip()}%")
        )
    if product_barcode is not None and product_barcode.strip():
        query = query.filter(
            Stock.product_barcode.ilike(f"%{product_barcode.strip()}%")
        )
    if batch_code is not None and batch_code.strip():
        query = query.filter(Stock.batch_code.ilike(f"%{batch_code.strip()}%"))
    if memo is not None and memo.strip():
        query = query.filter(Stock.memo.ilike(f"%{memo.strip()}%"))
    if condition is not None:
        query = query.filter(Stock.condition == condition)
    if category_id is not None:
        query = query.filter(Product.category_id == category_id)
    query = query.order_by(Stock.created_at.desc())
    return await apaginate(db, query, params, transformer=transform_stock)


@router.get("/summary/by-product", response_model=list[StockByProductSummary])
async def stock_summary_by_product(
    logistics_location_id: UUID | None = Query(None, description="물류지 필터 (미지정 시 전체)"),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("stocks", "read")(user, db)
    q = (
        select(
            Stock.product_id,
            func.sum(Stock.quantity).label("quantity"),
            Product,
        )
        .join(Product, Product.id == Stock.product_id)
        .filter(Stock.is_delete == False)
    )
    if logistics_location_id is not None:
        q = q.filter(Stock.logistics_location_id == logistics_location_id)
    q = (
        q.group_by(Stock.product_id, Product.id)
        .order_by(func.sum(Stock.quantity).desc())
        .options(
            selectinload(Product.category).selectinload(Category.parent),
        )
    )
    result = await db.execute(q)
    rows = result.all()

    out: list[StockByProductSummary] = []
    for product_id, quantity, product in rows:
        product_summary = _product_summary_from_product(product)
        out.append(
            StockByProductSummary(
                product_id=product_id,
                quantity=int(quantity or 0),
                product=product_summary,
            )
        )
    return out


@router.get("/summary/by-product-and-condition", response_model=list[StockByProductConditionSummary])
async def stock_summary_by_product_and_condition(
    logistics_location_id: UUID | None = Query(None, description="물류지 필터 (미지정 시 전체)"),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("stocks", "read")(user, db)
    q = (
        select(
            Stock.product_id,
            Stock.condition,
            Stock.batch_code,
            Stock.expiration_date,
            func.sum(Stock.quantity).label("quantity"),
            Product,
        )
        .join(Product, Product.id == Stock.product_id)
        .filter(Stock.is_delete == False)
    )
    if logistics_location_id is not None:
        q = q.filter(Stock.logistics_location_id == logistics_location_id)
    q = (
        q.group_by(Stock.product_id, Stock.condition, Stock.batch_code, Stock.expiration_date, Product.id)
        .order_by(Product.product_code.asc(), Stock.batch_code.asc(), Stock.expiration_date.asc())
        .options(
            selectinload(Product.category).selectinload(Category.parent),
        )
    )
    result = await db.execute(q)
    rows = result.all()

    out: list[StockByProductConditionSummary] = []
    for product_id, condition, batch_code, expiration_date, quantity, product in rows:
        product_summary = _product_summary_from_product(product)
        out.append(
            StockByProductConditionSummary(
                product_id=product_id,
                condition=condition,
                quantity=int(quantity or 0),
                batch_code=batch_code,
                expiration_date=expiration_date,
                product=product_summary,
            )
        )
    return out


@router.get("/histories", response_model=Page[StockHistoryListRead])
async def list_all_stock_histories(
    params: Params = Depends(),
    logistics_location_id: UUID | None = Query(None, description="물류지 필터 (미지정 시 전체)"),
    product_query: str | None = Query(None, description="상품 검색 (코드/이름)"),
    batch_code: str | None = Query(None, description="배치코드 검색"),
    reason: str | None = Query(None, description="사유 검색"),
    action_type: StockHistoryActionType | None = Query(
        None, description="이력 유형 필터 (미지정 시 전체)"
    ),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("stocks_histories", "read")(user, db)
    q = (
        select(StockHistory)
        .join(Stock, Stock.id == StockHistory.stock_id)
        .join(Product, Product.id == Stock.product_id)
        .options(
            selectinload(StockHistory.update_user),
            selectinload(StockHistory.stock)
            .selectinload(Stock.product)
            .selectinload(Product.category)
            .selectinload(Category.parent),
            selectinload(StockHistory.stock).selectinload(Stock.logistics_location),
        )
    )
    if logistics_location_id is not None:
        q = q.filter(Stock.logistics_location_id == logistics_location_id)
    if product_query is not None and product_query.strip():
        pq = product_query.strip()
        q = q.filter(
            or_(
                Product.product_code.ilike(f"%{pq}%"),
                Product.name.ilike(f"%{pq}%"),
            )
        )
    if batch_code is not None and batch_code.strip():
        q = q.filter(StockHistory.batch_code.ilike(f"%{batch_code.strip()}%"))
    if reason is not None and reason.strip():
        q = q.filter(StockHistory.reason.ilike(f"%{reason.strip()}%"))
    if action_type is not None:
        q = q.filter(StockHistory.action_type == action_type)
    q = q.order_by(StockHistory.created_at.desc(), StockHistory.id.desc())
    return await apaginate(db, q, params, transformer=transform_history_list)


@router.get("/{stock_id}", response_model=StockRead)
async def get_stock(
    stock_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("stocks", "read")(user, db)
    result = await db.execute(
        select(Stock)
        .filter(Stock.id == stock_id, Stock.is_delete == False)
        .options(selectinload(Stock.logistics_location))
    )
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return _stock_to_read(stock)


@router.put("/{stock_id}", response_model=StockRead)
async def update_stock(
    stock_id: UUID,
    data: StockUpdate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("stocks", "update")(user, db)
    result = await db.execute(
        select(Stock).filter(Stock.id == stock_id, Stock.is_delete == False)
    )
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    update_data = data.model_dump(exclude_unset=True)
    if "quantity" in update_data and update_data["quantity"] is not None and update_data["quantity"] < 0:
        raise HTTPException(status_code=422, detail="수량은 0 이상이어야 합니다.")

    before_snapshot = _stock_snapshot(stock)
    for key, value in update_data.items():
        setattr(stock, key, value)

    history = _build_history(
        stock,
        StockHistoryActionType.ADMIN_EDIT,
        0,
        user.id,
        before_update=before_snapshot,
    )
    db.add(history)

    await db.commit()
    await db.refresh(stock)
    result = await db.execute(
        select(Stock)
        .filter(Stock.id == stock.id)
        .options(selectinload(Stock.logistics_location))
    )
    stock_loaded = result.scalar_one()
    return _stock_to_read(stock_loaded)


@router.post("/", response_model=StockRead)
async def create_stock(
    data: StockCreate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("stocks", "create")(user, db)
    if data.quantity <= 0:
        raise HTTPException(status_code=422, detail="수량은 1 이상이어야 합니다.")

    stock = Stock(**data.model_dump())
    db.add(stock)
    await db.flush()

    history = _build_history(stock, StockHistoryActionType.INBOUND, data.quantity, user.id)
    db.add(history)

    await db.commit()
    await db.refresh(stock)
    result = await db.execute(
        select(Stock)
        .filter(Stock.id == stock.id)
        .options(selectinload(Stock.logistics_location))
    )
    stock_loaded = result.scalar_one()
    return _stock_to_read(stock_loaded)


@router.put("/{stock_id}/restock", response_model=StockRead)
async def restock(
    stock_id: UUID,
    data: StockRestock,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("stocks", "update")(user, db)
    if data.quantity <= 0:
        raise HTTPException(status_code=422, detail="재입고 수량은 1 이상이어야 합니다.")

    result = await db.execute(
        select(Stock).filter(Stock.id == stock_id, Stock.is_delete == False)
    )
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    before_snapshot = _stock_snapshot(stock)
    stock.quantity += data.quantity

    history = _build_history(
        stock,
        StockHistoryActionType.RESTOCK,
        data.quantity,
        user.id,
        before_update=before_snapshot,
        reason=data.reason,
    )
    db.add(history)

    await db.commit()
    await db.refresh(stock)
    result = await db.execute(
        select(Stock)
        .filter(Stock.id == stock.id)
        .options(selectinload(Stock.logistics_location))
    )
    stock_loaded = result.scalar_one()
    return _stock_to_read(stock_loaded)


@router.put("/{stock_id}/release", response_model=StockRead)
async def release_stock(
    stock_id: UUID,
    data: StockRelease,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("stocks", "update")(user, db)
    if data.quantity <= 0:
        raise HTTPException(status_code=422, detail="출고 수량은 1 이상이어야 합니다.")

    result = await db.execute(
        select(Stock).filter(Stock.id == stock_id, Stock.is_delete == False)
    )
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    if stock.quantity < data.quantity:
        raise HTTPException(
            status_code=422,
            detail=f"재고 부족: 현재 {stock.quantity}개, 출고 요청 {data.quantity}개",
        )

    before_snapshot = _stock_snapshot(stock)
    stock.quantity -= data.quantity

    history = _build_history(
        stock,
        StockHistoryActionType.OUTBOUND,
        -data.quantity,
        user.id,
        before_update=before_snapshot,
        reason=data.reason,
    )
    db.add(history)

    await db.commit()
    await db.refresh(stock)
    result = await db.execute(
        select(Stock)
        .filter(Stock.id == stock.id)
        .options(selectinload(Stock.logistics_location))
    )
    stock_loaded = result.scalar_one()
    return _stock_to_read(stock_loaded)


@router.put("/{stock_id}/change-condition", response_model=StockRead)
async def change_stock_condition(
    stock_id: UUID,
    data: StockConditionChange,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("stocks", "update")(user, db)
    if data.quantity <= 0:
        raise HTTPException(status_code=422, detail="변경 수량은 1 이상이어야 합니다.")

    result = await db.execute(
        select(Stock).filter(Stock.id == stock_id, Stock.is_delete == False)
    )
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    if stock.condition == data.to_condition:
        raise HTTPException(status_code=422, detail="현재 상태와 동일한 상태로는 변경할 수 없습니다.")

    if stock.quantity < data.quantity:
        raise HTTPException(
            status_code=422,
            detail=f"재고 부족: 현재 {stock.quantity}개, 변경 요청 {data.quantity}개",
        )

    target_result = await db.execute(
        select(Stock).filter(
            Stock.is_delete == False,
            Stock.product_id == stock.product_id,
            Stock.logistics_location_id == stock.logistics_location_id,
            Stock.batch_code == stock.batch_code,
            Stock.stock_date == stock.stock_date,
            Stock.expiration_date == stock.expiration_date,
            Stock.condition == data.to_condition,
        )
    )
    target_stock = target_result.scalars().first()
    target_before_snapshot = _stock_snapshot(target_stock) if target_stock else None
    if target_stock:
        target_stock.quantity += data.quantity
    else:
        target_stock = Stock(
            product_id=stock.product_id,
            logistics_location_id=stock.logistics_location_id,
            quantity=data.quantity,
            batch_code=stock.batch_code,
            stock_date=stock.stock_date,
            expiration_date=stock.expiration_date,
            condition=data.to_condition,
            memo=stock.memo,
            product_barcode=stock.product_barcode,
        )
        db.add(target_stock)
        await db.flush()

    before_snapshot = _stock_snapshot(stock)
    stock.quantity -= data.quantity

    reason_suffix = (
        f"상태 변경: {_stock_condition_label_ko(stock.condition)} -> "
        f"{_stock_condition_label_ko(data.to_condition)}"
    )
    source_reason = f"{reason_suffix} / {data.reason}".strip(" /") if data.reason else reason_suffix
    target_reason = f"{reason_suffix} / {data.reason}".strip(" /") if data.reason else reason_suffix

    source_history = _build_history(
        stock,
        StockHistoryActionType.CONDITION_CHANGE,
        -data.quantity,
        user.id,
        before_update=before_snapshot,
        reason=source_reason,
    )
    db.add(source_history)
    target_history = _build_history(
        target_stock,
        StockHistoryActionType.CONDITION_CHANGE,
        data.quantity,
        user.id,
        before_update=target_before_snapshot,
        reason=target_reason,
    )
    db.add(target_history)

    await db.commit()
    await db.refresh(stock)
    result = await db.execute(
        select(Stock)
        .filter(Stock.id == stock.id)
        .options(selectinload(Stock.logistics_location))
    )
    stock_loaded = result.scalar_one()
    return _stock_to_read(stock_loaded)


@router.put("/{stock_id}/transfer", response_model=StockRead)
async def transfer_stock(
    stock_id: UUID,
    data: StockTransfer,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("stocks", "update")(user, db)
    if data.quantity <= 0:
        raise HTTPException(status_code=422, detail="이동 수량은 1 이상이어야 합니다.")

    result = await db.execute(
        select(Stock).filter(Stock.id == stock_id, Stock.is_delete == False)
    )
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    if stock.logistics_location_id == data.to_logistics_location_id:
        raise HTTPException(status_code=422, detail="동일한 물류지로는 이동할 수 없습니다.")

    if stock.quantity < data.quantity:
        raise HTTPException(
            status_code=422,
            detail=f"재고 부족: 현재 {stock.quantity}개, 이동 요청 {data.quantity}개",
        )

    location_result = await db.execute(
        select(LogisticsLocation).filter(
            LogisticsLocation.id == data.to_logistics_location_id,
            LogisticsLocation.is_delete == False,
        )
    )
    target_location = location_result.scalars().first()
    if not target_location:
        raise HTTPException(status_code=404, detail="대상 물류지를 찾을 수 없습니다.")

    source_location_name = "물류지 없음"
    if stock.logistics_location_id is not None:
        source_location_result = await db.execute(
            select(LogisticsLocation).filter(
                LogisticsLocation.id == stock.logistics_location_id,
                LogisticsLocation.is_delete == False,
            )
        )
        source_location = source_location_result.scalars().first()
        if source_location and source_location.name:
            source_location_name = source_location.name

    target_result = await db.execute(
        select(Stock).filter(
            Stock.is_delete == False,
            Stock.product_id == stock.product_id,
            Stock.logistics_location_id == data.to_logistics_location_id,
            Stock.batch_code == stock.batch_code,
            Stock.stock_date == stock.stock_date,
            Stock.expiration_date == stock.expiration_date,
            Stock.condition == stock.condition,
        )
    )
    target_stock = target_result.scalars().first()
    target_before_snapshot = _stock_snapshot(target_stock) if target_stock else None
    if target_stock:
        target_stock.quantity += data.quantity
    else:
        target_stock = Stock(
            product_id=stock.product_id,
            logistics_location_id=data.to_logistics_location_id,
            quantity=data.quantity,
            batch_code=stock.batch_code,
            stock_date=stock.stock_date,
            expiration_date=stock.expiration_date,
            condition=stock.condition,
            memo=stock.memo,
            product_barcode=stock.product_barcode,
        )
        db.add(target_stock)
        await db.flush()

    before_snapshot = _stock_snapshot(stock)
    stock.quantity -= data.quantity

    reason_suffix = f"물류지 이동: {source_location_name} -> {target_location.name}"
    source_reason = f"{reason_suffix} / {data.reason}".strip(" /") if data.reason else reason_suffix
    target_reason = f"{reason_suffix} / {data.reason}".strip(" /") if data.reason else reason_suffix

    source_history = _build_history(
        stock,
        StockHistoryActionType.TRANSFER,
        -data.quantity,
        user.id,
        before_update=before_snapshot,
        reason=source_reason,
    )
    db.add(source_history)
    target_history = _build_history(
        target_stock,
        StockHistoryActionType.TRANSFER,
        data.quantity,
        user.id,
        before_update=target_before_snapshot,
        reason=target_reason,
    )
    db.add(target_history)

    await db.commit()
    await db.refresh(stock)
    result = await db.execute(
        select(Stock)
        .filter(Stock.id == stock.id)
        .options(selectinload(Stock.logistics_location))
    )
    stock_loaded = result.scalar_one()
    return _stock_to_read(stock_loaded)


@router.get("/{stock_id}/histories", response_model=Page[StockHistoryRead])
async def list_stock_histories(
    stock_id: UUID,
    page: int = 1,
    size: int = 10,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("stocks_histories", "read")(user, db)
    params = Params(page=page, size=size)
    query = (
        select(StockHistory)
        .filter(StockHistory.stock_id == stock_id)
        .order_by(StockHistory.created_at.desc(), StockHistory.id.desc())
    )
    return await apaginate(db, query, params, transformer=transform_history)


@router.delete("/{stock_id}")
async def delete_stock(
    stock_id: UUID,
    reason: str | None = None,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("stocks", "delete")(user, db)
    result = await db.execute(
        select(Stock).filter(Stock.id == stock_id, Stock.is_delete == False)
    )
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    before_snapshot = _stock_snapshot(stock)
    history = _build_history(
        stock,
        StockHistoryActionType.DELETED,
        0,
        user.id,
        before_update=before_snapshot,
        reason=reason or None,
    )
    db.add(history)
    stock.is_delete = True
    await db.commit()
    return {"message": "Stock successfully deleted"}
