from __future__ import annotations

import calendar
import logging
import re
from datetime import date
from typing import Any
from urllib.parse import urlencode

import aiohttp
from elasticsearch import AsyncElasticsearch
from elasticsearch.helpers import async_bulk

from app.config import settings
from app.database import async_session_maker
from app.work24_throttle import (
    save_work24_api_log_async,
    save_work24_api_log_sync,
    work24_api_guard_async,
    work24_api_guard_sync,
)
from scheduler.db import scheduler_session

logger = logging.getLogger(__name__)

BASE_PARAMS: dict[str, str] = {
    "returnType": "JSON",
    "outType": "1",
    "pageNum": "1",
    "pageSize": "10",
    "sort": "ASC",
    "sortCol": "2",
}

INDEX_TEST_PARAMS: dict[str, str] = {
    "remoteYn": "Y",
    "srchTraStDt": "20260101",
    "srchTraEndDt": "20260201",
    "srchTraProcessNm": "4차 산업혁명과 개인 맞춤형 사회복지 실천",
}

COURSE_INDEX_BODY: dict[str, Any] = {
    "settings": {
        "analysis": {
            "tokenizer": {
                "ngram_tokenizer": {
                    "type": "ngram",
                    "min_gram": 2,
                    "max_gram": 3,
                    "token_chars": ["letter", "digit"],
                }
            },
            "analyzer": {
                "korean_analyzer": {
                    "type": "custom",
                    "tokenizer": "nori_tokenizer",
                    "filter": ["nori_readingform", "lowercase"],
                },
                "ngram_analyzer": {
                    "type": "custom",
                    "tokenizer": "ngram_tokenizer",
                    "filter": ["lowercase"],
                },
            },
        }
    },
    "mappings": {
        "properties": {
            "trngCrseNm": {
                "type": "text",
                "fields": {
                    "nori": {"type": "text", "analyzer": "korean_analyzer"},
                    "ngram": {"type": "text", "analyzer": "ngram_analyzer"},
                    "raw": {"type": "keyword"},
                },
            },
            "trainstCstId": {
                "type": "text",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
            },
            "trprId": {
                "type": "text",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
            },
            "trprDegr": {
                "type": "text",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
            },
            "instNm": {"type": "keyword"},
            "traStartDate": {"type": "date"},
        }
    },
}

_YM_RE = re.compile(r"^\d{4}-\d{2}$")


def _mask_auth_key(value: str) -> str:
    return re.sub(r"(authKey=)[^&]+", r"\1***", value, flags=re.IGNORECASE)


def _mask_headers(headers: dict[str, Any]) -> dict[str, Any]:
    masked: dict[str, Any] = {}
    for key, val in headers.items():
        if key.lower() == "authorization" or "auth" in key.lower():
            masked[key] = "***"
        else:
            masked[key] = val
    return masked


def _build_request_url(params: dict[str, str]) -> str:
    safe_params = {k: ("***" if k.lower() == "authkey" else v) for k, v in params.items()}
    query = urlencode(safe_params)
    return f"{settings.WORK24_URL}?{query}"


def _course_doc_id(item: dict[str, Any]) -> str:
    trainst_cst_id = item.get("trainstCstId", "")
    trpr_id = item.get("trprId", "")
    trpr_degr = item.get("trprDegr", "")
    return f"{trainst_cst_id}_{trpr_id}_{trpr_degr}"


def _to_source(item: dict[str, Any]) -> dict[str, Any]:
    source = dict(item)
    source["trngCrseNm"] = item.get("title", "")
    source["instNm"] = item.get("subTitle", "")
    return source


def parse_year_month(value: str, field_name: str) -> tuple[int, int]:
    if not _YM_RE.match(value.strip()):
        raise ValueError(f"{field_name} must be YYYY-MM")
    year_s, month_s = value.strip().split("-")
    year, month = int(year_s), int(month_s)
    if month < 1 or month > 12:
        raise ValueError(f"{field_name} month must be 01-12")
    return year, month


def iter_month_ranges(start_ym: str, end_ym: str) -> list[tuple[str, str]]:
    sy, sm = parse_year_month(start_ym, "start_month")
    ey, em = parse_year_month(end_ym, "end_month")
    if (sy, sm) > (ey, em):
        raise ValueError("start_month must be <= end_month")

    ranges: list[tuple[str, str]] = []
    y, m = sy, sm
    while True:
        last_day = calendar.monthrange(y, m)[1]
        ranges.append(
            (date(y, m, 1).strftime("%Y%m%d"), date(y, m, last_day).strftime("%Y%m%d"))
        )
        if y == ey and m == em:
            break
        if m == 12:
            y += 1
            m = 1
        else:
            m += 1
    return ranges


async def _fetch_courses_raw(
    session: aiohttp.ClientSession, params: dict[str, str]
) -> tuple[list[dict[str, Any]], int, int, dict[str, str], dict[str, str]]:
    async with session.get(settings.WORK24_URL, params=params) as response:
        req_headers = _mask_headers(dict(response.request_info.headers))
        resp_headers = _mask_headers(dict(response.headers))
        status = response.status
        response.raise_for_status()
        data = await response.json()
    items = data.get("srchList") or []
    total_count = int(data.get("scn_cnt") or 0)
    return items, total_count, status, req_headers, resp_headers


def _fetch_courses_raw_sync(
    params: dict[str, str],
) -> tuple[list[dict[str, Any]], int, int, dict[str, str], dict[str, str]]:
    import requests

    response = requests.get(settings.WORK24_URL, params=params, timeout=60)
    req_headers = _mask_headers(dict(response.request.headers))
    resp_headers = _mask_headers(dict(response.headers))
    status = response.status_code
    response.raise_for_status()
    data = response.json()
    items = data.get("srchList") or []
    total_count = int(data.get("scn_cnt") or 0)
    return items, total_count, status, req_headers, resp_headers


async def fetch_courses(
    *,
    source: str,
    context: dict[str, Any] | None = None,
    **overrides: str,
) -> tuple[list[dict[str, Any]], int]:
    params = {**BASE_PARAMS, "authKey": settings.WORK24_API_KEY, **overrides}
    log_context = {"source": source, **(context or {})}
    url_for_log = _build_request_url(params)

    async with async_session_maker() as db:
        async with work24_api_guard_async(db):
            async with aiohttp.ClientSession() as http:
                items, total, status, req_h, resp_h = await _fetch_courses_raw(
                    http, params
                )
            await save_work24_api_log_async(
                db,
                method="GET",
                url=url_for_log,
                request_headers=req_h,
                response_status=status,
                response_headers=resp_h,
                context=log_context,
            )
    return items, total


def fetch_courses_sync(
    *,
    source: str,
    context: dict[str, Any] | None = None,
    **overrides: str,
) -> tuple[list[dict[str, Any]], int]:
    params = {**BASE_PARAMS, "authKey": settings.WORK24_API_KEY, **overrides}
    log_context = {"source": source, **(context or {})}
    url_for_log = _build_request_url(params)

    with scheduler_session() as db:
        with work24_api_guard_sync(db):
            items, total, status, req_h, resp_h = _fetch_courses_raw_sync(params)
            save_work24_api_log_sync(
                db,
                method="GET",
                url=url_for_log,
                request_headers=req_h,
                response_status=status,
                response_headers=resp_h,
                context=log_context,
            )
    return items, total


async def ensure_course_index(es: AsyncElasticsearch) -> None:
    index = settings.ES_COURSE_INDEX
    if await es.indices.exists(index=index):
        return
    await es.indices.create(index=index, body=COURSE_INDEX_BODY)
    logger.info("Created Elasticsearch index %s", index)


async def index_courses(es: AsyncElasticsearch, items: list[dict[str, Any]]) -> int:
    if not items:
        return 0

    actions = [
        {
            "_index": settings.ES_COURSE_INDEX,
            "_id": _course_doc_id(item),
            "_source": _to_source(item),
        }
        for item in items
    ]
    success, errors = await async_bulk(
        es, actions, raise_on_error=False, refresh="wait_for"
    )
    if errors:
        logger.warning("Bulk indexing had %d errors", len(errors))
    return success
