from app.routes.courses import (
    TRA_START_DATE_RUNTIME_MAPPING,
    _attach_search_runtime_mappings,
    _build_list_body,
    _tra_start_date_range,
    _tra_start_date_year_filter,
)


def test_tra_start_date_range_uses_runtime_compact_field():
    assert _tra_start_date_range("20250101", "20250430") == {
        "range": {
            "traStartDateCompact": {"gte": "20250101", "lte": "20250430"}
        }
    }


def test_tra_start_date_year_filter():
    assert _tra_start_date_year_filter(2025) == {
        "range": {
            "traStartDateCompact": {"gte": "20250101", "lte": "20251231"}
        }
    }


def test_attach_search_runtime_mappings():
    body = _attach_search_runtime_mappings({"query": {"match_all": {}}})
    assert "traStartDateCompact" in body["runtime_mappings"]
    assert body["runtime_mappings"]["traStartDateCompact"] == (
        TRA_START_DATE_RUNTIME_MAPPING["traStartDateCompact"]
    )


def test_build_list_body_includes_runtime_mappings():
    body = _build_list_body("20250101", "20250430", None, None, 1, 20)
    assert "runtime_mappings" in body
    assert "traStartDateCompact" in body["query"]["bool"]["must"][0]["range"]
