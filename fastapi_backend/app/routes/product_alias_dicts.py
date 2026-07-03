from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_

from app.database import User, get_async_session
from app.models import ProductAliasDict, ProductAliasItem, Product, Channel
from app.schemas import (
    ProductAliasDictRead,
    ProductAliasDictCreate,
    ProductAliasDictUpdate,
)
from app.users import current_active_user
from app.permissions import require_permission

router = APIRouter(tags=["product_alias_dict"])


def _item_to_read(item: ProductAliasItem) -> ProductAliasDictRead:
    alias = item.alias
    ch = getattr(alias, "channel", None) if alias is not None else None
    return ProductAliasDictRead(
        id=item.id,
        alias_id=item.alias_id,
        product_id=item.product_id,
        channel_id=getattr(alias, "channel_id", None) if alias is not None else None,
        channel_name=getattr(ch, "name", None) if ch is not None else None,
        alias=alias.alias if alias is not None else "",
        price=alias.price if alias is not None else 0,
        commission=getattr(alias, "commission", 0) if alias is not None else 0,
        quantity=item.quantity,
        created_at=item.created_at,
        updated_at=item.updated_at,
        product_name=item.product.name if item.product is not None else None,
        product_price=item.product.price if item.product is not None else None,
    )


@router.get("/", response_model=Page[ProductAliasDictRead])
async def list_product_alias_dicts(
    page: int = 1,
    size: int = 10,
    product_id: UUID | None = Query(default=None),
    channel_id: UUID | None = Query(default=None),
    channel_ids: str | None = Query(
        default=None,
        description="Comma-separated channel ids. Example: channel_ids=id1,id2",
    ),
    alias: str | None = Query(default=None),
    product_name: str | None = Query(default=None),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("product_alias_dicts", "read")),
):
    params = Params(page=page, size=size)
    query = (
        select(ProductAliasItem)
        .join(ProductAliasDict, ProductAliasItem.alias_id == ProductAliasDict.id)
        .join(Product, ProductAliasItem.product_id == Product.id)
        .filter(ProductAliasItem.is_delete == False, ProductAliasDict.is_delete == False)
        .options(
            selectinload(ProductAliasItem.alias).selectinload(ProductAliasDict.channel),
            selectinload(ProductAliasItem.product),
        )
    )
    if product_id is not None:
        query = query.filter(ProductAliasItem.product_id == product_id)
    # channel filter (multi > single)
    if channel_ids is not None and channel_ids.strip():
        tokens = [t.strip() for t in channel_ids.split(",") if t.strip()]
        parsed: list[UUID] = []
        for t in tokens:
            try:
                parsed.append(UUID(t))
            except Exception:
                raise HTTPException(status_code=422, detail="Invalid channel_ids")
        if parsed:
            query = query.filter(ProductAliasDict.channel_id.in_(parsed))
    elif channel_id is not None:
        query = query.filter(ProductAliasDict.channel_id == channel_id)
    if alias is not None and alias.strip():
        query = query.filter(ProductAliasDict.alias.ilike(f"%{alias.strip()}%"))
    if product_name is not None and product_name.strip():
        query = query.filter(Product.name.ilike(f"%{product_name.strip()}%"))
    return await apaginate(
        db,
        query,
        params,
        transformer=lambda rows: [_item_to_read(r) for r in rows],
    )


@router.get("/{alias_item_id}", response_model=ProductAliasDictRead)
async def get_product_alias_dict(
    alias_item_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("product_alias_dicts", "read")),
):
    result = await db.execute(
        select(ProductAliasItem)
        .join(ProductAliasDict, ProductAliasItem.alias_id == ProductAliasDict.id)
        .filter(
            ProductAliasItem.id == alias_item_id,
            ProductAliasItem.is_delete == False,
            ProductAliasDict.is_delete == False,
        )
        .options(
            selectinload(ProductAliasItem.alias).selectinload(ProductAliasDict.channel),
            selectinload(ProductAliasItem.product),
        )
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="ProductAliasDict not found")
    return _item_to_read(item)


async def _load_alias_item_for_read(
    db: AsyncSession, item_id: UUID
) -> ProductAliasItem | None:
    result = await db.execute(
        select(ProductAliasItem)
        .where(ProductAliasItem.id == item_id)
        .options(
            selectinload(ProductAliasItem.alias).selectinload(ProductAliasDict.channel),
            selectinload(ProductAliasItem.product),
        )
    )
    return result.scalars().first()


@router.post("/", response_model=ProductAliasDictRead)
async def create_product_alias_dict(
    data: ProductAliasDictCreate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("product_alias_dicts", "create")),
):
    alias_str = data.alias.strip()
    ch_id = getattr(data, "channel_id", None)

    # alias 헤더 찾기 또는 생성
    result = await db.execute(
        select(ProductAliasDict).filter(
            ProductAliasDict.alias == alias_str,
            ProductAliasDict.channel_id == ch_id,
            ProductAliasDict.is_delete == False,
        )
    )
    alias = result.scalars().first()
    if not alias:
        alias = ProductAliasDict(alias=alias_str, channel_id=ch_id)
        db.add(alias)
        await db.flush()
    # 가격이 전달되면 헤더에 반영(0 포함)
    if getattr(data, "price", None) is not None:
        alias.price = data.price
    # 수수료가 전달되면 헤더에 반영(0 포함)
    if getattr(data, "commission", None) is not None:
        alias.commission = data.commission

    # 동일 alias + product_id 중복 방지
    existing_item = await db.execute(
        select(ProductAliasItem).filter(
            ProductAliasItem.alias_id == alias.id,
            ProductAliasItem.product_id == data.product_id,
            ProductAliasItem.is_delete == False,
        )
    )
    if existing_item.scalars().first():
        raise HTTPException(
            status_code=422,
            detail="이 별칭에 이미 등록된 상품입니다.",
        )

    item = ProductAliasItem(
        alias_id=alias.id,
        product_id=data.product_id,
        quantity=data.quantity or 1,
    )
    db.add(item)
    await db.commit()
    loaded = await _load_alias_item_for_read(db, item.id)
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load alias item")
    return _item_to_read(loaded)


@router.put("/{alias_item_id}", response_model=ProductAliasDictRead)
async def update_product_alias_dict(
    alias_item_id: UUID,
    data: ProductAliasDictUpdate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("product_alias_dicts", "update")),
):
    result = await db.execute(
        select(ProductAliasItem)
        .join(ProductAliasDict, ProductAliasItem.alias_id == ProductAliasDict.id)
        .filter(
            ProductAliasItem.id == alias_item_id,
            ProductAliasItem.is_delete == False,
            ProductAliasDict.is_delete == False,
        )
        .options(
            selectinload(ProductAliasItem.alias),
            selectinload(ProductAliasItem.product),
        )
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="ProductAliasDict not found")

    alias = item.alias
    updates = data.model_dump(exclude_unset=True)

    # 채널 변경
    if "channel_id" in updates:
        alias.channel_id = updates["channel_id"]

    # alias 문자열 변경 시 중복 체크
    if "alias" in updates and updates["alias"] is not None:
        new_alias_str = updates["alias"].strip()
        existing_header = await db.execute(
            select(ProductAliasDict).filter(
                ProductAliasDict.alias == new_alias_str,
                ProductAliasDict.channel_id == getattr(alias, "channel_id", None),
                ProductAliasDict.is_delete == False,
                ProductAliasDict.id != alias.id,
            )
        )
        if existing_header.scalars().first():
            raise HTTPException(
                status_code=422,
                detail="이미 존재하는 별칭입니다.",
            )
        alias.alias = new_alias_str

    if "price" in updates and updates["price"] is not None:
        alias.price = updates["price"]
    if "commission" in updates and updates["commission"] is not None:
        alias.commission = updates["commission"]

    if "product_id" in updates and updates["product_id"] is not None:
        item.product_id = updates["product_id"]
    if "quantity" in updates and updates["quantity"] is not None:
        item.quantity = updates["quantity"]

    await db.commit()
    loaded = await _load_alias_item_for_read(db, item.id)
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load alias item")
    return _item_to_read(loaded)


@router.delete("/{alias_item_id}")
async def delete_product_alias_dict(
    alias_item_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("product_alias_dicts", "delete")),
):
    result = await db.execute(
        select(ProductAliasItem)
        .join(ProductAliasDict, ProductAliasItem.alias_id == ProductAliasDict.id)
        .filter(
            ProductAliasItem.id == alias_item_id,
            ProductAliasItem.is_delete == False,
            ProductAliasDict.is_delete == False,
        )
        .options(selectinload(ProductAliasItem.alias).selectinload(ProductAliasDict.channel))
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="ProductAliasDict not found")

    alias = item.alias
    item.is_delete = True

    # 해당 alias 헤더에 더 이상 활성 아이템이 없다면 헤더도 삭제 처리
    other_items = await db.execute(
        select(ProductAliasItem).filter(
            ProductAliasItem.alias_id == alias.id,
            ProductAliasItem.is_delete == False,
            ProductAliasItem.id != item.id,
        )
    )
    if not other_items.scalars().first():
        alias.is_delete = True

    await db.commit()
    return {"message": "ProductAliasDict successfully deleted"}

