from __future__ import annotations

import logging

from sqlalchemy.engine import Engine

from scheduler.jobs._job_base import JobResult, run_job

logger = logging.getLogger(__name__)

JOB_KEY = "course_index_refresh"
LOCK_KEY = "course_index_refresh"


def _work_fn() -> dict:
    """
    고용24 Open API → Elasticsearch 색인 파이프라인.

    TODO(work24): work24.md의 index_all_courses 구현
      - call_api(page, size) 로 과정 목록 수집
      - helpers.bulk(es, actions) 로 ES upsert
    """
    logger.info("[COURSE_INDEX] placeholder run — no external API call yet")
    return {"status": "placeholder", "indexed": 0}


def refresh_course_index(*, engine: Engine | None = None) -> JobResult | None:
    return run_job(
        job_key=JOB_KEY,
        lock_key=LOCK_KEY,
        work_fn=_work_fn,
        engine=engine,
    )


def _main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    refresh_course_index()


if __name__ == "__main__":
    _main()
