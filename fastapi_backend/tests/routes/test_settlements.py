import io
from datetime import date, datetime
from decimal import Decimal

import pytest
from openpyxl import Workbook

from app.models import Settlement
from app.routes.settlements import (
    _classify_owned_course,
    _normalize_compare_date,
    _normalize_ym,
    _parse_education_period_date,
    _parse_rate,
    _preprocess_education_period,
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


def test_preprocess_education_period():
    assert _preprocess_education_period("2023.11.17 ~ 2023.12.14") == "2023-11-17~2023-12-14"
    assert _preprocess_education_period(" 2023.10.01 ") == "2023-10-01"
    assert _preprocess_education_period("23.11.01") == "23-11-01"


def test_parse_education_period_date_formats():
    assert _parse_education_period_date("2023.11.01~2023.11.30") == date(2023, 11, 1)
    assert _parse_education_period_date("2023-09-01") == date(2023, 9, 1)
    assert _parse_education_period_date("2023/09/01") == date(2023, 9, 1)
    assert _parse_education_period_date("20230901") == date(2023, 9, 1)
    assert _parse_education_period_date(date(2023, 9, 1)) == date(2023, 9, 1)
    assert _parse_education_period_date(datetime(2023, 9, 1, 12, 0)) == date(2023, 9, 1)
    assert _parse_education_period_date("not-a-date") is None
    assert _parse_education_period_date(None) is None
    assert _parse_education_period_date("") is None
    assert _parse_education_period_date("2023.11.17 ~ 2023.12.14") == date(2023, 11, 17)


def test_parse_education_period_date_user_samples():
    assert _parse_education_period_date("2023-05-24") == date(2023, 5, 24)
    assert _parse_education_period_date("2022-04-12~2022-05-11") == date(2022, 4, 12)
    assert _parse_education_period_date("2023.10.01") == date(2023, 10, 1)
    # 연도 후행 + 모호 → DMY
    assert _parse_education_period_date("05-10-2023") == date(2023, 10, 5)
    assert _parse_education_period_date("23.11.01") == date(2023, 11, 1)
    assert _parse_education_period_date("01-5-2024") == date(2024, 5, 1)
    # day>12 → MDY로만 해석 가능
    assert _parse_education_period_date("05-13-2023") == date(2023, 5, 13)
    # month>12 불가, day>12 → DMY
    assert _parse_education_period_date("13-05-2023") == date(2023, 5, 13)


def test_parse_education_period_date_compact_and_dotted_ranges():
    assert _parse_education_period_date("2023.11.17~2023.12.14") == date(2023, 11, 17)
    assert _parse_education_period_date("2023.11.17-2023.12.14") == date(2023, 11, 17)
    assert _parse_education_period_date("20231201-20231231") == date(2023, 12, 1)
    assert _parse_education_period_date("20231201~20231231") == date(2023, 12, 1)
    # 단일 하이픈 날짜는 구간으로 오인하지 않음
    assert _parse_education_period_date("2023-05-24") == date(2023, 5, 24)


def test_row_to_fields_builds_purchase_year():
    fields = _row_to_fields(
        {
            "purchase_ym": "202401",
            "sales_ym": "202312",
            "client_name": "휴넷",
            "course_name": "테스트 과정",
            "education_period": "2023.11.01~2023.11.30",
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
    assert fields["education_period"] == "2023.11.01~2023.11.30"
    assert fields["education_period_date"] == date(2023, 11, 1)


def test_classify_owned_course_statuses():
    mapping = {"훈련기관A": "고객사A"}
    keys = {("고객사A", "과정1", date(2024, 1, 10))}

    status, client = _classify_owned_course(
        institution_name="훈련기관A",
        course_name="과정1",
        tra_start_date=date(2024, 1, 10),
        mapping=mapping,
        settlement_keys=keys,
    )
    assert status == "matched"
    assert client == "고객사A"

    status, client = _classify_owned_course(
        institution_name="훈련기관A",
        course_name="과정1",
        tra_start_date=date(2024, 2, 1),
        mapping=mapping,
        settlement_keys=keys,
    )
    assert status == "unsettled"
    assert client == "고객사A"

    status, client = _classify_owned_course(
        institution_name="없는기관",
        course_name="과정1",
        tra_start_date=date(2024, 1, 10),
        mapping=mapping,
        settlement_keys=keys,
    )
    assert status == "unmapped"
    assert client is None


def test_normalize_compare_date():
    assert _normalize_compare_date("2023-11-17") == date(2023, 11, 17)
    assert _normalize_compare_date("20231117") == date(2023, 11, 17)
    assert _normalize_compare_date("2023.11.17") == date(2023, 11, 17)
    assert _normalize_compare_date(None) is None
    assert _normalize_compare_date("") is None


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
