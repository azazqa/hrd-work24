from app.routes.courses import (
    _build_list_body,
    _tra_start_date_range,
    _tra_start_date_year_filter,
)


def test_tra_start_date_range_uses_tra_start_date_field():
    assert _tra_start_date_range("20250101", "20250430") == {
        "range": {
            "traStartDate": {"gte": "2025-01-01", "lte": "2025-04-30"}
        }
    }


def test_tra_start_date_year_filter():
    assert _tra_start_date_year_filter(2025) == {
        "range": {
            "traStartDate": {"gte": "2025-01-01", "lte": "2025-12-31"}
        }
    }


def test_build_list_body_uses_tra_start_date_range():
    body = _build_list_body("20250101", "20250430", None, None, 1, 20)
    assert "runtime_mappings" not in body
    assert body["query"]["bool"]["must"][0] == {
        "range": {
            "traStartDate": {"gte": "2025-01-01", "lte": "2025-04-30"}
        }
    }
