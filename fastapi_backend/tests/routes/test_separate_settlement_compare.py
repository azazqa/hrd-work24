from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.models import (
    ClientNameMapping,
    OwnedCourseOpening,
    SeparateSettlement,
    Settlement,
)
from app.routes.settlements import (
    _add_months,
    _parse_contract_period_range,
    _parse_relative_contract_period,
    _refresh_settlements_consolidated,
    _resolve_contract_window,
)


def test_parse_contract_period_range_fixed():
    assert _parse_contract_period_range("2022.08.29~2023.08.28") == (
        date(2022, 8, 29),
        date(2023, 8, 28),
    )
    assert _parse_contract_period_range("2022-08-29~2023-08-28") == (
        date(2022, 8, 29),
        date(2023, 8, 28),
    )
    assert _parse_contract_period_range("학습일로부터 6개월") is None
    assert _parse_contract_period_range(None) is None


def test_parse_relative_contract_period():
    assert _parse_relative_contract_period("사용일로부터 1년(간)") == "1y"
    assert _parse_relative_contract_period("학습시작일로부터 1년") == "1y"
    assert _parse_relative_contract_period("학습일로부터 6개월") == "6m"
    assert _parse_relative_contract_period("2022.08.29~2023.08.28") is None


def test_resolve_contract_window_relative_uses_anchor():
    anchor = date(2024, 1, 15)
    assert _resolve_contract_window("학습일로부터 6개월", anchor) == (
        date(2024, 1, 15),
        _add_months(anchor, 6) - timedelta(days=1),
    )
    assert _resolve_contract_window("학습일로부터 6개월", None) is None


async def _seed_and_refresh_mv(db_session, *rows):
    for row in rows:
        db_session.add(row)
    await db_session.commit()
    await _refresh_settlements_consolidated(db_session)


@pytest.mark.asyncio
async def test_compare_separate_fixed_period_priority_over_settlement(
    test_client, authenticated_user, db_session
):
    """고정 계약기간 안이면 일반 정산 키와 겹쳐도 separate."""
    headers = authenticated_user["headers"]
    extracted_at = datetime.now(timezone.utc)
    await _seed_and_refresh_mv(
        db_session,
        ClientNameMapping(institution_name="별도기관", client_name="별도고객"),
        OwnedCourseOpening(
            year=2024,
            institution_name="별도기관",
            course_name="임대과정",
            tra_start_date=date(2024, 3, 1),
            reg_course_man="10",
            extracted_at=extracted_at,
        ),
        Settlement(
            purchase_ym="202403",
            purchase_year=2024,
            client_name="별도고객",
            course_name="임대과정",
            education_period_date=date(2024, 3, 1),
            headcount=10,
            base_tuition=Decimal("1000"),
            settlement_amount=Decimal("100"),
        ),
        SeparateSettlement(
            client_name="별도고객",
            course_name="임대과정",
            contract_period="2024.01.01~2024.12.31",
            base_revenue=Decimal("10000000"),
            calculated_amount=Decimal("2500000"),
            settlement_rate=Decimal("0.25"),
            settlement_rate_raw="25%",
        ),
    )

    res = await test_client.post(
        "/settlements/compare-owned?year=2024",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["separate"] == 1
    assert body["matched"] == 0
    assert body["unsettled"] == 0

    items = await test_client.get(
        "/settlements/compare-owned/items?year=2024&status=separate&page=1&size=50",
        headers=headers,
    )
    assert items.status_code == 200
    assert items.json()["total"] == 1
    assert items.json()["items"][0]["status"] == "separate"


@pytest.mark.asyncio
async def test_compare_separate_relative_six_months_anchor(
    test_client, authenticated_user, db_session
):
    """상대 6개월: 앵커=가장 이른 시작일 기준, 구간 밖은 일반 비교."""
    headers = authenticated_user["headers"]
    extracted_at = datetime.now(timezone.utc)
    await _seed_and_refresh_mv(
        db_session,
        ClientNameMapping(institution_name="상대기관", client_name="상대고객"),
        OwnedCourseOpening(
            year=2024,
            institution_name="상대기관",
            course_name="상대과정",
            tra_start_date=date(2024, 1, 10),
            reg_course_man="1",
            extracted_at=extracted_at,
        ),
        OwnedCourseOpening(
            year=2024,
            institution_name="상대기관",
            course_name="상대과정",
            tra_start_date=date(2024, 5, 10),
            reg_course_man="1",
            extracted_at=extracted_at,
        ),
        OwnedCourseOpening(
            year=2024,
            institution_name="상대기관",
            course_name="상대과정",
            tra_start_date=date(2024, 8, 10),
            reg_course_man="1",
            extracted_at=extracted_at,
        ),
        SeparateSettlement(
            client_name="상대고객",
            course_name="상대과정",
            contract_period="학습일로부터 6개월",
        ),
    )

    res = await test_client.post(
        "/settlements/compare-owned?year=2024",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    # 1/10~7/9 inclusive → Jan, May separate; Aug unsettled
    assert body["separate"] == 2
    assert body["unsettled"] == 1
    assert body["matched"] == 0


@pytest.mark.asyncio
async def test_compare_outside_contract_period_uses_general(
    test_client, authenticated_user, db_session
):
    headers = authenticated_user["headers"]
    extracted_at = datetime.now(timezone.utc)
    await _seed_and_refresh_mv(
        db_session,
        ClientNameMapping(institution_name="기간밖기관", client_name="기간밖고객"),
        OwnedCourseOpening(
            year=2024,
            institution_name="기간밖기관",
            course_name="일반과정",
            tra_start_date=date(2024, 9, 1),
            reg_course_man="3",
            extracted_at=extracted_at,
        ),
        Settlement(
            purchase_ym="202409",
            purchase_year=2024,
            client_name="기간밖고객",
            course_name="일반과정",
            education_period_date=date(2024, 9, 1),
            headcount=3,
        ),
        SeparateSettlement(
            client_name="기간밖고객",
            course_name="일반과정",
            contract_period="2024.01.01~2024.06.30",
        ),
    )

    res = await test_client.post(
        "/settlements/compare-owned?year=2024",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["separate"] == 0
    assert body["matched"] == 1
