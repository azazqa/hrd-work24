from __future__ import annotations

from datetime import datetime, timezone, date
from decimal import Decimal
from io import BytesIO
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlalchemy import apaginate
from openpyxl import Workbook, load_workbook
from openpyxl.cell.cell import WriteOnlyCell
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import User, get_async_session
from app.models import (
    Channel,
    Order,
    OrderItem,
    Product,
    Settlement,
    SettlementHistory,
    SettlementHistoryActionType,
    SettlementState,
)
from app.permissions import require_permission
from app.schemas import (
    SettlementActionResponse,
    SettlementBulkActionResponse,
    SettlementListRead,
    SettlementRead,
    SettlementUploadResult,
)
from app.users import current_active_user

router = APIRouter(tags=["settlements"])


def _cell_to_str(v: object) -> str:
    if v is None:
        return ""
    return str(v).strip()


def _cell_to_decimal(v: object) -> Decimal:
    if v is None or str(v).strip() == "":
        raise ValueError("empty")
    if isinstance(v, Decimal):
        return v
    if isinstance(v, (int, float)):
        return Decimal(str(v))
    s = str(v).strip().replace(",", "")
    return Decimal(s)


async def _try_add_settlement_history(db: AsyncSession, h: SettlementHistory) -> None:
    """
    정산 이력은 감사 로그지만, 정산 핵심 플로우를 깨지 않도록
    savepoint로 insert를 격리한다.
    """
    try:
        async with db.begin_nested():
            db.add(h)
            await db.flush()
    except SQLAlchemyError:
        return


def _product_info_text(order_items: list[OrderItem] | None) -> str:
    lines: list[str] = []
    for oi in order_items or []:
        p: Product | None = getattr(oi, "product", None)
        name = getattr(p, "name", None) or "-"
        price = getattr(p, "price", None)
        unit = int(price or 0)
        qty = int(getattr(oi, "quantity", 0) or 0)
        amt = unit * qty
        lines.append(f"{name}({unit}) x {qty} = {amt}")
    return "\n".join(lines)


def _product_info_parts(
    order_items: list[OrderItem] | None,
) -> tuple[str, int]:
    """
    정산대기 다운로드 엑셀용 상품정보 분리:
    - 상품정보: "상품명(단가) x수량"
    - 상품금액: 총 상품금액(단가*수량 합) (엑셀 숫자)
    """
    info_lines: list[str] = []
    total_amt = 0
    for oi in order_items or []:
        p: Product | None = getattr(oi, "product", None)
        name = getattr(p, "name", None) or "-"
        price = getattr(p, "price", None)
        unit = int(price or 0)
        qty = int(getattr(oi, "quantity", 0) or 0)
        amt = unit * qty
        info_lines.append(f"{name}({unit}) x{qty}")
        total_amt += amt
    return ("\n".join(info_lines), total_amt)


def _settlement_to_read(s: Settlement) -> SettlementRead:
    o: Order | None = getattr(s, "order", None)
    ch: Channel | None = getattr(o, "channel", None) if o is not None else None
    return SettlementRead(
        id=s.id,
        order_id=s.order_id,
        order_price=s.order_price,
        price=s.price,
        commission=int(getattr(s, "commission", 0) or 0),
        state=s.state,
        created_at=s.created_at,
        updated_at=s.updated_at,
        settled_at=getattr(s, "settled_at", None),
        completed_at=getattr(s, "completed_at", None),
        channel_name=getattr(ch, "name", None),
        mall_product_name=getattr(o, "mall_product_name", None),
        quantity=getattr(o, "quantity", None),
        invoice_number=getattr(o, "invoice_number", None),
        shipping_date=getattr(o, "shipping_date", None),
    )


def _settlement_list_transform(rows: list[Settlement]) -> list[SettlementListRead]:
    out: list[SettlementListRead] = []
    for s in rows:
        base = _settlement_to_read(s)
        out.append(SettlementListRead(**base.model_dump()))
    return out


@router.get("", response_model=Page[SettlementListRead])
async def list_settlements(
    page: int = 1,
    size: int = 10,
    state: SettlementState | None = Query(default=None),
    order_id: UUID | None = Query(default=None),
    channel_id: UUID | None = Query(default=None),
    channel_ids: str | None = Query(default=None, description="Comma-separated channel ids"),
    channel_name: str | None = Query(default=None),
    mall_product_name: str | None = Query(default=None),
    invoice_number: str | None = Query(default=None),
    settled_date_start: date | None = Query(default=None),
    settled_date_end: date | None = Query(default=None),
    completed_date_start: date | None = Query(default=None),
    completed_date_end: date | None = Query(default=None),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("settlements", "read")(user, db)
    params = Params(page=page, size=size)
    q = (
        select(Settlement)
        .join(Order, Order.id == Settlement.order_id)
        .outerjoin(Channel, Channel.id == Order.channel_id)
        .where(Settlement.is_delete == False, Order.is_delete == False)
        .options(
            selectinload(Settlement.order).selectinload(Order.channel),
        )
    )
    if state is not None:
        q = q.where(Settlement.state == state)
    if order_id is not None:
        q = q.where(Settlement.order_id == order_id)
    if channel_ids is not None and channel_ids.strip():
        tokens = [t.strip() for t in channel_ids.split(",") if t.strip()]
        parsed: list[UUID] = []
        for t in tokens:
            try:
                parsed.append(UUID(t))
            except Exception:
                raise HTTPException(status_code=422, detail="Invalid channel_ids")
        if parsed:
            q = q.where(Order.channel_id.in_(parsed))
    elif channel_id is not None:
        q = q.where(Order.channel_id == channel_id)
    if channel_name is not None and channel_name.strip():
        s = channel_name.strip()
        q = q.where(Channel.name.ilike(f"%{s}%"))
    if mall_product_name is not None and mall_product_name.strip():
        s = mall_product_name.strip()
        q = q.where(Order.mall_product_name.ilike(f"%{s}%"))
    if invoice_number is not None and invoice_number.strip():
        s = invoice_number.strip()
        q = q.where(Order.invoice_number.ilike(f"%{s}%"))
    if settled_date_start is not None:
        q = q.where(func.date(Settlement.settled_at) >= settled_date_start)
    if settled_date_end is not None:
        q = q.where(func.date(Settlement.settled_at) <= settled_date_end)
    if completed_date_start is not None:
        q = q.where(func.date(Settlement.completed_at) >= completed_date_start)
    if completed_date_end is not None:
        q = q.where(func.date(Settlement.completed_at) <= completed_date_end)

    q = q.order_by(Settlement.state.asc(), Settlement.created_at.desc(), Settlement.id.desc())
    return await apaginate(db, q, params, transformer=_settlement_list_transform)


@router.get("/pending/excel")
async def download_pending_settlements_excel(
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("settlements", "read")(user, db)

    q = (
        select(Settlement)
        .join(Order, Order.id == Settlement.order_id)
        .outerjoin(Channel, Channel.id == Order.channel_id)
        .where(
            Settlement.is_delete == False,
            Order.is_delete == False,
            Settlement.state == SettlementState.PENDING,
        )
        .options(
            selectinload(Settlement.order)
            .selectinload(Order.order_items)
            .selectinload(OrderItem.product),
            selectinload(Settlement.order).selectinload(Order.channel),
        )
        .order_by(Settlement.created_at.desc(), Settlement.id.desc())
    )
    res = await db.execute(q)
    rows: list[Settlement] = res.scalars().unique().all()
    if not rows:
        raise HTTPException(status_code=404, detail="대기 상태의 정산 대상이 없습니다.")

    wb = Workbook(write_only=True)
    ws = wb.create_sheet("pending")
    headers = [
        "order_id",
        "채널",
        "쇼핑몰 상품명(상품 별칭)",
        "상품정보",
        "상품금액",
        "결제금액(주문금액)",
        "정산금액",
        "차액",
    ]
    header_fill = PatternFill(patternType="solid", fgColor="FFD9D9D9")  # light gray
    header_font = Font(bold=True)
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    header_cells: list[WriteOnlyCell] = []
    for h in headers:
        c = WriteOnlyCell(ws, value=h)
        c.fill = header_fill
        c.font = header_font
        c.alignment = header_align
        header_cells.append(c)
    ws.append(header_cells)

    for s in rows:
        o: Order | None = getattr(s, "order", None)
        ch = getattr(o, "channel", None) if o is not None else None
        info_text, total_amt = _product_info_parts(
            getattr(o, "order_items", None) if o is not None else None
        )
        paid_amt = float(s.order_price) if s.order_price is not None else 0.0
        settled_amt = float(total_amt)
        diff = settled_amt - paid_amt
        diff_cell: object = f"-{abs(int(diff))}" if diff < 0 else int(diff)
        ws.append(
            [
                str(s.order_id),
                getattr(ch, "name", None) or "",
                getattr(o, "mall_product_name", None) or "",
                info_text,
                int(total_amt),
                paid_amt,
                settled_amt,
                diff_cell,
            ]
        )

    out = BytesIO()
    wb.save(out)
    out.seek(0)

    filename_utf8 = f"settlements_pending_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.xlsx"
    filename_ascii = f"settlements_pending_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.xlsx"
    disposition = (
        f'attachment; filename="{filename_ascii}"; '
        f"filename*=UTF-8''{quote(filename_utf8)}"
    )
    return StreamingResponse(
        out,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": disposition},
    )


@router.post("/settle/upload", response_model=SettlementUploadResult)
async def upload_settlement_excel_and_settle(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("settlements", "update")(user, db)
    if not file.filename:
        raise HTTPException(status_code=422, detail="No file provided")

    content = await file.read()
    try:
        wb = load_workbook(filename=BytesIO(content), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid excel file: {e}")

    ws = wb.active
    it = ws.iter_rows(values_only=True)
    try:
        header_row = next(it)
    except StopIteration:
        raise HTTPException(status_code=422, detail="Empty excel file")

    headers = [_cell_to_str(h) for h in (header_row or [])]
    h_to_i = {h: i for i, h in enumerate(headers) if h}
    # NOTE: column index can be 0, so don't use `or` with raw ints here.
    order_id_idx = (
        h_to_i.get("order_id")
        if "order_id" in h_to_i
        else h_to_i.get("주문 ID")
        if "주문 ID" in h_to_i
        else h_to_i.get("주문ID")
        if "주문ID" in h_to_i
        else None
    )
    price_idx = (
        h_to_i.get("정산금액")
        if "정산금액" in h_to_i
        else h_to_i.get("정산금액(price)")
        if "정산금액(price)" in h_to_i
        else h_to_i.get("price")
        if "price" in h_to_i
        else None
    )
    if order_id_idx is None:
        raise HTTPException(status_code=422, detail="Excel header must include 'order_id'")
    if price_idx is None:
        raise HTTPException(status_code=422, detail="Excel header must include '정산금액'")

    updates: dict[UUID, Decimal] = {}
    for row in it:
        oid_raw = row[order_id_idx] if len(row) > order_id_idx else None
        price_raw = row[price_idx] if len(row) > price_idx else None
        if oid_raw is None:
            continue
        oid_s = _cell_to_str(oid_raw)
        if not oid_s:
            continue
        try:
            oid = UUID(oid_s)
        except Exception:
            continue
        try:
            new_price = _cell_to_decimal(price_raw)
        except Exception:
            continue
        updates[oid] = new_price

    if not updates:
        return SettlementUploadResult(updated=0, skipped=[{"order_id": None, "reason": "업데이트할 행이 없습니다."}])

    sres = await db.execute(
        select(Settlement)
        .where(Settlement.order_id.in_(list(updates.keys())), Settlement.is_delete == False)
    )
    settlements = sres.scalars().all()
    by_order_id = {s.order_id: s for s in settlements}

    updated = 0
    skipped: list[dict] = []
    now = datetime.now(timezone.utc)
    for oid, new_price in updates.items():
        s = by_order_id.get(oid)
        if s is None:
            skipped.append({"order_id": str(oid), "reason": "정산 대상이 없습니다."})
            continue
        if s.state != SettlementState.PENDING:
            skipped.append({"order_id": str(oid), "reason": f"대기 상태가 아닙니다: {s.state.value}"})
            continue

        before_price = s.price
        before_state = s.state

        s.price = new_price
        s.state = SettlementState.SETTLED
        if getattr(s, "settled_at", None) is None:
            s.settled_at = now
        s.update_user_id = user.id

        if before_price != s.price:
            await _try_add_settlement_history(
                db,
                SettlementHistory(
                    settlement_id=s.id,
                    order_id=s.order_id,
                    action_type=SettlementHistoryActionType.PRICE_UPDATED,
                    update_user_id=user.id,
                    reason="정산 업로드",
                    from_state=before_state,
                    to_state=s.state,
                    before_price=before_price,
                    after_price=s.price,
                ),
            )
        await _try_add_settlement_history(
            db,
            SettlementHistory(
                settlement_id=s.id,
                order_id=s.order_id,
                action_type=SettlementHistoryActionType.STATE_CHANGED,
                update_user_id=user.id,
                reason="정산 업로드 - 정산 상태 전환",
                from_state=before_state,
                to_state=s.state,
                before_price=before_price,
                after_price=s.price,
            ),
        )
        updated += 1

    await db.commit()
    return SettlementUploadResult(updated=updated, skipped=skipped)


@router.post("/{settlement_id}/complete", response_model=SettlementActionResponse)
async def complete_settlement(
    settlement_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("settlements", "update")(user, db)
    res = await db.execute(select(Settlement).where(Settlement.id == settlement_id, Settlement.is_delete == False))
    s = res.scalars().first()
    if s is None:
        raise HTTPException(status_code=404, detail="Settlement not found")
    if s.state != SettlementState.SETTLED:
        raise HTTPException(status_code=422, detail="정산 상태인 건만 완료 처리할 수 있습니다.")
    before_state = s.state
    before_price = s.price
    s.state = SettlementState.COMPLETED
    if getattr(s, "completed_at", None) is None:
        s.completed_at = datetime.now(timezone.utc)
    s.update_user_id = user.id
    await _try_add_settlement_history(
        db,
        SettlementHistory(
            settlement_id=s.id,
            order_id=s.order_id,
            action_type=SettlementHistoryActionType.STATE_CHANGED,
            update_user_id=user.id,
            reason="관리자 완료 처리",
            from_state=before_state,
            to_state=s.state,
            before_price=before_price,
            after_price=s.price,
        ),
    )
    await db.commit()
    await db.refresh(s)
    return SettlementActionResponse(ok=True, settlement=_settlement_to_read(s))


@router.post("/{settlement_id}/reject", response_model=SettlementActionResponse)
async def reject_settlement(
    settlement_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("settlements", "update")(user, db)
    res = await db.execute(select(Settlement).where(Settlement.id == settlement_id, Settlement.is_delete == False))
    s = res.scalars().first()
    if s is None:
        raise HTTPException(status_code=404, detail="Settlement not found")
    if s.state != SettlementState.SETTLED:
        raise HTTPException(status_code=422, detail="정산 상태인 건만 반려 처리할 수 있습니다.")
    before_state = s.state
    before_price = s.price
    s.state = SettlementState.REJECT
    s.update_user_id = user.id
    await _try_add_settlement_history(
        db,
        SettlementHistory(
            settlement_id=s.id,
            order_id=s.order_id,
            action_type=SettlementHistoryActionType.STATE_CHANGED,
            update_user_id=user.id,
            reason="관리자 반려 처리",
            from_state=before_state,
            to_state=s.state,
            before_price=before_price,
            after_price=s.price,
        ),
    )
    await db.commit()
    await db.refresh(s)
    return SettlementActionResponse(ok=True, settlement=_settlement_to_read(s))


@router.post("/settled/complete-all", response_model=SettlementBulkActionResponse)
async def complete_all_settled(
    channel_name: str | None = Query(default=None),
    mall_product_name: str | None = Query(default=None),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("settlements", "update")(user, db)
    updated = 0
    last_id: UUID | None = None
    batch_size = 500
    now = datetime.now(timezone.utc)

    for _ in range(50_000):  # hard stop to avoid infinite loops
        q = (
            select(Settlement)
            .join(Order, Order.id == Settlement.order_id)
            .outerjoin(Channel, Channel.id == Order.channel_id)
            .where(
                Settlement.is_delete == False,
                Order.is_delete == False,
                Settlement.state == SettlementState.SETTLED,
            )
        )
        if last_id is not None:
            q = q.where(Settlement.id > last_id)
        if channel_name is not None and channel_name.strip():
            s = channel_name.strip()
            q = q.where(Channel.name.ilike(f"%{s}%"))
        if mall_product_name is not None and mall_product_name.strip():
            s = mall_product_name.strip()
            q = q.where(Order.mall_product_name.ilike(f"%{s}%"))
        q = q.order_by(Settlement.id.asc()).limit(batch_size)

        res = await db.execute(q)
        batch: list[Settlement] = res.scalars().unique().all()
        if not batch:
            break

        for st in batch:
            before_state = st.state
            before_price = st.price
            st.state = SettlementState.COMPLETED
            if getattr(st, "completed_at", None) is None:
                st.completed_at = now
            st.update_user_id = user.id
            await _try_add_settlement_history(
                db,
                SettlementHistory(
                    settlement_id=st.id,
                    order_id=st.order_id,
                    action_type=SettlementHistoryActionType.STATE_CHANGED,
                    update_user_id=user.id,
                    reason="선택반영: 전체 완료",
                    from_state=before_state,
                    to_state=st.state,
                    before_price=before_price,
                    after_price=st.price,
                ),
            )
            updated += 1

        last_id = batch[-1].id
        # commit per batch to keep transactions bounded
        await db.commit()

    return SettlementBulkActionResponse(ok=True, updated=updated)


@router.post("/settled/reject-all", response_model=SettlementBulkActionResponse)
async def reject_all_settled(
    channel_name: str | None = Query(default=None),
    mall_product_name: str | None = Query(default=None),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    _ = await require_permission("settlements", "update")(user, db)
    updated = 0
    last_id: UUID | None = None
    batch_size = 500

    for _ in range(50_000):
        q = (
            select(Settlement)
            .join(Order, Order.id == Settlement.order_id)
            .outerjoin(Channel, Channel.id == Order.channel_id)
            .where(
                Settlement.is_delete == False,
                Order.is_delete == False,
                Settlement.state == SettlementState.SETTLED,
            )
        )
        if last_id is not None:
            q = q.where(Settlement.id > last_id)
        if channel_name is not None and channel_name.strip():
            s = channel_name.strip()
            q = q.where(Channel.name.ilike(f"%{s}%"))
        if mall_product_name is not None and mall_product_name.strip():
            s = mall_product_name.strip()
            q = q.where(Order.mall_product_name.ilike(f"%{s}%"))
        q = q.order_by(Settlement.id.asc()).limit(batch_size)

        res = await db.execute(q)
        batch: list[Settlement] = res.scalars().unique().all()
        if not batch:
            break

        for st in batch:
            before_state = st.state
            before_price = st.price
            st.state = SettlementState.REJECT
            st.update_user_id = user.id
            await _try_add_settlement_history(
                db,
                SettlementHistory(
                    settlement_id=st.id,
                    order_id=st.order_id,
                    action_type=SettlementHistoryActionType.STATE_CHANGED,
                    update_user_id=user.id,
                    reason="선택반영: 전체 반려",
                    from_state=before_state,
                    to_state=st.state,
                    before_price=before_price,
                    after_price=st.price,
                ),
            )
            updated += 1

        last_id = batch[-1].id
        await db.commit()

    return SettlementBulkActionResponse(ok=True, updated=updated)

