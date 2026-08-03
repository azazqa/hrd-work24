from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from elasticsearch import AsyncElasticsearch
from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.engine import Engine
from sqlalchemy.orm.attributes import flag_modified

from app.config import settings
from app.database import async_session_maker
from app.models import OwnedCourseOpening, SchedulerJobQueue
from app.routes.courses import (
    _build_owned_scroll_body,
    _load_active_owned_names,
)
from app.routes.settlements import (
    _normalize_compare_date,
    _scroll_owned_courses,
)
from scheduler.jobs._job_base import JobResult, run_job

logger = logging.getLogger(__name__)

JOB_KEY = "owned_course_opening_extract"
LOCK_KEY = "owned_course_opening_extract"


async def _run_extract(payload: dict[str, Any]) -> dict[str, Any]:
    year = payload.get("year")
    if year is None:
        raise ValueError("payload.year is required")
    year = int(year)
    min_score = float(payload.get("min_score") or 0)
    queue_id = payload.get("queue_id")

    async with async_session_maker() as session:
        names = await _load_active_owned_names(session)

    owned_rows: list[dict[str, Any]] = []
    if names:
        body = _build_owned_scroll_body(names, year, min_score, False)
        es = AsyncElasticsearch(
            hosts=[settings.ELASTICSEARCH_URL],
            request_timeout=settings.ES_REQUEST_TIMEOUT,
        )
        try:
            owned_rows = await _scroll_owned_courses(es, body)
        except HTTPException as exc:
            raise ValueError(str(exc.detail)) from exc
        finally:
            await es.close()

    extracted_at = datetime.now(timezone.utc)

    async with async_session_maker() as session:
        await session.execute(
            update(OwnedCourseOpening)
            .where(
                OwnedCourseOpening.is_delete == False,  # noqa: E712
                OwnedCourseOpening.year == year,
            )
            .values(is_delete=True)
        )

        to_insert: list[OwnedCourseOpening] = []
        for row in owned_rows:
            to_insert.append(
                OwnedCourseOpening(
                    year=year,
                    institution_name=(row.get("institution_name") or None),
                    course_name=(row.get("course_name") or None),
                    tra_start_date=_normalize_compare_date(row.get("tra_start_date")),
                    tra_end_date=_normalize_compare_date(row.get("tra_end_date")),
                    reg_course_man=(
                        str(row["reg_course_man"])[:50]
                        if row.get("reg_course_man") is not None
                        else None
                    ),
                    extracted_at=extracted_at,
                )
            )
        if to_insert:
            session.add_all(to_insert)

        if queue_id is not None:
            q = await session.get(SchedulerJobQueue, int(queue_id))
            if q is not None and not q.is_delete:
                pl = dict(q.payload or {})
                pl["year"] = year
                pl["min_score"] = min_score
                pl["row_count"] = len(to_insert)
                pl["extracted_at"] = extracted_at.isoformat()
                q.payload = pl
                flag_modified(q, "payload")

        await session.commit()

    logger.info(
        "[OWNED_OPENING_EXTRACT] year=%s rows=%d queue_id=%s",
        year,
        len(owned_rows),
        queue_id,
    )
    return {
        "year": year,
        "row_count": len(owned_rows),
        "extracted_at": extracted_at.isoformat(),
        "queue_id": queue_id,
    }


def _work_fn(payload: dict[str, Any]) -> dict[str, Any]:
    return asyncio.run(_run_extract(dict(payload or {})))


def run_owned_course_opening_extract(
    *, engine: Engine | None = None, payload: dict[str, Any] | None = None
) -> JobResult | None:
    pl = payload or {}
    return run_job(
        job_key=JOB_KEY,
        lock_key=LOCK_KEY,
        work_fn=lambda: _work_fn(pl),
        engine=engine,
    )
