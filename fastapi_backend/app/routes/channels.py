from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlalchemy import apaginate
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import User, get_async_session
from app.models import Channel, Courier, ChannelOrderExcelMappingVersion
from app.schemas import (
    ChannelRead,
    ChannelCreate,
    ChannelUpdate,
    OrderExcelMapping,
    ORDER_EXCEL_CANONICAL_LABELS,
)
from app.users import current_active_user
from app.permissions import require_permission

router = APIRouter(tags=["channel"])


def _sanitize_order_excel_mapping_dict(mapping: dict) -> tuple[dict, list[str]]:
    """JSONB 원본은 유지하되, 응답용 검증 전에 현재 표준에 없는 label 행은 제거하고 경고를 남긴다."""
    warnings: list[str] = []
    out = dict(mapping)
    cols = mapping.get("columns")
    if not isinstance(cols, dict):
        return out, warnings
    new_cols: dict = {}
    for excel_key, meta in cols.items():
        if not isinstance(meta, dict):
            continue
        label = str(meta.get("label", "")).strip()
        if not label:
            continue
        if label not in ORDER_EXCEL_CANONICAL_LABELS:
            warnings.append(
                f"저장된 주문 엑셀 매핑에 현재 시스템에서 인식하지 않는 표준 필드가 있습니다(화면에는 반영되지 않습니다): 「{label}」(엑셀 열: {excel_key})"
            )
            continue
        new_cols[excel_key] = meta
    out["columns"] = new_cols
    return out, warnings


def _to_read(channel: Channel) -> ChannelRead:
    # 즉시 전환: 응답 매핑은 current 버전의 mapping을 사용한다.
    cur = getattr(channel, "current_mapping_version", None)
    mapping = getattr(cur, "mapping", None) if cur is not None else None
    warnings: list[str] = []
    mapping_model: OrderExcelMapping | None = None
    if mapping is not None:
        if isinstance(mapping, dict):
            sanitized, w = _sanitize_order_excel_mapping_dict(mapping)
            warnings.extend(w)
            try:
                mapping_model = OrderExcelMapping.model_validate(sanitized)
            except ValidationError:
                warnings.append(
                    "주문 엑셀 매핑 형식이 올바르지 않아 이 화면에서는 매핑을 표시할 수 없습니다. 엑셀에서 불러오기로 다시 설정해 주세요."
                )
                mapping_model = None
        else:
            warnings.append("주문 엑셀 매핑 데이터 형식이 올바르지 않습니다.")

    return ChannelRead(
        id=channel.id,
        name=channel.name,
        description=channel.description,
        url=getattr(channel, "url", None),
        courier_id=channel.courier_id,
        order_excel_mapping=mapping_model,
        order_excel_mapping_warnings=warnings,
        created_at=channel.created_at,
        updated_at=channel.updated_at,
        courier_name=channel.courier.name if getattr(channel, "courier", None) else None,
    )


def transform(rows):
    return [_to_read(r) for r in rows]


@router.get("/", response_model=Page[ChannelRead])
async def list_channels(
    page: int = 1,
    size: int = 10,
    name: str | None = Query(default=None),
    description: str | None = Query(default=None),
    courier_name: str | None = Query(default=None),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("channels", "read")),
):
    params = Params(page=page, size=size)
    query = (
        select(Channel)
        .outerjoin(Courier, Courier.id == Channel.courier_id)
        .filter(Channel.is_delete == False)
        .options(selectinload(Channel.courier), selectinload(Channel.current_mapping_version))
    )
    if name is not None and name.strip():
        query = query.filter(Channel.name.ilike(f"%{name.strip()}%"))
    if description is not None and description.strip():
        query = query.filter(Channel.description.ilike(f"%{description.strip()}%"))
    if courier_name is not None and courier_name.strip():
        query = query.filter(Courier.name.ilike(f"%{courier_name.strip()}%"))
    return await apaginate(db, query, params, transformer=transform)


@router.get("/{channel_id}", response_model=ChannelRead)
async def get_channel(
    channel_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("channels", "read")),
):
    result = await db.execute(
        select(Channel)
        .filter(Channel.id == channel_id, Channel.is_delete == False)
        .options(selectinload(Channel.courier), selectinload(Channel.current_mapping_version))
    )
    channel = result.scalars().first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    return _to_read(channel)


@router.post("/", response_model=ChannelRead)
async def create_channel(
    data: ChannelCreate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("channels", "create")),
):
    # 즉시 전환: 채널 매핑은 버전 테이블이 source of truth
    payload = data.model_dump()
    mapping = payload.pop("order_excel_mapping", None)
    channel = Channel(**payload)
    db.add(channel)
    await db.flush()

    if mapping is not None:
        v = ChannelOrderExcelMappingVersion(
            channel_id=channel.id,
            mapping=mapping,
        )
        db.add(v)
        await db.flush()
        channel.current_mapping_version_id = v.id

    await db.commit()
    result = await db.execute(
        select(Channel)
        .filter(Channel.id == channel.id)
        .options(selectinload(Channel.courier), selectinload(Channel.current_mapping_version))
    )
    channel_loaded = result.scalar_one()
    return _to_read(channel_loaded)


@router.put("/{channel_id}", response_model=ChannelRead)
async def update_channel(
    channel_id: UUID,
    data: ChannelUpdate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("channels", "update")),
):
    result = await db.execute(
        select(Channel).filter(Channel.id == channel_id, Channel.is_delete == False)
    )
    channel = result.scalars().first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    fields = data.model_dump(exclude_unset=True)
    if "order_excel_mapping" in fields and fields.get("order_excel_mapping") is None:
        raise HTTPException(status_code=422, detail="채널 주문 엑셀 매핑은 삭제할 수 없습니다.")

    mapping = fields.pop("order_excel_mapping", None)
    for key, value in fields.items():
        setattr(channel, key, value)

    if mapping is not None:
        v = ChannelOrderExcelMappingVersion(
            channel_id=channel.id,
            mapping=mapping,
        )
        db.add(v)
        await db.flush()
        channel.current_mapping_version_id = v.id

    await db.commit()
    result = await db.execute(
        select(Channel)
        .filter(Channel.id == channel.id)
        .options(selectinload(Channel.courier), selectinload(Channel.current_mapping_version))
    )
    channel_loaded = result.scalar_one()
    return _to_read(channel_loaded)


@router.delete("/{channel_id}")
async def delete_channel(
    channel_id: UUID,
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("channels", "delete")),
):
    """채널은 주문 데이터와 연계되므로 삭제할 수 없습니다."""
    raise HTTPException(
        status_code=403,
        detail="채널은 주문 데이터와 연계되어 있어 삭제할 수 없습니다.",
    )
