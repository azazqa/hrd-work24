from datetime import datetime

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
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


class ViewBase(DeclarativeBase):
    """DB 뷰/머티리얼라이즈드 뷰 매핑용 (공통 감사 컬럼 없음)."""

    pass



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


class OwnedCourse(Base):
    """보유 과정 마스터."""

    __tablename__ = "owned_courses"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    dev_year = Column(Integer, nullable=True, index=True)
    dev_round = Column(String(50), nullable=True)
    review_round = Column(String(50), nullable=True)
    division = Column(String(100), nullable=True, index=True)
    ncs_dev_category = Column(String(100), nullable=True)
    course_name = Column(String(500), nullable=False, index=True)
    session_count = Column(Integer, nullable=True)
    eval_training_volume = Column(String(100), nullable=True)
    result = Column(String(100), nullable=True)
    grade_initial = Column(String(50), nullable=True)
    grade_23 = Column(String(50), nullable=True)
    ncs_applied = Column(String(100), nullable=True)
    ncs_approved = Column(String(100), nullable=True)
    is_active = Column(
        Boolean, nullable=False, default=True, server_default="true", index=True
    )


class CourseExportJob(Base):
    """과정 내보내기 비동기 작업 (파일 생성 요청·상태·결과)."""

    __tablename__ = "course_export_job"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    status = Column(
        String(20), nullable=False, default="PENDING", server_default="PENDING"
    )
    memo = Column(Text, nullable=True)
    conditions_summary = Column(Text, nullable=True)
    params = Column(JSONB, nullable=True)
    row_count = Column(Integer, nullable=True)
    file_path = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    error_message = Column(Text, nullable=True)
    queue_id = Column(BigInteger, nullable=True)
    requested_by_user_id = Column(
        UUID(as_uuid=True), ForeignKey("user.id"), nullable=True, index=True
    )

    __table_args__ = (
        Index("ix_course_export_job_status_created", "status", "created_at"),
    )


class Settlement(Base):
    """정산 데이터 (엑셀 년도별 교체 import)."""

    __tablename__ = "settlements"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    purchase_ym = Column(String(6), nullable=False)
    purchase_year = Column(Integer, nullable=False, index=True)
    sales_ym = Column(String(6), nullable=True)
    client_name = Column(String(255), nullable=False, index=True)
    course_name = Column(String(500), nullable=False, index=True)
    education_period = Column(String(100), nullable=True)
    education_period_date = Column(Date, nullable=True)
    headcount = Column(Integer, nullable=True)
    base_tuition = Column(Numeric(18, 4), nullable=True)
    textbook_fee = Column(Numeric(18, 4), nullable=True)
    exclude_amount = Column(Numeric(18, 4), nullable=True)
    share_rate = Column(Numeric(10, 6), nullable=True)
    net_sales = Column(Numeric(18, 4), nullable=True)
    settlement_rate = Column(Numeric(10, 6), nullable=True)
    settlement_amount = Column(Numeric(18, 4), nullable=True)
    note = Column(Text, nullable=True)
    sales_rep = Column(String(100), nullable=True)


class SettlementConsolidated(ViewBase):
    """정산 정리 MV.

    식별키 + 기준수강료·교재비·정산제외금·배분율·정산율·비고·영업대표가 같으면
    인원·순매출액·정산액을 SUM. 비고가 다르면 별도 행.
    """

    __tablename__ = "settlements_consolidated"

    purchase_ym = Column(String(6), primary_key=True)
    purchase_year = Column(Integer, primary_key=True)
    sales_ym = Column(String(6), primary_key=True, nullable=True)
    client_name = Column(String(255), primary_key=True)
    course_name = Column(String(500), primary_key=True)
    education_period = Column(String(100), primary_key=True, nullable=True)
    education_period_date = Column(Date, primary_key=True, nullable=True)
    headcount = Column(Integer, nullable=True)
    base_tuition = Column(Numeric(18, 4), primary_key=True, nullable=True)
    textbook_fee = Column(Numeric(18, 4), primary_key=True, nullable=True)
    exclude_amount = Column(Numeric(18, 4), primary_key=True, nullable=True)
    share_rate = Column(Numeric(10, 6), primary_key=True, nullable=True)
    net_sales = Column(Numeric(18, 4), nullable=True)
    settlement_rate = Column(Numeric(10, 6), primary_key=True, nullable=True)
    settlement_amount = Column(Numeric(18, 4), nullable=True)
    note = Column(Text, primary_key=True, nullable=True)
    sales_rep = Column(String(100), primary_key=True, nullable=True)


class SeparateSettlement(Base):
    """별도 정산 (임대 과정 등, 엑셀 전체 교체 import)."""

    __tablename__ = "separate_settlements"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    invoice_deadline_date = Column(Date, nullable=True, index=True)
    invoice_deadline_year = Column(Integer, nullable=True, index=True)
    sales_rep = Column(String(100), nullable=True)
    category = Column(String(100), nullable=True)
    client_name = Column(String(255), nullable=False, index=True)
    business_detail = Column(String(500), nullable=True)
    course_name = Column(String(500), nullable=False, index=True)
    base_revenue = Column(Numeric(18, 4), nullable=True)
    settlement_rate = Column(Numeric(10, 6), nullable=True)
    settlement_rate_raw = Column(String(100), nullable=True)
    calculated_amount = Column(Numeric(18, 4), nullable=True)
    contract_period = Column(String(100), nullable=True)
    deduction_amount = Column(Numeric(18, 4), nullable=True)
    final_amount = Column(Numeric(18, 4), nullable=True)
    invoice_item = Column(String(500), nullable=True)
    supply_amount = Column(Numeric(18, 4), nullable=True)
    tax_amount = Column(Numeric(18, 4), nullable=True)
    total_amount = Column(Numeric(18, 4), nullable=True)
    invoice_issuer = Column(String(255), nullable=True)


class ClientNameMapping(Base):
    """훈련기관명(Work24 instNm) → 정산 고객사명 맵핑."""

    __tablename__ = "client_name_mappings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    institution_name = Column(String(255), nullable=False, unique=True, index=True)
    client_name = Column(String(255), nullable=False, index=True)


class OwnedCourseOpening(Base):
    """개설된 보유과정 캐시 (ES 추출 스냅샷, 연도별 교체)."""

    __tablename__ = "owned_course_openings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    year = Column(Integer, nullable=False, index=True)
    institution_name = Column(String(255), nullable=True)
    course_name = Column(String(500), nullable=True)
    tra_start_date = Column(Date, nullable=True)
    tra_end_date = Column(Date, nullable=True)
    reg_course_man = Column(String(50), nullable=True)
    extracted_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_owned_course_openings_year_tra_start", "year", "tra_start_date"),
    )


class OwnedSettlementCompareResultRow(Base):
    """보유과정 정산 비교 결과 스냅샷 (연도별 delete&insert)."""

    __tablename__ = "owned_settlement_compare_results"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    year = Column(Integer, nullable=False, index=True)
    status = Column(String(20), nullable=False, index=True)
    institution_name = Column(String(255), nullable=True)
    client_name = Column(String(255), nullable=True)
    course_name = Column(String(500), nullable=True)
    tra_start_date = Column(Date, nullable=True)
    tra_end_date = Column(Date, nullable=True)
    reg_course_man = Column(String(50), nullable=True)
    compared_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_owned_settlement_compare_results_year_status", "year", "status"),
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
