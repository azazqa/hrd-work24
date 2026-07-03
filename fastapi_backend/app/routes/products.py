from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import User, get_async_session
from app.models import Product, ProductState
from app.schemas import ProductRead, ProductCreate, ProductUpdate
from app.users import current_active_user
from app.permissions import require_permission

router = APIRouter(tags=["product"])


def transform(rows):
    return [ProductRead.model_validate(r) for r in rows]


def _strip_optional(s: str | None) -> str | None:
    if s is None:
        return None
    t = s.strip()
    return t if t else None


@router.get("/", response_model=Page[ProductRead])
async def list_products(
    page: int = 1,
    size: int = 10,
    category_id: UUID | None = None,
    state: ProductState | None = None,
    product_code: str | None = Query(None, description="상품코드 부분 일치"),
    name: str | None = Query(None, description="상품명 부분 일치"),
    description: str | None = Query(None, description="설명 부분 일치"),
    is_tax: str | None = Query(None, description="true / false"),
    tax_rate_min: Decimal | None = Query(None, ge=0, le=100, description="세율 구간 하한 (%)"),
    tax_rate_max: Decimal | None = Query(None, ge=0, le=100, description="세율 구간 상한 (%)"),
    max_shipping_min: int | None = Query(None, ge=0, description="최대 배송 구간 하한"),
    max_shipping_max: int | None = Query(None, ge=0, description="최대 배송 구간 상한"),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("products", "read")),
):
    params = Params(page=page, size=size)
    query = select(Product).filter(Product.is_delete == False)
    if category_id is not None:
        query = query.filter(Product.category_id == category_id)
    if state is not None:
        query = query.filter(Product.state == state)

    pc = _strip_optional(product_code)
    if pc is not None:
        query = query.filter(Product.product_code.ilike(f"%{pc}%"))
    nm = _strip_optional(name)
    if nm is not None:
        query = query.filter(Product.name.ilike(f"%{nm}%"))
    desc = _strip_optional(description)
    if desc is not None:
        query = query.filter(Product.description.ilike(f"%{desc}%"))

    if is_tax is not None and is_tax.strip() != "":
        v = is_tax.strip().lower()
        if v == "true":
            query = query.filter(Product.is_tax.is_(True))
        elif v == "false":
            query = query.filter(Product.is_tax.is_(False))

    if tax_rate_min is not None and tax_rate_max is not None and tax_rate_min > tax_rate_max:
        raise HTTPException(
            status_code=422,
            detail="tax_rate_min은 tax_rate_max 이하여야 합니다.",
        )
    if tax_rate_min is not None:
        query = query.filter(Product.tax_rate >= tax_rate_min)
    if tax_rate_max is not None:
        query = query.filter(Product.tax_rate <= tax_rate_max)

    if max_shipping_min is not None and max_shipping_max is not None and max_shipping_min > max_shipping_max:
        raise HTTPException(
            status_code=422,
            detail="max_shipping_min은 max_shipping_max 이하여야 합니다.",
        )
    if max_shipping_min is not None:
        query = query.filter(Product.max_shipping_number >= max_shipping_min)
    if max_shipping_max is not None:
        query = query.filter(Product.max_shipping_number <= max_shipping_max)

    return await apaginate(db, query, params, transformer=transform)


@router.get("/{product_id}", response_model=ProductRead)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("products", "read")),
):
    result = await db.execute(
        select(Product)
        .filter(Product.id == product_id, Product.is_delete == False)
    )
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/", response_model=ProductRead)
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("products", "create")),
):
    product = Product(**data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: UUID,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("products", "update")),
):
    result = await db.execute(select(Product).filter(Product.id == product_id, Product.is_delete == False))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(product, key, value)

    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/{product_id}")
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("products", "delete")),
):
    result = await db.execute(select(Product).filter(Product.id == product_id, Product.is_delete == False))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.is_delete = True
    await db.commit()
    return {"message": "Product successfully deleted"}
