from __future__ import annotations

import logging

from elasticsearch import NotFoundError
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict

from app.config import settings
from app.es import get_es
from app.users import current_active_user

logger = logging.getLogger(__name__)

router = APIRouter()


class CourseSearchHit(BaseModel):
    model_config = ConfigDict(extra="allow")

    trpr_id: str | None = None
    trng_crse_nm: str | None = None
    inst_nm: str | None = None
    score: float


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
