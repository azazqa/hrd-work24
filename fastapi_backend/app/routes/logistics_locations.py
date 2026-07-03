from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import User, get_async_session
from app.models import LogisticsLocation
from app.schemas import (
    LogisticsLocationRead,
    LogisticsLocationCreate,
    LogisticsLocationUpdate,
)
from app.users import current_active_user
from app.permissions import require_permission

router = APIRouter(tags=["logistics_location"])


def transform(rows):
    return [LogisticsLocationRead.model_validate(r) for r in rows]


@router.get("/", response_model=Page[LogisticsLocationRead])
async def list_logistics_locations(
    page: int = 1,
    size: int = 10,
    name: str | None = Query(default=None),
    description: str | None = Query(default=None),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("logistics_locations", "read")),
):
    params = Params(page=page, size=size)
    query = select(LogisticsLocation).filter(LogisticsLocation.is_delete == False)
    if name is not None and name.strip():
        query = query.filter(LogisticsLocation.name.ilike(f"%{name.strip()}%"))
    if description is not None and description.strip():
        query = query.filter(
            LogisticsLocation.description.ilike(f"%{description.strip()}%")
        )
    return await apaginate(db, query, params, transformer=transform)


@router.get("/{location_id}", response_model=LogisticsLocationRead)
async def get_logistics_location(
    location_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("logistics_locations", "read")),
):
    result = await db.execute(
        select(LogisticsLocation).filter(
            LogisticsLocation.id == location_id,
            LogisticsLocation.is_delete == False,
        )
    )
    location = result.scalars().first()
    if not location:
        raise HTTPException(status_code=404, detail="LogisticsLocation not found")
    return location


@router.post("/", response_model=LogisticsLocationRead)
async def create_logistics_location(
    data: LogisticsLocationCreate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("logistics_locations", "create")),
):
    location = LogisticsLocation(**data.model_dump())
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return location


@router.put("/{location_id}", response_model=LogisticsLocationRead)
async def update_logistics_location(
    location_id: UUID,
    data: LogisticsLocationUpdate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("logistics_locations", "update")),
):
    result = await db.execute(
        select(LogisticsLocation).filter(
            LogisticsLocation.id == location_id,
            LogisticsLocation.is_delete == False,
        )
    )
    location = result.scalars().first()
    if not location:
        raise HTTPException(status_code=404, detail="LogisticsLocation not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(location, key, value)

    await db.commit()
    await db.refresh(location)
    return location


@router.delete("/{location_id}")
async def delete_logistics_location(
    location_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("logistics_locations", "delete")),
):
    result = await db.execute(
        select(LogisticsLocation).filter(
            LogisticsLocation.id == location_id,
            LogisticsLocation.is_delete == False,
        )
    )
    location = result.scalars().first()
    if not location:
        raise HTTPException(status_code=404, detail="LogisticsLocation not found")

    location.is_delete = True
    await db.commit()
    return {"message": "LogisticsLocation successfully deleted"}
