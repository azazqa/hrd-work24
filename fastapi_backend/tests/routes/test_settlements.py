import io
from decimal import Decimal

import pytest
from openpyxl import Workbook

from app.models import Settlement
from app.routes.settlements import (
    _normalize_ym,
    _parse_rate,
    _row_to_fields,
    _year_from_ym,
)


def test_normalize_ym_from_string_and_number():
    assert _normalize_ym("202401") == "202401"
    assert _normalize_ym(202401) == "202401"
    assert _normalize_ym("2024-01") == "202401"
    assert _normalize_ym(None) is None


def test_year_from_ym():
    assert _year_from_ym("202401") == 2024


def test_parse_rate_percent_and_decimal():
    assert _parse_rate("30%") == Decimal("0.3")
    assert _parse_rate("0.36") == Decimal("0.36")
    assert _parse_rate(0.5) == Decimal("0.5")
    assert _parse_rate(None) is None


def test_row_to_fields_builds_purchase_year():
    fields = _row_to_fields(
        {
            "purchase_ym": "202401",
            "sales_ym": "202312",
            "client_name": "휴넷",
            "course_name": "테스트 과정",
            "headcount": "1",
            "base_tuition": 1000,
            "share_rate": "30%",
            "settlement_rate": 0.25,
            "settlement_amount": 250,
        }
    )
    assert fields["purchase_ym"] == "202401"
    assert fields["purchase_year"] == 2024
    assert fields["client_name"] == "휴넷"
    assert fields["share_rate"] == Decimal("0.3")
    assert fields["settlement_rate"] == Decimal("0.25")


def test_row_to_fields_requires_client_and_course():
    with pytest.raises(ValueError, match="고객사"):
        _row_to_fields({"purchase_ym": "202401", "course_name": "A"})
    with pytest.raises(ValueError, match="과정명"):
        _row_to_fields({"purchase_ym": "202401", "client_name": "A"})


def _xlsx_bytes(headers: list[str], rows: list[list]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


HEADERS = [
    "매입년월",
    "매출년월",
    "고객사",
    "과정명",
    "교육기간",
    "인원",
    "기준수강료",
    "교재비",
    "정산제외금",
    "배분율",
    "순매출액",
    "정산율",
    "정산액",
    "비고",
    "영업대표",
]


@pytest.mark.asyncio
async def test_import_replaces_year_and_rejects_other_year(
    test_client, authenticated_user, db_session
):
    db_session.add(
        Settlement(
            purchase_ym="202401",
            purchase_year=2024,
            client_name="기존고객",
            course_name="기존과정",
        )
    )
    db_session.add(
        Settlement(
            purchase_ym="202501",
            purchase_year=2025,
            client_name="타년도고객",
            course_name="타년도과정",
        )
    )
    await db_session.commit()

    content = _xlsx_bytes(
        HEADERS,
        [
            [
                "202401",
                "202312",
                "신규고객",
                "신규과정",
                "2023-01-01",
                "1",
                1000,
                0,
                0,
                "30%",
                700,
                0.5,
                350,
                "비고",
                "홍길동",
            ],
            [
                "202501",
                "202412",
                "다른해",
                "다른과정",
                "2024-01-01",
                "1",
                1000,
                0,
                0,
                "0.3",
                700,
                0.5,
                350,
                "",
                "김철수",
            ],
        ],
    )

    res = await test_client.post(
        "/settlements/import",
        headers=authenticated_user["headers"],
        data={"year": "2024"},
        files={
            "file": (
                "settlements.xlsx",
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["deleted"] == 1
    assert body["created"] == 1
    assert body["failed"] == 1
    assert any("선택 년도" in e["message"] for e in body["errors"])

    list_2024 = await test_client.get(
        "/settlements",
        headers=authenticated_user["headers"],
        params={"year": 2024, "page": 1, "size": 20},
    )
    assert list_2024.status_code == 200
    data_2024 = list_2024.json()
    assert data_2024["total"] == 1
    assert data_2024["items"][0]["client_name"] == "신규고객"

    list_2025 = await test_client.get(
        "/settlements",
        headers=authenticated_user["headers"],
        params={"year": 2025, "page": 1, "size": 20},
    )
    assert list_2025.status_code == 200
    data_2025 = list_2025.json()
    assert data_2025["total"] == 1
    assert data_2025["items"][0]["client_name"] == "타년도고객"


@pytest.mark.asyncio
async def test_list_settlements_filters(test_client, authenticated_user, db_session):
    db_session.add_all(
        [
            Settlement(
                purchase_ym="202401",
                purchase_year=2024,
                client_name="휴넷",
                course_name="사이버보안 입문",
                settlement_amount=100,
            ),
            Settlement(
                purchase_ym="202402",
                purchase_year=2024,
                client_name="러닝팩토리",
                course_name="블록체인",
                settlement_amount=200,
            ),
            Settlement(
                purchase_ym="202501",
                purchase_year=2025,
                client_name="휴넷",
                course_name="사이버보안 심화",
                settlement_amount=300,
            ),
        ]
    )
    await db_session.commit()

    res = await test_client.get(
        "/settlements",
        headers=authenticated_user["headers"],
        params={"year": 2024, "client_name": "휴넷", "page": 1, "size": 20},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["course_name"] == "사이버보안 입문"

    res2 = await test_client.get(
        "/settlements",
        headers=authenticated_user["headers"],
        params={"course_name": "블록체인", "page": 1, "size": 20},
    )
    assert res2.status_code == 200
    assert res2.json()["total"] == 1
    assert res2.json()["items"][0]["client_name"] == "러닝팩토리"
