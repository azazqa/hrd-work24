from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.routes.courses import (
    EXPORT_HEADERS,
    EXPORT_OVER_LIMIT_MESSAGE,
    MAX_EXPORT_ROWS,
    _assert_export_within_limit,
    _course_item_to_row,
    _extract_total_count,
    _write_courses_xlsx,
)
from app.routes.courses import CourseListItem


def test_course_item_to_row_order_and_values():
    item = CourseListItem(
        inst_name="기관",
        course_name="과정",
        trpr_degr="1",
        tra_start_date="2025-01-01",
        tra_end_date="2025-01-31",
        address="서울",
        tel_no="02-0000-0000",
        yard_man="20",
        reg_course_man="5",
        real_man="100000",
        title_link="https://example.com",
        trainst_cst_id="T1",
        trpr_id="P1",
    )
    row = _course_item_to_row(item)
    assert len(row) == len(EXPORT_HEADERS)
    assert row[0] == "기관"
    assert row[1] == "과정"
    assert row[10] == "https://example.com"
    assert row[11] == "T1"
    assert row[12] == "P1"


def test_course_item_to_row_empty_fields():
    item = CourseListItem()
    row = _course_item_to_row(item)
    assert row == [""] * len(EXPORT_HEADERS)


def test_extract_total_count_dict_and_int():
    assert _extract_total_count({"hits": {"total": {"value": 42}}}) == 42
    assert _extract_total_count({"hits": {"total": 7}}) == 7


def test_assert_export_within_limit_allows_max():
    _assert_export_within_limit(MAX_EXPORT_ROWS)


def test_assert_export_over_limit_raises():
    with pytest.raises(HTTPException) as exc_info:
        _assert_export_within_limit(MAX_EXPORT_ROWS + 1)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == EXPORT_OVER_LIMIT_MESSAGE


@pytest.mark.asyncio
async def test_write_courses_xlsx_rejects_over_limit(tmp_path):
    es = AsyncMock()
    es.search.return_value = {
        "_scroll_id": "scroll-1",
        "hits": {"total": {"value": MAX_EXPORT_ROWS + 1}, "hits": []},
    }
    es.clear_scroll = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await _write_courses_xlsx(es, {"query": {"match_all": {}}}, str(tmp_path / "out.xlsx"))

    assert exc_info.value.status_code == 400
    es.clear_scroll.assert_awaited_once_with(scroll_id="scroll-1")
