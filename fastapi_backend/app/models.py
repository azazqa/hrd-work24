from datetime import datetime

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    false,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    is_delete: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default=false()
    )


class User(SQLAlchemyBaseUserTableUUID, Base):
    pass


class SchedulerJobLog(Base):
    """
    스케줄러 잡 실행 이력 테이블.
    """

    __tablename__ = "scheduler_job_log"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    job_id = Column(String(100), nullable=False, index=True)
    started_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    finished_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, server_default="RUNNING")
    elapsed_sec = Column(Numeric(10, 2), nullable=True)
    error_message = Column(Text, nullable=True)
    detail = Column(JSONB, nullable=True)

    __table_args__ = (
        Index("ix_scheduler_job_log_job_id_started_at", "job_id", "started_at"),
    )


class SchedulerJob(Base):
    """
    스케줄러 잡 정의(메타데이터). runner는 기동 시 이 테이블을 읽어 CronTrigger를 구성한다.
    """

    __tablename__ = "scheduler_jobs"

    job_key = Column(String(100), primary_key=True)
    title = Column(String(255), nullable=False)
    enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    cron_hour = Column(Integer, nullable=False, default=3, server_default="3")
    cron_minute = Column(Integer, nullable=False, default=0, server_default="0")
    timezone = Column(String(64), nullable=False, default="Asia/Seoul", server_default="Asia/Seoul")
    description = Column(Text, nullable=True)


class SchedulerJobQueue(Base):
    """
    관리자가 즉시 실행·중단 복구 등을 요청할 때 적재되는 큐.
    """

    __tablename__ = "scheduler_job_queue"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    job_key = Column(String(100), nullable=False, index=True)
    action = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="PENDING", server_default="PENDING")
    payload = Column(JSONB, nullable=True)
    requested_by_user_id = Column(
        UUID(as_uuid=True), ForeignKey("user.id"), nullable=True, index=True
    )
    error_message = Column(Text, nullable=True)
    related_log_id = Column(BigInteger, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_scheduler_job_queue_status_created", "status", "created_at"),
    )


class Work24ApiLog(Base):
    """Work24 Open API 호출 이력 (headers only)."""

    __tablename__ = "work24_api_log"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    requested_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    method = Column(String(10), nullable=False)
    url = Column(Text, nullable=False)
    request_headers = Column(JSONB, nullable=True)
    response_status = Column(Integer, nullable=True)
    response_headers = Column(JSONB, nullable=True)
    context = Column(JSONB, nullable=True)
