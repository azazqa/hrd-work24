from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime
from typing import Any

from elasticsearch import AsyncElasticsearch, NotFoundError
from fastapi import HTTPException
from sqlalchemy.engine import Engine

from app.config import settings
from app.database import async_session_maker
from app.models import CourseExportJob
from app.routes.courses import (
    _export_body_from_params,
    _load_active_owned_names,
    _write_courses_xlsx,
    _write_empty_courses_xlsx,
)
from scheduler.jobs._job_base import JobResult, run_job

logger = logging.getLogger(__name__)

JOB_KEY = "course_export"
LOCK_KEY = "course_export"


def _export_path(export_id: int) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    os.makedirs(settings.EXPORT_DIR, exist_ok=True)
    return os.path.join(settings.EXPORT_DIR, f"course_export_{export_id}_{ts}.xlsx")


async def _run_export(export_id: int) -> dict[str, Any]:
    async with async_session_maker() as session:
        job = await session.get(CourseExportJob, export_id)
        if job is None or job.is_delete:
            raise ValueError(f"course_export_job not found: {export_id}")

        job.status = "PROCESSING"
        await session.commit()

        params = dict(job.params or {})

    names: list[str] | None = None
    if params.get("owned_year") is not None:
        async with async_session_maker() as session:
            names = await _load_active_owned_names(session)

    body = _export_body_from_params(params, names)
    path = _export_path(export_id)

    es = AsyncElasticsearch(
        hosts=[settings.ELASTICSEARCH_URL],
        request_timeout=settings.ES_REQUEST_TIMEOUT,
    )
    try:
        try:
            if body is None:
                row_count = await _write_empty_courses_xlsx(path)
            else:
                row_count = await _write_courses_xlsx(es, body, path)
        except NotFoundError:
            row_count = await _write_empty_courses_xlsx(path)
    except HTTPException as exc:
        _safe_unlink(path)
        raise ValueError(str(exc.detail)) from exc
    except Exception:
        _safe_unlink(path)
        raise
    finally:
        await es.close()

    file_size = os.path.getsize(path) if os.path.exists(path) else None
    file_name = f"courses_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    async with async_session_maker() as session:
        job = await session.get(CourseExportJob, export_id)
        if job is None or job.is_delete:
            _safe_unlink(path)
            raise ValueError(f"course_export_job removed during export: {export_id}")
        job.status = "SUCCEEDED"
        job.row_count = row_count
        job.file_path = path
        job.file_name = file_name
        job.file_size = file_size
        job.error_message = None
        await session.commit()

    logger.info(
        "[COURSE_EXPORT] export_id=%s rows=%d file=%s", export_id, row_count, path
    )
    return {"export_id": export_id, "row_count": row_count, "file_path": path}


def _safe_unlink(path: str) -> None:
    try:
        if os.path.exists(path):
            os.unlink(path)
    except OSError:
        logger.exception("[COURSE_EXPORT] failed to remove file %s", path)


async def _mark_failed(export_id: int, message: str) -> None:
    async with async_session_maker() as session:
        job = await session.get(CourseExportJob, export_id)
        if job is None or job.is_delete:
            return
        job.status = "FAILED"
        job.error_message = message[:10000]
        await session.commit()


def _work_fn(payload: dict[str, Any]) -> dict[str, Any]:
    export_id = payload.get("export_id")
    if export_id is None:
        raise ValueError("payload.export_id is required")
    export_id = int(export_id)
    try:
        return asyncio.run(_run_export(export_id))
    except Exception as exc:
        asyncio.run(_mark_failed(export_id, str(exc)))
        raise


def run_course_export(
    *, engine: Engine | None = None, payload: dict[str, Any] | None = None
) -> JobResult | None:
    pl = payload or {}
    return run_job(
        job_key=JOB_KEY,
        lock_key=LOCK_KEY,
        work_fn=lambda: _work_fn(pl),
        engine=engine,
    )
