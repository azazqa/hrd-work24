from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_pagination.ext.sqlalchemy import apaginate
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.models import Work24ApiLog
from app.pagination import MAX_PAGE_SIZE, Page, Params
from app.users import current_superuser

router = APIRouter()


class Work24ApiLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    requested_at: datetime
    method: str
    url: str
    request_headers: dict | list | None
    response_status: int | None
    response_headers: dict | list | None
    context: dict | list | None


@router.get("", response_model=Page[Work24ApiLogRead])
async def list_work24_api_logs(
    page: int = 1,
    size: int = 20,
    source: str | None = Query(default=None),
    response_status: int | None = Query(default=None),
    month: str | None = Query(default=None, description="YYYY-MM"),
    session: AsyncSession = Depends(get_async_session),
    _user=Depends(current_superuser),
):
    if size < 1:
        raise HTTPException(status_code=400, detail="size must be >= 1")
    if size > MAX_PAGE_SIZE:
        raise HTTPException(status_code=400, detail=f"size must be <= {MAX_PAGE_SIZE}")

    params = Params(page=page, size=size)
    stmt = select(Work24ApiLog).where(Work24ApiLog.is_delete == False)  # noqa: E712
    if source and source.strip():
        stmt = stmt.where(Work24ApiLog.context["source"].as_string() == source.strip())
    if response_status is not None:
        stmt = stmt.where(Work24ApiLog.response_status == response_status)
    if month and month.strip():
        stmt = stmt.where(Work24ApiLog.context["month"].as_string() == month.strip())
    stmt = stmt.order_by(Work24ApiLog.requested_at.desc(), Work24ApiLog.id.desc())
    return await apaginate(session, stmt, params)
