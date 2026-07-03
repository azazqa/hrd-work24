from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.exc import ProgrammingError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import User, get_async_session
from app.models import UserPermission
from app.permissions import PERMISSION_RESOURCES
from app.users import current_active_user

router = APIRouter()


@router.get("/me")
async def permissions_me(
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    # Superuser bypass: frontend menu/buttons should be fully accessible
    if getattr(user, "is_superuser", False):
        return {
            "items": [
                {
                    "resource": resource,
                    "can_create": True,
                    "can_read": True,
                    "can_update": True,
                    "can_delete": True,
                }
                for resource in PERMISSION_RESOURCES
            ]
        }

    try:
        result = await db.execute(
            select(UserPermission).where(UserPermission.user_id == user.id)
        )
        rows = result.scalars().all()
    except ProgrammingError:
        # Table might not exist yet on fresh deploy. Fail closed but don't 500.
        rows = []
    by_resource = {r.resource: r for r in rows}

    items: list[dict] = []
    for resource in PERMISSION_RESOURCES:
        r = by_resource.get(resource)
        items.append(
            {
                "resource": resource,
                "can_create": bool(getattr(r, "can_create", False)),
                "can_read": bool(getattr(r, "can_read", False)),
                "can_update": bool(getattr(r, "can_update", False)),
                "can_delete": bool(getattr(r, "can_delete", False)),
            }
        )
    return {"items": items}

