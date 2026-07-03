from __future__ import annotations

import asyncio
import logging
from typing import Any

from elasticsearch import AsyncElasticsearch
from sqlalchemy.engine import Engine

from app.config import settings
from app.work24 import (
    ensure_course_index,
    fetch_courses,
    index_courses,
    iter_month_ranges,
)
from scheduler.jobs._job_base import JobResult, run_job

logger = logging.getLogger(__name__)

JOB_KEY = "legacy_course_index"
LOCK_KEY = "legacy_course_index"


async def _run_legacy_index(payload: dict[str, Any]) -> dict[str, Any]:
    month = payload.get("month", "")
    queue_id = payload.get("queue_id")

    if not month:
        raise ValueError("payload.month is required")

    month_ranges = iter_month_ranges(month, month)
    st, en = month_ranges[0]
    month_label = month

    es = AsyncElasticsearch(hosts=[settings.ELASTICSEARCH_URL])
    try:
        await ensure_course_index(es)

        page_size = settings.WORK24_API_PAGE_SIZE
        page = 1
        month_fetched = 0
        month_indexed = 0

        while True:
            ctx: dict[str, Any] = {
                "job_key": JOB_KEY,
                "month": month_label,
                "page_num": page,
            }
            if queue_id is not None:
                ctx["queue_id"] = queue_id

            items, total = await fetch_courses(
                source="legacy_course_index",
                context=ctx,
                srchTraStDt=st,
                srchTraEndDt=en,
                pageNum=str(page),
                pageSize=str(page_size),
            )
            indexed = await index_courses(es, items)
            month_fetched += len(items)
            month_indexed += indexed

            logger.info(
                "[LEGACY_INDEX] month=%s page=%d items=%d total=%d",
                month_label,
                page,
                len(items),
                total,
            )

            if not items or len(items) < page_size:
                break
            page += 1
    finally:
        await es.close()

    logger.info(
        "[LEGACY_INDEX] month=%s fetched=%d indexed=%d pages=%d",
        month_label,
        month_fetched,
        month_indexed,
        page,
    )

    return {
        "month": month_label,
        "fetched": month_fetched,
        "indexed": month_indexed,
        "pages": page,
    }


def _work_fn(payload: dict[str, Any]) -> dict[str, Any]:
    return asyncio.run(_run_legacy_index(payload))


def run_legacy_course_index(
    *, engine: Engine | None = None, payload: dict[str, Any] | None = None
) -> JobResult | None:
    pl = payload or {}
    return run_job(
        job_key=JOB_KEY,
        lock_key=LOCK_KEY,
        work_fn=lambda: _work_fn(pl),
        engine=engine,
    )
