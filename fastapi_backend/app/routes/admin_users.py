from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi_users import InvalidPasswordException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_async_session
from app.models import User
from app.schemas import UserCreate, UserRead, UserUpdate
from app.users import UserManager, current_superuser, get_user_manager

router = APIRouter()


def _norm_optional_str(v: str | None) -> str | None:
    if v is None:
        return None
    t = v.strip()
    return t or None


class AdminUserCreate(BaseModel):
    email: str = Field(min_length=4, max_length=320)
    password: str = Field(min_length=8)
    is_superuser: bool = False
    is_active: bool = True
    is_verified: bool = False
    department: str | None = Field(default=None, max_length=128)
    full_name: str | None = Field(default=None, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    extension_number: str | None = Field(default=None, max_length=32)


class AdminUserListResponse(BaseModel):
    items: list[UserRead]
    total: int


@router.get("", response_model=AdminUserListResponse)
async def admin_list_users(
    offset: int = 0,
    limit: int = 50,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_superuser),
):
    if limit < 1:
        raise HTTPException(status_code=400, detail="limit must be >= 1")
    if limit > 100:
        raise HTTPException(status_code=400, detail="limit must be <= 100")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be >= 0")

    # NOTE: User inherits Base.is_delete
    total = await session.scalar(
        select(func.count()).select_from(User).where(User.is_delete == False)  # noqa: E712
    )

    result = await session.execute(
        select(User)
        .where(User.is_delete == False)  # noqa: E712
        .options(joinedload(User.logistics_location))
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    users = result.scalars().unique().all()
    items: list[UserRead] = []
    for u in users:
        base = UserRead.model_validate(u)
        ll = getattr(u, "logistics_location", None)
        name = str(ll.name) if ll is not None and getattr(ll, "name", None) is not None else None
        items.append(base.model_copy(update={"logistics_location_name": name}))
    return AdminUserListResponse(
        items=items,
        total=int(total or 0),
    )


@router.post("", response_model=UserRead, status_code=201)
async def admin_create_user(
    payload: AdminUserCreate,
    user_manager: UserManager = Depends(get_user_manager),
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_superuser),
):
    try:
        created = await user_manager.create(
            UserCreate(email=payload.email, password=payload.password),
            safe=True,
            request=None,
        )
    except InvalidPasswordException as e:
        # Convert password policy failure into 422 for UI
        reason = getattr(e, "reason", None)
        raise HTTPException(status_code=422, detail=reason or "Invalid password")

    # Apply flags
    created.is_superuser = payload.is_superuser  # type: ignore[attr-defined]
    created.is_active = payload.is_active  # type: ignore[attr-defined]
    created.is_verified = payload.is_verified  # type: ignore[attr-defined]
    created.department = _norm_optional_str(payload.department)  # type: ignore[attr-defined]
    created.full_name = _norm_optional_str(payload.full_name)  # type: ignore[attr-defined]
    created.phone = _norm_optional_str(payload.phone)  # type: ignore[attr-defined]
    created.extension_number = _norm_optional_str(payload.extension_number)  # type: ignore[attr-defined]

    session.add(created)
    await session.commit()
    await session.refresh(created)

    return UserRead.model_validate(created)


class AdminSetPassword(BaseModel):
    password: str = Field(min_length=8)


@router.post("/{user_id}/password", response_model=UserRead)
async def admin_set_password(
    user_id: uuid.UUID,
    payload: AdminSetPassword,
    user_manager: UserManager = Depends(get_user_manager),
    _: User = Depends(current_superuser),
):
    user = await user_manager.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        updated = await user_manager.update(
            UserUpdate(password=payload.password),
            user,
            safe=False,
            request=None,
        )
    except InvalidPasswordException as e:
        reason = getattr(e, "reason", None)
        raise HTTPException(status_code=422, detail=reason or "Invalid password")
    return UserRead.model_validate(updated)


class AdminUserUpdate(BaseModel):
    is_superuser: bool | None = None
    is_active: bool | None = None
    is_verified: bool | None = None
    logistics_location_id: uuid.UUID | None = None
    department: str | None = Field(default=None, max_length=128)
    full_name: str | None = Field(default=None, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    extension_number: str | None = Field(default=None, max_length=32)


@router.patch("/{user_id}", response_model=UserRead)
async def admin_update_user(
    user_id: uuid.UUID,
    payload: AdminUserUpdate,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_superuser),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.is_superuser is not None:
        user.is_superuser = payload.is_superuser  # type: ignore[attr-defined]
    if payload.is_active is not None:
        user.is_active = payload.is_active  # type: ignore[attr-defined]
    if payload.is_verified is not None:
        user.is_verified = payload.is_verified  # type: ignore[attr-defined]
    # 담당 출고지(물류지). 명시적으로 null을 보내면 해제되도록 fields_set 기반으로 반영한다.
    if "logistics_location_id" in payload.model_fields_set:
        user.logistics_location_id = payload.logistics_location_id  # type: ignore[attr-defined]
    if "department" in payload.model_fields_set:
        user.department = _norm_optional_str(payload.department)  # type: ignore[attr-defined]
    if "full_name" in payload.model_fields_set:
        user.full_name = _norm_optional_str(payload.full_name)  # type: ignore[attr-defined]
    if "phone" in payload.model_fields_set:
        user.phone = _norm_optional_str(payload.phone)  # type: ignore[attr-defined]
    if "extension_number" in payload.model_fields_set:
        user.extension_number = _norm_optional_str(payload.extension_number)  # type: ignore[attr-defined]

    session.add(user)
    await session.commit()
    await session.refresh(user)

    return UserRead.model_validate(user)

