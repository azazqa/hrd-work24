from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import User, get_async_session
from app.models import Receiver
from app.schemas import ReceiverRead, ReceiverCreate, ReceiverUpdate
from app.users import current_active_user
from app.permissions import require_permission

router = APIRouter(tags=["receiver"])


def transform(rows):
    return [ReceiverRead.model_validate(r) for r in rows]


@router.get("/", response_model=Page[ReceiverRead])
async def list_receivers(
    page: int = 1,
    size: int = 10,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("receivers", "read")),
):
    params = Params(page=page, size=size)
    query = select(Receiver).filter(Receiver.is_delete == False)
    return await apaginate(db, query, params, transformer=transform)


@router.get("/{receiver_id}", response_model=ReceiverRead)
async def get_receiver(
    receiver_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("receivers", "read")),
):
    result = await db.execute(select(Receiver).filter(Receiver.id == receiver_id, Receiver.is_delete == False))
    receiver = result.scalars().first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")
    return receiver


@router.post("/", response_model=ReceiverRead)
async def create_receiver(
    data: ReceiverCreate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("receivers", "create")),
):
    receiver = Receiver(**data.model_dump())
    db.add(receiver)
    await db.commit()
    await db.refresh(receiver)
    return receiver


@router.put("/{receiver_id}", response_model=ReceiverRead)
async def update_receiver(
    receiver_id: UUID,
    data: ReceiverUpdate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("receivers", "update")),
):
    result = await db.execute(select(Receiver).filter(Receiver.id == receiver_id, Receiver.is_delete == False))
    receiver = result.scalars().first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(receiver, key, value)

    await db.commit()
    await db.refresh(receiver)
    return receiver


@router.delete("/{receiver_id}")
async def delete_receiver(
    receiver_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("receivers", "delete")),
):
    result = await db.execute(select(Receiver).filter(Receiver.id == receiver_id, Receiver.is_delete == False))
    receiver = result.scalars().first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    receiver.is_delete = True
    await db.commit()
    return {"message": "Receiver successfully deleted"}
