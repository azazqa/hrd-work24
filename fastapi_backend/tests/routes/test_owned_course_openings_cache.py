from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models import ClientNameMapping, OwnedCourseOpening, Settlement
from app.routes.settlements import _build_compare_result, _classify_owned_course


def test_build_compare_result_from_cache_rows():
    mapping = {"훈련기관A": "고객사A"}
    keys = {("고객사A", "과정1", date(2024, 1, 10))}
    owned_rows = [
        {
            "institution_name": "훈련기관A",
            "course_name": "과정1",
            "tra_start_date": date(2024, 1, 10),
            "tra_end_date": date(2024, 1, 20),
            "reg_course_man": "3",
        },
        {
            "institution_name": "훈련기관A",
            "course_name": "과정2",
            "tra_start_date": date(2024, 2, 1),
            "tra_end_date": None,
            "reg_course_man": "1",
        },
        {
            "institution_name": "미맵핑기관",
            "course_name": "과정3",
            "tra_start_date": date(2024, 3, 1),
            "tra_end_date": None,
            "reg_course_man": None,
        },
    ]
    extracted_at = datetime(2024, 6, 1, tzinfo=timezone.utc)
    result = _build_compare_result(
        year=2024,
        owned_rows=owned_rows,
        mapping=mapping,
        settlement_keys=keys,
        cache_hit=True,
        extracted_at=extracted_at,
    )
    assert result.cache_hit is True
    assert result.total == 3
    assert result.matched == 1
    assert result.unsettled == 1
    assert result.unmapped == 1
    assert result.items_matched[0].course_name == "과정1"
    assert result.items_unsettled[0].course_name == "과정2"
    assert result.items_unmapped[0].institution_name == "미맵핑기관"


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

    with patch("app.routes.settlements.get_es") as get_es:
        res = await test_client.get(
            "/settlements/compare-owned?year=2024",
            headers=headers,
        )
        get_es.assert_not_called()

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["cache_hit"] is True
    assert body["total"] == 2
    assert body["matched"] == 1
    assert body["unsettled"] == 1
    assert body["unmapped"] == 0


@pytest.mark.asyncio
async def test_refresh_replaces_year_cache(
    test_client, authenticated_user, db_session
):
    headers = authenticated_user["headers"]
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
    db_session.add(
        OwnedCourseOpening(
            year=2025,
            institution_name="다른연도",
            course_name="유지과정",
            tra_start_date=date(2025, 1, 1),
            extracted_at=old_at,
        )
    )
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
            "app.routes.settlements._load_active_owned_names",
            new=AsyncMock(return_value=["신과정"]),
        ),
        patch(
            "app.routes.settlements._build_owned_scroll_body",
            return_value={"query": {"match_all": {}}},
        ),
        patch(
            "app.routes.settlements._scroll_owned_courses",
            new=AsyncMock(return_value=mock_rows),
        ),
        patch("app.routes.settlements.get_es", return_value=object()),
    ):
        res = await test_client.post(
            "/settlements/compare-owned/refresh?year=2024",
            headers=headers,
        )

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["year"] == 2024
    assert body["row_count"] == 1

    active_2024 = (
        await db_session.execute(
            select(OwnedCourseOpening).where(
                OwnedCourseOpening.year == 2024,
                OwnedCourseOpening.is_delete == False,  # noqa: E712
            )
        )
    ).scalars().all()
    assert len(active_2024) == 1
    assert active_2024[0].institution_name == "신기관"
    assert active_2024[0].course_name == "신과정"

    deleted_old = (
        await db_session.execute(
            select(OwnedCourseOpening).where(
                OwnedCourseOpening.year == 2024,
                OwnedCourseOpening.course_name == "구과정",
            )
        )
    ).scalar_one()
    assert deleted_old.is_delete is True

    kept_2025 = (
        await db_session.execute(
            select(OwnedCourseOpening).where(
                OwnedCourseOpening.year == 2025,
                OwnedCourseOpening.is_delete == False,  # noqa: E712
            )
        )
    ).scalar_one()
    assert kept_2025.course_name == "유지과정"


def test_classify_owned_course_still_works():
    status, client = _classify_owned_course(
        institution_name="X",
        course_name="C",
        tra_start_date=date(2024, 1, 1),
        mapping={},
        settlement_keys=set(),
    )
    assert status == "unmapped"
    assert client is None
