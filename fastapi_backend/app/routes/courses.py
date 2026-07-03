from __future__ import annotations

import logging
import re

from elasticsearch import NotFoundError
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_async_session
from app.es import get_es
from app.models import SchedulerJob, SchedulerJobQueue, User
from app.users import current_active_user, current_superuser
from app.work24 import (
    INDEX_TEST_PARAMS,
    ensure_course_index,
    fetch_courses,
    index_courses,
    iter_month_ranges,
    parse_year_month,
)

logger = logging.getLogger(__name__)

router = APIRouter()

_DATE_RE = re.compile(r"^\d{8}$")


class CourseSearchHit(BaseModel):
    model_config = ConfigDict(extra="allow")

    trpr_id: str | None = None
    trng_crse_nm: str | None = None
    inst_nm: str | None = None
    score: float


class CourseIndexResult(BaseModel):
    fetched: int
    indexed: int
    total_count: int


class LegacyIndexRequest(BaseModel):
    start_month: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    end_month: str = Field(..., pattern=r"^\d{4}-\d{2}$")


class LegacyIndexResponse(BaseModel):
    queue_ids: list[int]
    start_month: str
    end_month: str
    month_count: int
    message: str


QUEUE_ACTION_RUN_NOW = "RUN_NOW"
QUEUE_STATUS_PENDING = "PENDING"


class CourseListItem(BaseModel):
    trainst_cst_id: str | None = None
    trpr_id: str | None = None
    trpr_degr: str | None = None
    course_name: str | None = None
    inst_name: str | None = None
    tra_start_date: str | None = None
    tra_end_date: str | None = None
    address: str | None = None
    tel_no: str | None = None
    title_link: str | None = None
    reg_course_man: str | None = None
    yard_man: str | None = None
    real_man: str | None = None


class CourseListResponse(BaseModel):
    items: list[CourseListItem]
    total_count: int
    page_num: int
    page_size: int


def _normalize_work24_date(value: str, field_name: str) -> str:
    normalized = value.strip().replace("-", "")
    if not _DATE_RE.match(normalized):
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be YYYYMMDD or YYYY-MM-DD",
        )
    return normalized


def _parse_course_from_es(source: dict) -> CourseListItem:
    return CourseListItem(
        trainst_cst_id=source.get("trainstCstId"),
        trpr_id=source.get("trprId"),
        trpr_degr=source.get("trprDegr"),
        course_name=source.get("trngCrseNm") or source.get("title"),
        inst_name=source.get("instNm") or source.get("subTitle"),
        tra_start_date=source.get("traStartDate"),
        tra_end_date=source.get("traEndDate"),
        address=source.get("address"),
        tel_no=source.get("telNo"),
        title_link=source.get("titleLink"),
        reg_course_man=source.get("regCourseMan"),
        yard_man=source.get("yardMan"),
        real_man=source.get("realMan"),
    )


def _to_es_date(value: str) -> str:
    """YYYYMMDD → YYYY-MM-DD (ES date range용)."""
    if len(value) == 8 and value.isdigit():
        return f"{value[:4]}-{value[4:6]}-{value[6:8]}"
    return value


def _build_list_body(
    st_dt: str,
    end_dt: str,
    organ_nm: str | None,
    process_nm: str | None,
    page_num: int,
    page_size: int,
) -> dict:
    must: list[dict] = [
        {
            "range": {
                "traStartDate": {
                    "gte": _to_es_date(st_dt),
                    "lte": _to_es_date(end_dt),
                }
            }
        }
    ]
    if organ_nm and organ_nm.strip():
        must.append(
            {"wildcard": {"instNm": {"value": f"*{organ_nm.strip()}*"}}}
        )
    if process_nm and process_nm.strip():
        keyword = process_nm.strip()
        must.append(
            {
                "bool": {
                    "should": [
                        {"match": {"trngCrseNm.nori": {"query": keyword}}},
                        {"wildcard": {"trngCrseNm.raw": {"value": f"*{keyword}*"}}},
                    ],
                    "minimum_should_match": 1,
                }
            }
        )

    return {
        "query": {"bool": {"must": must}},
        "from": (page_num - 1) * page_size,
        "size": page_size,
        "sort": [{"traStartDate": "asc"}, {"trprId": "asc"}],
        "track_total_hits": True,
    }


def _build_search_body(keyword: str, size: int) -> dict:
    return {
        "query": {
            "bool": {
                "should": [
                    {"term": {"trngCrseNm.raw": {"value": keyword, "boost": 5}}},
                    {"match": {"trngCrseNm.nori": {"query": keyword, "boost": 3}}},
                    {"match": {"trngCrseNm.ngram": {"query": keyword, "boost": 1}}},
                    {
                        "fuzzy": {
                            "trngCrseNm.raw": {
                                "value": keyword,
                                "fuzziness": "AUTO",
                                "boost": 2,
                            }
                        }
                    },
                ],
                "minimum_should_match": 1,
            }
        },
        "size": size,
    }


def _parse_hits(response: dict) -> list[CourseSearchHit]:
    hits: list[CourseSearchHit] = []
    for hit in response.get("hits", {}).get("hits", []):
        source = hit.get("_source", {})
        hits.append(
            CourseSearchHit(
                trpr_id=source.get("trprId"),
                trng_crse_nm=source.get("trngCrseNm"),
                inst_nm=source.get("instNm"),
                score=float(hit.get("_score", 0.0)),
            )
        )
    return hits


@router.get("", response_model=CourseListResponse)
async def list_courses(
    srch_tra_st_dt: str = Query(..., description="훈련시작일 From (YYYYMMDD 또는 YYYY-MM-DD)"),
    srch_tra_end_dt: str = Query(..., description="훈련시작일 To (YYYYMMDD 또는 YYYY-MM-DD)"),
    srch_tra_organ_nm: str | None = Query(None, description="훈련기관명"),
    srch_tra_process_nm: str | None = Query(None, description="훈련과정명"),
    page_num: int = Query(1, ge=1, le=1000),
    page_size: int = Query(20, ge=1, le=100),
    _user=Depends(current_active_user),
) -> CourseListResponse:
    st_dt = _normalize_work24_date(srch_tra_st_dt, "srch_tra_st_dt")
    end_dt = _normalize_work24_date(srch_tra_end_dt, "srch_tra_end_dt")
    organ_nm = srch_tra_organ_nm.strip() if srch_tra_organ_nm else None
    process_nm = srch_tra_process_nm.strip() if srch_tra_process_nm else None

    es = get_es()
    body = _build_list_body(st_dt, end_dt, organ_nm, process_nm, page_num, page_size)
    try:
        response = await es.search(index=settings.ES_COURSE_INDEX, body=body)
    except NotFoundError:
        return CourseListResponse(
            items=[],
            total_count=0,
            page_num=page_num,
            page_size=page_size,
        )
    except Exception:
        logger.exception("Elasticsearch list request failed")
        raise HTTPException(status_code=502, detail="Course search failed") from None

    hits = response.get("hits", {})
    total_raw = hits.get("total")
    if isinstance(total_raw, dict):
        total_count = int(total_raw.get("value", 0))
    else:
        total_count = int(total_raw or 0)

    items = [
        _parse_course_from_es(hit.get("_source", {}))
        for hit in hits.get("hits", [])
    ]
    return CourseListResponse(
        items=items,
        total_count=total_count,
        page_num=page_num,
        page_size=page_size,
    )


@router.get("/search", response_model=list[CourseSearchHit])
async def search_courses(
    keyword: str = Query(..., min_length=1),
    size: int = Query(5, ge=1, le=100),
    _user=Depends(current_active_user),
) -> list[CourseSearchHit]:
    es = get_es()
    body = _build_search_body(keyword, size)
    try:
        response = await es.search(index=settings.ES_COURSE_INDEX, body=body)
        return _parse_hits(response)
    except NotFoundError:
        return []
    except Exception:
        logger.exception("Elasticsearch search failed for keyword=%r", keyword)
        return []


@router.post("/index", response_model=CourseIndexResult)
async def index_courses_from_work24(
    _user=Depends(current_superuser),
) -> CourseIndexResult:
    es = get_es()
    items, total = await fetch_courses(
        source="courses_index",
        **INDEX_TEST_PARAMS,
    )
    await ensure_course_index(es)
    indexed = await index_courses(es, items)
    return CourseIndexResult(
        fetched=len(items),
        indexed=indexed,
        total_count=total,
    )


@router.post("/legacy-index", response_model=LegacyIndexResponse)
async def enqueue_legacy_course_index(
    body: LegacyIndexRequest,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_superuser),
) -> LegacyIndexResponse:
    try:
        parse_year_month(body.start_month, "start_month")
        parse_year_month(body.end_month, "end_month")
        month_ranges = iter_month_ranges(body.start_month, body.end_month)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    job = await session.get(SchedulerJob, "legacy_course_index")
    if job is None or job.is_delete:
        raise HTTPException(status_code=404, detail="legacy_course_index job not found")

    queues: list[SchedulerJobQueue] = []
    for st, _en in month_ranges:
        month_label = f"{st[:4]}-{st[4:6]}"
        q = SchedulerJobQueue(
            job_key="legacy_course_index",
            action=QUEUE_ACTION_RUN_NOW,
            status=QUEUE_STATUS_PENDING,
            requested_by_user_id=user.id,
            payload={"month": month_label},
        )
        session.add(q)
        queues.append(q)

    await session.commit()
    for q in queues:
        await session.refresh(q)
        q.payload = {**q.payload, "queue_id": q.id}
    await session.commit()

    month_count = len(queues)
    return LegacyIndexResponse(
        queue_ids=[q.id for q in queues],
        start_month=body.start_month,
        end_month=body.end_month,
        month_count=month_count,
        message=f"과거 과정 색인 작업 {month_count}건(월 단위)이 큐에 등록되었습니다.",
    )
