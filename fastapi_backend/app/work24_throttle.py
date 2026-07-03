from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Iterator

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Work24ApiLog

logger = logging.getLogger(__name__)

WORK24_API_LOCK_ID = 20260202


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


async def _seconds_since_last_request_async(session: AsyncSession) -> float | None:
    result = await session.execute(select(func.max(Work24ApiLog.requested_at)))
    last = result.scalar()
    if last is None:
        return None
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return (_utcnow() - last).total_seconds()


def _seconds_since_last_request_sync(session: Session) -> float | None:
    result = session.execute(select(func.max(Work24ApiLog.requested_at)))
    last = result.scalar()
    if last is None:
        return None
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return (_utcnow() - last).total_seconds()


async def _wait_delay_async(session: AsyncSession) -> None:
    elapsed = await _seconds_since_last_request_async(session)
    if elapsed is None:
        return
    wait = settings.WORK24_API_DELAY_SECONDS - elapsed
    if wait > 0:
        logger.info("[WORK24] waiting %.1fs before next API call", wait)
        await asyncio.sleep(wait)


def _wait_delay_sync(session: Session) -> None:
    import time

    elapsed = _seconds_since_last_request_sync(session)
    if elapsed is None:
        return
    wait = settings.WORK24_API_DELAY_SECONDS - elapsed
    if wait > 0:
        logger.info("[WORK24] waiting %.1fs before next API call", wait)
        time.sleep(wait)


@asynccontextmanager
async def work24_api_guard_async(session: AsyncSession) -> AsyncIterator[None]:
    await session.execute(
        text("SELECT pg_advisory_lock(:lock_id)"), {"lock_id": WORK24_API_LOCK_ID}
    )
    try:
        await _wait_delay_async(session)
        yield
    finally:
        await session.execute(
            text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": WORK24_API_LOCK_ID}
        )
        await session.commit()


@contextmanager
def work24_api_guard_sync(session: Session) -> Iterator[None]:
    session.execute(
        text("SELECT pg_advisory_lock(:lock_id)"), {"lock_id": WORK24_API_LOCK_ID}
    )
    try:
        _wait_delay_sync(session)
        yield
    finally:
        session.execute(
            text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": WORK24_API_LOCK_ID}
        )
        session.commit()


async def save_work24_api_log_async(
    session: AsyncSession,
    *,
    method: str,
    url: str,
    request_headers: dict[str, Any],
    response_status: int | None,
    response_headers: dict[str, Any],
    context: dict[str, Any] | None = None,
) -> None:
    row = Work24ApiLog(
        requested_at=_utcnow(),
        method=method,
        url=url,
        request_headers=request_headers,
        response_status=response_status,
        response_headers=response_headers,
        context=context,
    )
    session.add(row)
    await session.commit()


def save_work24_api_log_sync(
    session: Session,
    *,
    method: str,
    url: str,
    request_headers: dict[str, Any],
    response_status: int | None,
    response_headers: dict[str, Any],
    context: dict[str, Any] | None = None,
) -> None:
    row = Work24ApiLog(
        requested_at=_utcnow(),
        method=method,
        url=url,
        request_headers=request_headers,
        response_status=response_status,
        response_headers=response_headers,
        context=context,
    )
    session.add(row)
    session.commit()
