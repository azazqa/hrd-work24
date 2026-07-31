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


def test_build_list_body_process_nm_uses_match_phrase_not_match():
    name = "알아두면 쓸모 있는 신비한 사이버보안"
    body = _build_list_body("20240101", "20241231", None, name, 1, 20)
    process_clause = body["query"]["bool"]["must"][1]
    should = process_clause["bool"]["should"]
    blob = str(should)
    assert "match_phrase" in blob
    assert "'match':" not in blob and '"match":' not in blob
    assert {
        "match_phrase": {"trngCrseNm.nori": {"query": name, "slop": 2}}
    } in should
    assert {
        "wildcard": {
            "trngCrseNm.raw": {
                "value": f"*{name}*",
                "case_insensitive": True,
            }
        }
    } in should
