from app.routes.courses import _tra_start_date_range, _tra_start_date_year_filter


def test_tra_start_date_range_includes_compact_and_iso():
    clause = _tra_start_date_range("20250101", "20250331")
    assert clause == {
        "bool": {
            "should": [
                {
                    "range": {
                        "traStartDate": {"gte": "2025-01-01", "lte": "2025-03-31"}
                    }
                },
                {
                    "range": {
                        "traStartDate": {"gte": "20250101", "lte": "20250331"}
                    }
                },
            ],
            "minimum_should_match": 1,
        }
    }


def test_tra_start_date_year_filter():
    clause = _tra_start_date_year_filter(2025)
    assert clause == {
        "bool": {
            "should": [
                {
                    "range": {
                        "traStartDate": {"gte": "2025-01-01", "lte": "2025-12-31"}
                    }
                },
                {
                    "range": {
                        "traStartDate": {"gte": "20250101", "lte": "20251231"}
                    }
                },
            ],
            "minimum_should_match": 1,
        }
    }
