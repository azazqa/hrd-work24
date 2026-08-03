from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models import (
    ClientNameMapping,
    OwnedCourseOpening,
    SchedulerJobQueue,
    Settlement,
)


@pytest.mark.asyncio
async def test_compare_reads_cache_without_es(
    test_client, authenticated_user, db_session
):
    headers = authenticated_user["headers"]
    extracted_at = datetime.now(timezone.utc)
    db_session.add(
        ClientNameMapping(institution_name="기관A", client_name="고객A")
    )
    db_session.add(
        OwnedCourseOpening(
            year=2024,
            institution_name="기관A",
            course_name="과정매칭",
            tra_start_date=date(2024, 5, 1),
            tra_end_date=date(2024, 5, 10),
            reg_course_man="2",
            extracted_at=extracted_at,
        )
    )
    db_session.add(
        OwnedCourseOpening(
            year=2024,
            institution_name="기관A",
            course_name="과정미정산",
            tra_start_date=date(2024, 6, 1),
            extracted_at=extracted_at,
        )
    )
    db_session.add(
        Settlement(
            purchase_ym="202405",
            purchase_year=2024,
            client_name="고객A",
            course_name="과정매칭",
            education_period_date=date(2024, 5, 1),
        )
    )
    await db_session.commit()

    res = await test_client.get(
        "/settlements/compare-owned?year=2024",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["cache_hit"] is True
    assert body["matched"] == 1
    assert body["unsettled"] == 1
    assert body["unmapped"] == 0
    assert "items_matched" not in body

    matched = await test_client.get(
        "/settlements/compare-owned/items?year=2024&status=matched&page=1&size=50",
        headers=headers,
    )
    assert matched.status_code == 200, matched.text
    matched_body = matched.json()
    assert matched_body["total"] == 1
    assert matched_body["items"][0]["course_name"] == "과정매칭"
    assert matched_body["items"][0]["client_name"] == "고객A"
    assert matched_body["items"][0]["status"] == "matched"

    unsettled = await test_client.get(
        "/settlements/compare-owned/items?year=2024&status=unsettled&page=1&size=50",
        headers=headers,
    )
    assert unsettled.status_code == 200, unsettled.text
    unsettled_body = unsettled.json()
    assert unsettled_body["total"] == 1
    assert unsettled_body["items"][0]["course_name"] == "과정미정산"

    export_res = await test_client.get(
        "/settlements/compare-owned/export?year=2024",
        headers=headers,
    )
    assert export_res.status_code == 200, export_res.text
    assert (
        "spreadsheetml"
        in (export_res.headers.get("content-type") or "")
    )
    from io import BytesIO

    from openpyxl import load_workbook

    wb = load_workbook(BytesIO(export_res.content))
    assert wb.sheetnames == ["요약", "미정산", "맵핑없음", "정산됨"]
    assert wb["요약"]["B2"].value == 2024
    assert wb["요약"]["B3"].value == 2
    assert wb["미정산"].max_row == 2
    assert wb["미정산"]["C2"].value == "과정미정산"
    assert wb["정산됨"].max_row == 2
    assert wb["정산됨"]["C2"].value == "과정매칭"
    assert wb["맵핑없음"].max_row == 1  # header only
    wb.close()


@pytest.mark.asyncio
async def test_compare_auto_registers_identity_mapping(
    test_client, authenticated_user, db_session
):
    headers = authenticated_user["headers"]
    extracted_at = datetime.now(timezone.utc)
    db_session.add(
        OwnedCourseOpening(
            year=2024,
            institution_name="동일고객사",
            course_name="과정자동",
            tra_start_date=date(2024, 4, 1),
            extracted_at=extracted_at,
        )
    )
    db_session.add(
        Settlement(
            purchase_ym="202404",
            purchase_year=2024,
            client_name="동일고객사",
            course_name="과정자동",
            education_period_date=date(2024, 4, 1),
        )
    )
    await db_session.commit()

    before = (
        await db_session.execute(
            select(ClientNameMapping).where(
                ClientNameMapping.institution_name == "동일고객사"
            )
        )
    ).scalars().first()
    assert before is None

    res = await test_client.get(
        "/settlements/compare-owned?year=2024",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["matched"] == 1
    assert body["unmapped"] == 0

    mapping = (
        await db_session.execute(
            select(ClientNameMapping).where(
                ClientNameMapping.institution_name == "동일고객사",
                ClientNameMapping.is_delete == False,  # noqa: E712
            )
        )
    ).scalars().one()
    assert mapping.client_name == "동일고객사"


@pytest.mark.asyncio
async def test_compare_auto_registers_mapping_ignoring_internal_spaces(
    test_client, authenticated_user, db_session
):
    headers = authenticated_user["headers"]
    extracted_at = datetime.now(timezone.utc)
    db_session.add(
        OwnedCourseOpening(
            year=2024,
            institution_name="에이 비씨",
            course_name="과정공백",
            tra_start_date=date(2024, 7, 1),
            extracted_at=extracted_at,
        )
    )
    db_session.add(
        Settlement(
            purchase_ym="202407",
            purchase_year=2024,
            client_name="에이비씨",
            course_name="과정공백",
            education_period_date=date(2024, 7, 1),
        )
    )
    await db_session.commit()

    res = await test_client.get(
        "/settlements/compare-owned?year=2024",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["matched"] == 1
    assert body["unmapped"] == 0

    mapping = (
        await db_session.execute(
            select(ClientNameMapping).where(
                ClientNameMapping.institution_name == "에이 비씨",
                ClientNameMapping.is_delete == False,  # noqa: E712
            )
        )
    ).scalars().one()
    assert mapping.client_name == "에이비씨"


def test_normalize_name_for_mapping_removes_all_whitespace():
    from app.routes.settlements import _normalize_name_for_mapping

    assert _normalize_name_for_mapping(" 에이 비씨 ") == "에이비씨"
    assert _normalize_name_for_mapping("에이\t비씨\n") == "에이비씨"
    assert _normalize_name_for_mapping(None) == ""


@pytest.mark.asyncio
async def test_compare_does_not_revive_soft_deleted_mapping(
    test_client, authenticated_user, db_session
):
    headers = authenticated_user["headers"]
    extracted_at = datetime.now(timezone.utc)
    db_session.add(
        ClientNameMapping(
            institution_name="삭제된기관",
            client_name="삭제된기관",
            is_delete=True,
        )
    )
    db_session.add(
        OwnedCourseOpening(
            year=2024,
            institution_name="삭제된기관",
            course_name="과정",
            tra_start_date=date(2024, 1, 1),
            extracted_at=extracted_at,
        )
    )
    db_session.add(
        Settlement(
            purchase_ym="202401",
            purchase_year=2024,
            client_name="삭제된기관",
            course_name="과정",
            education_period_date=date(2024, 1, 1),
        )
    )
    await db_session.commit()

    res = await test_client.get(
        "/settlements/compare-owned?year=2024",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["unmapped"] == 1
    assert body["matched"] == 0

    mapping = (
        await db_session.execute(
            select(ClientNameMapping).where(
                ClientNameMapping.institution_name == "삭제된기관"
            )
        )
    ).scalars().one()
    assert mapping.is_delete is True


@pytest.mark.asyncio
async def test_refresh_enqueues_scheduler_queue(
    test_client, authenticated_user, db_session
):
    headers = authenticated_user["headers"]

    res = await test_client.post(
        "/settlements/compare-owned/refresh?year=2024",
        headers=headers,
    )
    assert res.status_code == 202, res.text
    body = res.json()
    assert body["year"] == 2024
    assert body["status"] == "PENDING"
    queue_id = body["id"]

    queue = await db_session.get(SchedulerJobQueue, queue_id)
    assert queue is not None
    assert queue.job_key == "owned_course_opening_extract"
    assert queue.payload["year"] == 2024
    assert queue.payload["queue_id"] == queue_id

    again = await test_client.post(
        "/settlements/compare-owned/refresh?year=2024",
        headers=headers,
    )
    assert again.status_code == 202
    assert again.json()["id"] == queue_id


@pytest.mark.asyncio
async def test_extract_replaces_year_cache(db_session):
    from scheduler.jobs.owned_course_opening_extract import _run_extract

    old_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
    db_session.add(
        OwnedCourseOpening(
            year=2024,
            institution_name="구기관",
            course_name="구과정",
            tra_start_date=date(2024, 1, 1),
            extracted_at=old_at,
        )
    )
    q = SchedulerJobQueue(
        job_key="owned_course_opening_extract",
        action="RUN_NOW",
        status="PROCESSING",
        payload={"year": 2024, "min_score": 0},
    )
    db_session.add(q)
    await db_session.commit()
    await db_session.refresh(q)
    q.payload = {**(q.payload or {}), "queue_id": q.id}
    await db_session.commit()

    mock_rows = [
        {
            "institution_name": "신기관",
            "course_name": "신과정",
            "tra_start_date": "2024-03-01",
            "tra_end_date": "2024-03-31",
            "reg_course_man": "5",
        }
    ]

    with (
        patch(
            "scheduler.jobs.owned_course_opening_extract._load_active_owned_names",
            new=AsyncMock(return_value=["신과정"]),
        ),
        patch(
            "scheduler.jobs.owned_course_opening_extract._build_owned_scroll_body",
            return_value={"query": {"match_all": {}}},
        ),
        patch(
            "scheduler.jobs.owned_course_opening_extract._scroll_owned_courses",
            new=AsyncMock(return_value=mock_rows),
        ),
        patch(
            "scheduler.jobs.owned_course_opening_extract.AsyncElasticsearch",
        ) as es_cls,
    ):
        es_cls.return_value.close = AsyncMock()
        result = await _run_extract(
            {"year": 2024, "min_score": 0, "queue_id": q.id}
        )

    assert result["row_count"] == 1
    await db_session.refresh(q)
    assert q.payload["row_count"] == 1
    assert q.payload.get("extracted_at")

    rows_2024 = (
        await db_session.execute(
            select(OwnedCourseOpening).where(OwnedCourseOpening.year == 2024)
        )
    ).scalars().all()
    assert len(rows_2024) == 1
    assert rows_2024[0].course_name == "신과정"
    assert rows_2024[0].institution_name == "신기관"
