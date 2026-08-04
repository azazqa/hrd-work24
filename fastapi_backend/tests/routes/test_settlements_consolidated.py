from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.models import (
    ClientNameMapping,
    OwnedCourseOpening,
    Settlement,
    SettlementConsolidated,
)
from app.routes.settlements import _refresh_settlements_consolidated


def _same_course_kwargs(**overrides):
    base = dict(
        purchase_ym="202405",
        purchase_year=2024,
        sales_ym="202404",
        client_name="고객합산",
        course_name="분할과정",
        education_period="2024.05.01~2024.05.31",
        education_period_date=date(2024, 5, 1),
        headcount=1,
        base_tuition=Decimal("1000"),
        textbook_fee=Decimal("0"),
        exclude_amount=Decimal("0"),
        share_rate=Decimal("0.3"),
        net_sales=Decimal("700"),
        settlement_rate=Decimal("0.5"),
        settlement_amount=Decimal("350"),
        note="동일",
        sales_rep="홍길동",
    )
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_consolidated_mv_sums_identical_rows(db_session):
    for _ in range(10):
        db_session.add(Settlement(**_same_course_kwargs()))
    await db_session.commit()
    await _refresh_settlements_consolidated(db_session)

    rows = (
        await db_session.execute(
            select(SettlementConsolidated).where(
                SettlementConsolidated.client_name == "고객합산",
                SettlementConsolidated.course_name == "분할과정",
            )
        )
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].headcount == 10
    assert rows[0].settlement_amount == Decimal("350")


@pytest.mark.asyncio
async def test_consolidated_mv_keeps_amount_diff_separate(db_session):
    db_session.add(Settlement(**_same_course_kwargs(settlement_amount=Decimal("350"))))
    db_session.add(Settlement(**_same_course_kwargs(settlement_amount=Decimal("351"))))
    await db_session.commit()
    await _refresh_settlements_consolidated(db_session)

    count = await db_session.scalar(
        select(func.count()).select_from(SettlementConsolidated).where(
            SettlementConsolidated.client_name == "고객합산"
        )
    )
    assert count == 2


@pytest.mark.asyncio
async def test_compare_uses_consolidated_mv(
    test_client, authenticated_user, db_session
):
    headers = authenticated_user["headers"]
    extracted_at = datetime.now(timezone.utc)
    db_session.add(
        ClientNameMapping(institution_name="고객합산", client_name="고객합산")
    )
    db_session.add(
        OwnedCourseOpening(
            year=2024,
            institution_name="고객합산",
            course_name="분할과정",
            tra_start_date=date(2024, 5, 1),
            reg_course_man="10",
            extracted_at=extracted_at,
        )
    )
    for _ in range(10):
        db_session.add(Settlement(**_same_course_kwargs()))
    await db_session.commit()
    await _refresh_settlements_consolidated(db_session)

    res = await test_client.post(
        "/settlements/compare-owned?year=2024",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["matched"] == 1
    assert res.json()["partial"] == 0
    assert res.json()["unsettled"] == 0


@pytest.mark.asyncio
async def test_compare_partial_when_headcount_differs(
    test_client, authenticated_user, db_session
):
    headers = authenticated_user["headers"]
    extracted_at = datetime.now(timezone.utc)
    db_session.add(
        ClientNameMapping(institution_name="고객합산", client_name="고객합산")
    )
    db_session.add(
        OwnedCourseOpening(
            year=2024,
            institution_name="고객합산",
            course_name="분할과정",
            tra_start_date=date(2024, 5, 1),
            reg_course_man="10",
            extracted_at=extracted_at,
        )
    )
    for _ in range(3):
        db_session.add(Settlement(**_same_course_kwargs()))
    await db_session.commit()
    await _refresh_settlements_consolidated(db_session)

    res = await test_client.post(
        "/settlements/compare-owned?year=2024",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["matched"] == 0
    assert body["partial"] == 1
    assert body["unsettled"] == 0

    items = await test_client.get(
        "/settlements/compare-owned/items?year=2024&status=partial&page=1&size=50",
        headers=headers,
    )
    assert items.status_code == 200
    assert items.json()["total"] == 1
    assert items.json()["items"][0]["status"] == "partial"
    assert items.json()["items"][0]["reg_course_man"] == "10"


@pytest.mark.asyncio
async def test_export_settlements_consolidated_xlsx(
    test_client, authenticated_user, db_session
):
    headers = authenticated_user["headers"]
    for _ in range(3):
        db_session.add(Settlement(**_same_course_kwargs()))
    db_session.add(
        Settlement(
            **_same_course_kwargs(
                client_name="다른고객",
                course_name="다른과정",
                settlement_amount=Decimal("100"),
            )
        )
    )
    await db_session.commit()
    await _refresh_settlements_consolidated(db_session)

    res = await test_client.get("/settlements/export", headers=headers)
    assert res.status_code == 200, res.text
    assert "spreadsheetml" in (res.headers.get("content-type") or "")

    from io import BytesIO

    from openpyxl import load_workbook

    wb = load_workbook(BytesIO(res.content))
    ws = wb.active
    assert ws.title == "정산"
    headers_row = [c.value for c in ws[1]]
    assert headers_row[0] == "매입년월"
    assert headers_row[5] == "인원"
    # 3 identical -> 1 row (headcount 3) + 1 other = 2 data rows
    assert ws.max_row == 3
    # find 분할과정 row
    data = [[c.value for c in row] for row in ws.iter_rows(min_row=2, values_only=False)]
    by_course = {row[3]: row for row in data}
    assert by_course["분할과정"][5] == 3
    assert by_course["다른과정"][5] == 1
    wb.close()
