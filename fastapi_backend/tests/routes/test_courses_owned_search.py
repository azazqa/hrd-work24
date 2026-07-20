import json

from app.routes.courses import (
    _build_owned_match_body,
    _build_owned_name_clause,
    _course_id_sort,
)


def test_course_id_sort_order():
    assert _course_id_sort() == [
        {
            "trngCrseNm.raw": {
                "order": "asc",
                "missing": "_last",
                "unmapped_type": "keyword",
            }
        },
        {
            "instNm": {
                "order": "asc",
                "missing": "_last",
                "unmapped_type": "keyword",
            }
        },
        {
            "trainstCstId.keyword": {
                "order": "asc",
                "missing": "_last",
                "unmapped_type": "keyword",
            }
        },
        {
            "trprId.keyword": {
                "order": "asc",
                "missing": "_last",
                "unmapped_type": "keyword",
            }
        },
        {
            "trprDegr.keyword": {
                "order": "asc",
                "missing": "_last",
                "unmapped_type": "keyword",
            }
        },
    ]


def test_course_id_sort_with_score():
    assert _course_id_sort(include_score=True)[0] == {"_score": "desc"}
    assert len(_course_id_sort(include_score=True)) == 6


def test_owned_name_clause_uses_substring_not_ngram():
    name = "매장판매직 역량 강화 스킬업"
    clause = _build_owned_name_clause(name)
    blob = json.dumps(clause, ensure_ascii=False)

    assert "ngram" not in blob
    assert "fuzzy" not in blob
    assert f"*{name}*" in blob
    assert {"term": {"trngCrseNm.raw": {"value": name, "boost": 10}}} in clause["bool"][
        "should"
    ]


def test_owned_match_body_one_clause_per_name():
    names = ["과정 A", "과정 B"]
    body = _build_owned_match_body(names, 2025, 1, 20, min_score=1.0)
    should = body["query"]["bool"]["should"]

    assert len(should) == 2
    assert body["min_score"] == 1.0
