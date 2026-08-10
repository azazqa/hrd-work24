from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_pagination.ext.sqlalchemy import apaginate
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.models import Company, User
from app.pagination import MAX_PAGE_SIZE, Page, Params
from app.users import current_active_user

router = APIRouter()


class CompanyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CompanyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    is_active: bool = True


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None


def _transform_list(items: list[Company]) -> list[CompanyRead]:
    return [CompanyRead.model_validate(row) for row in items]


async def require_active_company(
    session: AsyncSession, company_id: int
) -> Company:
    row = await session.get(Company, company_id)
    if row is None or row.is_delete or not row.is_active:
        raise HTTPException(status_code=400, detail="유효한 업체를 선택하세요.")
    return row


@router.get("", response_model=Page[CompanyRead])
async def list_companies(
    page: int = 1,
    size: int = 100,
    q: str | None = Query(default=None, description="업체명 검색"),
    is_active: bool | None = Query(default=None),
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_active_user),
):
    if size < 1:
        raise HTTPException(status_code=400, detail="size must be >= 1")
    if size > MAX_PAGE_SIZE:
        raise HTTPException(status_code=400, detail=f"size must be <= {MAX_PAGE_SIZE}")

    params = Params(page=page, size=size)
    stmt = select(Company).where(Company.is_delete == False)  # noqa: E712
    if is_active is not None:
        stmt = stmt.where(Company.is_active == is_active)
    if q and q.strip():
        stmt = stmt.where(Company.name.ilike(f"%{q.strip()}%"))
    stmt = stmt.order_by(Company.name.asc(), Company.id.asc())
    return await apaginate(session, stmt, params, transformer=_transform_list)


@router.post("", response_model=CompanyRead, status_code=201)
async def create_company(
    body: CompanyCreate,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_active_user),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="업체명은 필수입니다.")

    existing = await session.scalar(select(Company).where(Company.name == name))
    if existing and not existing.is_delete:
        raise HTTPException(status_code=409, detail="이미 등록된 업체명입니다.")

    if existing and existing.is_delete:
        existing.is_delete = False
        existing.is_active = body.is_active
        await session.commit()
        await session.refresh(existing)
        return CompanyRead.model_validate(existing)

    row = Company(name=name, is_active=body.is_active)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return CompanyRead.model_validate(row)


@router.get("/{company_id}", response_model=CompanyRead)
async def get_company(
    company_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_active_user),
):
    row = await session.get(Company, company_id)
    if row is None or row.is_delete:
        raise HTTPException(status_code=404, detail="업체를 찾을 수 없습니다.")
    return CompanyRead.model_validate(row)


@router.put("/{company_id}", response_model=CompanyRead)
async def update_company(
    company_id: int,
    body: CompanyUpdate,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_active_user),
):
    row = await session.get(Company, company_id)
    if row is None or row.is_delete:
        raise HTTPException(status_code=404, detail="업체를 찾을 수 없습니다.")

    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if not name:
            raise HTTPException(status_code=400, detail="업체명은 필수입니다.")
        dup = await session.scalar(
            select(Company).where(
                Company.name == name,
                Company.id != company_id,
                Company.is_delete == False,  # noqa: E712
            )
        )
        if dup:
            raise HTTPException(status_code=409, detail="이미 등록된 업체명입니다.")
        row.name = name
    if "is_active" in data and data["is_active"] is not None:
        row.is_active = data["is_active"]

    await session.commit()
    await session.refresh(row)
    return CompanyRead.model_validate(row)


@router.delete("/{company_id}", status_code=204)
async def delete_company(
    company_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_active_user),
):
    row = await session.get(Company, company_id)
    if row is None or row.is_delete:
        raise HTTPException(status_code=404, detail="업체를 찾을 수 없습니다.")
    row.is_delete = True
    row.is_active = False
    await session.commit()
    return None
