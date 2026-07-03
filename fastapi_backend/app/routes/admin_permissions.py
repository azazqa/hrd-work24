from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.models import User, UserPermission
from app.permissions import PERMISSION_RESOURCES
from app.users import current_superuser

router = APIRouter()


class PermissionItem(BaseModel):
    resource: str
    can_create: bool = False
    can_read: bool = False
    can_update: bool = False
    can_delete: bool = False


class PermissionListResponse(BaseModel):
    user_id: uuid.UUID
    items: list[PermissionItem]


@router.get("/resources")
async def list_permission_resources(_: User = Depends(current_superuser)):
    return {
        "items": [
            {"resource": r, "label": r}
            for r in PERMISSION_RESOURCES
        ]
    }


@router.get("", response_model=PermissionListResponse)
async def get_user_permissions(
    user_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_superuser),
):
    res = await db.execute(select(UserPermission).where(UserPermission.user_id == user_id))
    rows = res.scalars().all()
    by_resource = {r.resource: r for r in rows}

    items: list[PermissionItem] = []
    for resource in PERMISSION_RESOURCES:
        r = by_resource.get(resource)
        items.append(
            PermissionItem(
                resource=resource,
                can_create=bool(getattr(r, "can_create", False)),
                can_read=bool(getattr(r, "can_read", False)),
                can_update=bool(getattr(r, "can_update", False)),
                can_delete=bool(getattr(r, "can_delete", False)),
            )
        )
    return PermissionListResponse(user_id=user_id, items=items)


class PermissionSaveRequest(BaseModel):
    items: list[PermissionItem]


@router.put("", response_model=PermissionListResponse)
async def save_user_permissions(
    payload: PermissionSaveRequest,
    user_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_superuser),
):
    # Ensure user exists
    user_obj = await db.get(User, user_id)
    if not user_obj:
        raise HTTPException(status_code=404, detail="User not found")

    # Replace all permissions for the user (simple + deterministic)
    await db.execute(delete(UserPermission).where(UserPermission.user_id == user_id))

    for item in payload.items:
        if item.resource not in PERMISSION_RESOURCES:
            raise HTTPException(status_code=422, detail=f"Unknown resource: {item.resource}")
        db.add(
            UserPermission(
                user_id=user_id,
                resource=item.resource,
                can_create=item.can_create,
                can_read=item.can_read,
                can_update=item.can_update,
                can_delete=item.can_delete,
            )
        )

    await db.commit()
    # Return fresh view
    return await get_user_permissions(user_id=user_id, db=db, _=user_obj)  # type: ignore[arg-type]

