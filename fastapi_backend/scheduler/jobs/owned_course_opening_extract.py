from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timezone
from typing import Any

from elasticsearch import AsyncElasticsearch
from fastapi import HTTPException
from sqlalchemy import delete
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


def _parse_reg_course_man_int(value: Any) -> int | None:
    """숫자 문자열만 인원으로 인정. 그 외는 합산에서 제외."""
    if value is None:
        return None
    text = str(value).strip()
    if text.isdigit():
        return int(text)
    return None


def _aggregate_owned_opening_rows(
    owned_rows: list[dict[str, Any]],
    *,
    year: int,
    extracted_at: datetime,
) -> list[OwnedCourseOpening]:
    """훈련기관명·과정명·훈련시작일·훈련종료일이 같으면 인원을 합산한다.

    (고객사는 캐시에 없고 기관 맵핑으로 결정되므로 합산 키에 포함하지 않는다.)
    """
    # key -> (stored fields, numeric headcount sum or None if no numeric yet)
    groups: dict[
        tuple[str | None, str | None, date | None, date | None],
        tuple[str | None, str | None, date | None, date | None, int | None],
    ] = {}

    for row in owned_rows:
        institution_name = row.get("institution_name") or None
        course_name = row.get("course_name") or None
        tra_start_date = _normalize_compare_date(row.get("tra_start_date"))
        tra_end_date = _normalize_compare_date(row.get("tra_end_date"))
        key = (institution_name, course_name, tra_start_date, tra_end_date)
        man = _parse_reg_course_man_int(row.get("reg_course_man"))

        if key not in groups:
            groups[key] = (
                institution_name,
                course_name,
                tra_start_date,
                tra_end_date,
                man,
            )
            continue

        _, _, _, _, prev_sum = groups[key]
        if man is None:
            continue
        groups[key] = (
            institution_name,
            course_name,
            tra_start_date,
            tra_end_date,
            man if prev_sum is None else prev_sum + man,
        )

    result: list[OwnedCourseOpening] = []
    for (
        institution_name,
        course_name,
        tra_start_date,
        tra_end_date,
        man_sum,
    ) in groups.values():
        result.append(
            OwnedCourseOpening(
                year=year,
                institution_name=institution_name,
                course_name=course_name,
                tra_start_date=tra_start_date,
                tra_end_date=tra_end_date,
                reg_course_man=str(man_sum)[:50] if man_sum is not None else None,
                extracted_at=extracted_at,
            )
        )
    return result


async def _run_extract(payload: dict[str, Any]) -> dict[str, Any]:
    year = payload.get("year")
    if year is None:
        raise ValueError("payload.year is required")
    year = int(year)
    min_score = float(payload.get("min_score") or 0)
    queue_id = payload.get("queue_id")

    async with async_session_maker() as session:
        names = await _load_active_owned_names(session, usable_in_year=year)

    owned_rows: list[dict[str, Any]] = []
    if names:
        body = _build_owned_scroll_body(
            names, year, min_score, has_reg_course_man=True
        )
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
    to_insert = _aggregate_owned_opening_rows(
        owned_rows, year=year, extracted_at=extracted_at
    )

    async with async_session_maker() as session:
        # 해당 연도 캐시를 전부 삭제 후 추출 결과로 교체한다.
        await session.execute(
            delete(OwnedCourseOpening).where(OwnedCourseOpening.year == year)
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
                pl["source_row_count"] = len(owned_rows)
                pl["extracted_at"] = extracted_at.isoformat()
                q.payload = pl
                flag_modified(q, "payload")

        await session.commit()

    logger.info(
        "[OWNED_OPENING_EXTRACT] year=%s source=%d stored=%d queue_id=%s",
        year,
        len(owned_rows),
        len(to_insert),
        queue_id,
    )
    return {
        "year": year,
        "row_count": len(to_insert),
        "source_row_count": len(owned_rows),
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
