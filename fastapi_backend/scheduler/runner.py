from __future__ import annotations

import logging
import signal
import sys

from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import SchedulerJobQueue
from scheduler.db import build_scheduler_engine
from scheduler.queue_processor import process_pending_queue

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("scheduler.runner")

scheduler = BlockingScheduler(timezone="Asia/Seoul")

DEFAULT_JOB_KEY = "course_index_refresh"


def _on_job_executed(event) -> None:
    logger.info("[RUNNER] job executed: %s", getattr(event, "job_id", "-"))


def _on_job_error(event) -> None:
    logger.error(
        "[RUNNER] job error: %s - %s",
        getattr(event, "job_id", "-"),
        getattr(event, "exception", None),
    )


def _shutdown(signum, frame) -> None:
    _ = (signum, frame)
    logger.info("[RUNNER] shutdown signal received; stopping scheduler...")
    scheduler.shutdown(wait=False)
    sys.exit(0)


def _load_job_schedule(engine, *, job_key: str) -> tuple[bool, int, int, str]:
    try:
        with engine.connect() as c:
            row = (
                c.execute(
                    text(
                        """
                    SELECT enabled, cron_hour, cron_minute, timezone
                      FROM scheduler_jobs
                     WHERE job_key = :job_key AND is_delete = false
                    """
                    ),
                    {"job_key": job_key},
                )
                .mappings()
                .first()
            )
    except Exception:
        logger.warning(
            "[RUNNER] could not read scheduler_jobs; using default 03:00 Asia/Seoul (enabled)",
            exc_info=True,
        )
        return True, 3, 0, "Asia/Seoul"
    if row is None:
        return True, 3, 0, "Asia/Seoul"
    tz = row.get("timezone") or "Asia/Seoul"
    return bool(row["enabled"]), int(row["cron_hour"]), int(row["cron_minute"]), str(tz)


def _tick_queue() -> None:
    try:
        process_pending_queue()
    except Exception:
        logger.exception("[RUNNER] job queue poll failed")


def _enqueue_scheduled_job(job_key: str, *, engine) -> None:
    with Session(engine) as session:
        row = SchedulerJobQueue(
            job_key=job_key,
            action="SCHEDULED",
            status="PENDING",
            requested_by_user_id=None,
            error_message=None,
            started_at=None,
            finished_at=None,
        )
        session.add(row)
        session.flush()
        queue_id = row.id
        session.commit()
    logger.info("[RUNNER] scheduled enqueue: job_key=%s queue_id=%s", job_key, queue_id)


def main() -> None:
    scheduler.add_listener(_on_job_executed, EVENT_JOB_EXECUTED)
    scheduler.add_listener(_on_job_error, EVENT_JOB_ERROR)

    engine = build_scheduler_engine()
    enabled, cron_hour, cron_minute, tz = _load_job_schedule(engine, job_key=DEFAULT_JOB_KEY)

    if enabled:
        scheduler.add_job(
            _enqueue_scheduled_job,
            CronTrigger(hour=cron_hour, minute=cron_minute, timezone=tz),
            kwargs={"job_key": DEFAULT_JOB_KEY, "engine": engine},
            id=DEFAULT_JOB_KEY,
            name="고용24 과정 수집 큐 등록",
            max_instances=1,
            misfire_grace_time=600,
            replace_existing=True,
        )
        logger.info(
            "[RUNNER] %s cron: %02d:%02d %s",
            DEFAULT_JOB_KEY,
            cron_hour,
            cron_minute,
            tz,
        )
    else:
        logger.info(
            "[RUNNER] %s cron disabled in scheduler_jobs; queue / manual enqueue only",
            DEFAULT_JOB_KEY,
        )

    scheduler.add_job(
        _tick_queue,
        IntervalTrigger(seconds=15),
        id="scheduler_job_queue_poll",
        name="DB job queue poll",
        max_instances=1,
        replace_existing=True,
    )

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    logger.info("[RUNNER] scheduler started (cron + queue poll)")
    scheduler.start()


if __name__ == "__main__":
    main()
