from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_pagination.ext.sqlalchemy import apaginate
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.models import ClientNameMapping, User
from app.pagination import MAX_PAGE_SIZE, Page, Params
from app.users import current_active_user

router = APIRouter()


class ClientNameMappingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    institution_name: str
    client_name: str
    created_at: datetime
    updated_at: datetime


class ClientNameMappingCreate(BaseModel):
    institution_name: str = Field(min_length=1, max_length=255)
    client_name: str = Field(min_length=1, max_length=255)


class ClientNameMappingUpdate(BaseModel):
    institution_name: str | None = Field(default=None, min_length=1, max_length=255)
    client_name: str | None = Field(default=None, min_length=1, max_length=255)


def _transform_list(items: list[ClientNameMapping]) -> list[ClientNameMappingRead]:
    return [ClientNameMappingRead.model_validate(row) for row in items]


@router.get("", response_model=Page[ClientNameMappingRead])
async def list_client_mappings(
    page: int = 1,
    size: int = 20,
    q: str | None = Query(default=None, description="훈련기관명/고객사 검색"),
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_active_user),
):
    if size < 1:
        raise HTTPException(status_code=400, detail="size must be >= 1")
    if size > MAX_PAGE_SIZE:
        raise HTTPException(status_code=400, detail=f"size must be <= {MAX_PAGE_SIZE}")

    params = Params(page=page, size=size)
    stmt = select(ClientNameMapping).where(
        ClientNameMapping.is_delete == False  # noqa: E712
    )
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                ClientNameMapping.institution_name.ilike(term),
                ClientNameMapping.client_name.ilike(term),
            )
        )
    stmt = stmt.order_by(ClientNameMapping.institution_name.asc(), ClientNameMapping.id.asc())
    return await apaginate(session, stmt, params, transformer=_transform_list)


@router.post("", response_model=ClientNameMappingRead, status_code=201)
async def create_client_mapping(
    body: ClientNameMappingCreate,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_active_user),
):
    institution_name = body.institution_name.strip()
    client_name = body.client_name.strip()
    if not institution_name or not client_name:
        raise HTTPException(status_code=400, detail="훈련기관명과 고객사명은 필수입니다.")

    existing = await session.scalar(
        select(ClientNameMapping).where(
            ClientNameMapping.institution_name == institution_name
        )
    )
    if existing and not existing.is_delete:
        raise HTTPException(status_code=409, detail="이미 등록된 훈련기관명입니다.")

    if existing and existing.is_delete:
        existing.is_delete = False
        existing.client_name = client_name
        await session.commit()
        await session.refresh(existing)
        return ClientNameMappingRead.model_validate(existing)

    row = ClientNameMapping(
        institution_name=institution_name,
        client_name=client_name,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return ClientNameMappingRead.model_validate(row)


@router.put("/{mapping_id}", response_model=ClientNameMappingRead)
async def update_client_mapping(
    mapping_id: int,
    body: ClientNameMappingUpdate,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_active_user),
):
    row = await session.scalar(
        select(ClientNameMapping).where(
            ClientNameMapping.id == mapping_id,
            ClientNameMapping.is_delete == False,  # noqa: E712
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail="맵핑을 찾을 수 없습니다.")

    if body.institution_name is not None:
        new_inst = body.institution_name.strip()
        if not new_inst:
            raise HTTPException(status_code=400, detail="훈련기관명이 비어 있습니다.")
        conflict = await session.scalar(
            select(ClientNameMapping).where(
                ClientNameMapping.institution_name == new_inst,
                ClientNameMapping.id != mapping_id,
                ClientNameMapping.is_delete == False,  # noqa: E712
            )
        )
        if conflict:
            raise HTTPException(status_code=409, detail="이미 등록된 훈련기관명입니다.")
        row.institution_name = new_inst

    if body.client_name is not None:
        new_client = body.client_name.strip()
        if not new_client:
            raise HTTPException(status_code=400, detail="고객사명이 비어 있습니다.")
        row.client_name = new_client

    await session.commit()
    await session.refresh(row)
    return ClientNameMappingRead.model_validate(row)


@router.delete("/{mapping_id}", status_code=204)
async def delete_client_mapping(
    mapping_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_active_user),
):
    row = await session.scalar(
        select(ClientNameMapping).where(
            ClientNameMapping.id == mapping_id,
            ClientNameMapping.is_delete == False,  # noqa: E712
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail="맵핑을 찾을 수 없습니다.")
    row.is_delete = True
    await session.commit()
