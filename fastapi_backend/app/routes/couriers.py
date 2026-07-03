from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import User, get_async_session
from app.models import Courier
from app.schemas import CourierRead, CourierCreate, CourierUpdate
from app.users import current_active_user
from app.permissions import require_permission

router = APIRouter(tags=["courier"])


def transform(rows):
    return [CourierRead.model_validate(r) for r in rows]


@router.get("/", response_model=Page[CourierRead])
async def list_couriers(
    page: int = 1,
    size: int = 10,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("couriers", "read")),
):
    params = Params(page=page, size=size)
    query = select(Courier).filter(Courier.is_delete == False)
    return await apaginate(db, query, params, transformer=transform)


@router.get("/{courier_id}", response_model=CourierRead)
async def get_courier(
    courier_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("couriers", "read")),
):
    result = await db.execute(
        select(Courier).filter(Courier.id == courier_id, Courier.is_delete == False)
    )
    courier = result.scalars().first()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")
    return courier


@router.post("/", response_model=CourierRead)
async def create_courier(
    data: CourierCreate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("couriers", "create")),
):
    courier = Courier(**data.model_dump())
    db.add(courier)
    await db.commit()
    await db.refresh(courier)
    return courier


@router.put("/{courier_id}", response_model=CourierRead)
async def update_courier(
    courier_id: UUID,
    data: CourierUpdate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("couriers", "update")),
):
    result = await db.execute(
        select(Courier).filter(Courier.id == courier_id, Courier.is_delete == False)
    )
    courier = result.scalars().first()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(courier, key, value)

    await db.commit()
    await db.refresh(courier)
    return courier


@router.delete("/{courier_id}")
async def delete_courier(
    courier_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("couriers", "delete")),
):
    result = await db.execute(
        select(Courier).filter(Courier.id == courier_id, Courier.is_delete == False)
    )
    courier = result.scalars().first()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")

    courier.is_delete = True
    await db.commit()
    return {"message": "Courier successfully deleted"}
