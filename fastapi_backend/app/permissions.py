from __future__ import annotations

from collections.abc import Callable
from typing import Literal

from fastapi import Depends, HTTPException
from sqlalchemy.exc import ProgrammingError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.models import User, UserPermission
from app.users import current_active_user

PermissionAction = Literal["create", "read", "update", "delete"]


PERMISSION_RESOURCES: list[str] = [
    "dashboard",
    "channels",
    "couriers",
    "categories",
    "products",
    "product_alias_dicts",
    "receivers",
    "orders",
    "shipments",
    "stocks",
    "stocks_histories",
    "logistics_locations",
    "notices",
    "settlements",
    "admin_users",
    "admin_permissions",
]


def _has_permission(row: UserPermission | None, action: PermissionAction) -> bool:
    if not row:
        return False
    return {
        "create": row.can_create,
        "read": row.can_read,
        "update": row.can_update,
        "delete": row.can_delete,
    }[action]


def require_permission(resource: str, action: PermissionAction) -> Callable[..., User]:
    async def _dep(
        user: User = Depends(current_active_user),
        db: AsyncSession = Depends(get_async_session),
    ) -> User:
        # superuser always allowed
        if getattr(user, "is_superuser", False):
            return user

        if resource not in PERMISSION_RESOURCES:
            # Fail closed if misconfigured
            raise HTTPException(status_code=404, detail="Not found")

        try:
            result = await db.execute(
                select(UserPermission).where(
                    UserPermission.user_id == user.id,
                    UserPermission.resource == resource,
                )
            )
            row = result.scalars().first()
        except ProgrammingError:
            # Table might not exist yet on fresh deploy; fail closed (404).
            row = None

        if not _has_permission(row, action):
            # Requirement: hide menus + return 404 on direct access
            raise HTTPException(status_code=404, detail="Not found")

        return user

    return _dep

