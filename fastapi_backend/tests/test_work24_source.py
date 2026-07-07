from app.work24 import _normalize_stored_date, _to_source


def test_normalize_stored_date_compact():
    assert _normalize_stored_date("20250315") == "2025-03-15"


def test_normalize_stored_date_passthrough():
    assert _normalize_stored_date("2025-03-15") == "2025-03-15"


def test_to_source_normalizes_tra_dates():
    source = _to_source(
        {
            "title": "과정",
            "subTitle": "기관",
            "traStartDate": "20250101",
            "traEndDate": "20250131",
        }
    )
    assert source["traStartDate"] == "2025-01-01"
    assert source["traEndDate"] == "2025-01-31"
