# 고용24 과정 정보 검색 - 전체 시스템 아키텍처 설계

## 1. 배경 및 문제 정의

- 고용24 Open API로 훈련과정 정보를 수집하여 DB에 저장하고, 보유한 과정명 목록으로 부분검색을 수행해야 함
- 보유한 과정명과 고용24에 등록된 과정명이 다를 수 있음 (오탈자, 띄어쓰기, 어순 차이 등)
- 검토한 방식과 각각의 한계:

| 방식 | 설명 | 한계 |
|---|---|---|
| 정확 검색 | 과정명이 완전히 일치하는 것만 저장 | 표기 차이가 있으면 loss 발생 |
| API 부분검색 | API 자체 부분일치 파라미터 사용 | 결국 검색어를 입력해야 하므로, 검색어와 실제 과정명이 다르면 여전히 loss 발생 |
| 전체 저장 + DB LIKE | 전체 과정을 다 저장 후 로컬에서 LIKE 검색 | 저장 부담 크고, LIKE로는 오탈자 대응 불가 |
| **전체 저장 + Elasticsearch** | 전체 과정을 ES에 색인 후 fuzzy/ngram 검색 | 채택안 (본 문서의 주제) |

- **결론**: 전체 데이터를 1회 수집하여 검색 전용 엔진(Elasticsearch)에 색인해두고, 이후 검색은 API 재호출 없이 ES에서 처리. 오탈자·띄어쓰기·부분일치를 모두 커버.

---

## 2. 전체 시스템 구성

### 2.1 스택

| 계층 | 기술 | 역할 |
|---|---|---|
| Backend | FastAPI | 고용24 Open API 호출/수집 관리, ES 색인 파이프라인 실행, 검색·매칭 API 제공, 다운로드용 데이터 가공 |
| Frontend | Next.js | 과정 목록 조회 UI, 검색/필터, 결과 다운로드(CSV/Excel) 트리거 |
| Search/Store | Elasticsearch | 과정 데이터 저장 및 오탈자·부분일치 검색 (캐시 겸 검색 엔진) |
| DB (정본) | MySQL | 확정된 매칭 결과(owned_name ↔ 과정ID) 저장 |

### 2.2 아키텍처 다이어그램

```
                         ┌──────────────────┐
                         │   고용24 Open API │
                         └────────┬─────────┘
                                  │ (배치 수집, FastAPI 스케줄러/워커)
                                  ▼
                         ┌──────────────────┐
                         │   Elasticsearch   │  ← 검색/매칭 전용 (전체 과정 원본 캐시)
                         └────────┬─────────┘
                                  │ (매칭 확정 시)
                                  ▼
                         ┌──────────────────┐
                         │      MySQL        │  ← course_match_log (정본 저장)
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │     FastAPI        │  ← REST API (검색, 목록, 다운로드)
                         └────────┬─────────┘
                                  │ HTTP
                                  ▼
                         ┌──────────────────┐
                         │      Next.js       │  ← 과정 목록 조회 / 다운로드 UI
                         └──────────────────┘
```

- **Elasticsearch**: "찾기"를 위한 검색 인덱스 (전체 과정 원본 캐시)
- **MySQL**: "확정된 매칭 결과"를 위한 source of truth (owned_name ↔ 과정ID)
- **FastAPI**: 외부 API 연동, 배치/색인 파이프라인, 검색·매칭·다운로드용 API 레이어 (ES/MySQL 앞단의 단일 진입점)
- **Next.js**: 사용자가 직접 조작하는 화면 (목록 조회, 검색, 다운로드)
- 역할을 분리해서 ES는 언제든 재색인/재구축 가능한 캐시로, MySQL은 최종 결과 저장소로, FastAPI는 두 저장소를 감추는 API 게이트웨이로 운영

---

## 3. Elasticsearch 인덱스 설계

한국어 과정명 특성상 **형태소 분석(nori)** 과 **ngram** 을 함께 사용해야 함:
- nori만 사용 시: 오탈자에 약함
- ngram만 사용 시: 의미 단위가 깨져 노이즈 많음
- 필드를 분리해서 둘 다 인덱싱 후 검색 시 함께 활용

```json
PUT /trng_courses
{
  "settings": {
    "analysis": {
      "tokenizer": {
        "ngram_tokenizer": {
          "type": "ngram",
          "min_gram": 2,
          "max_gram": 3,
          "token_chars": ["letter", "digit"]
        }
      },
      "analyzer": {
        "korean_analyzer": {
          "type": "custom",
          "tokenizer": "nori_tokenizer",
          "filter": ["nori_readingform", "lowercase"]
        },
        "ngram_analyzer": {
          "type": "custom",
          "tokenizer": "ngram_tokenizer",
          "filter": ["lowercase"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "trngCrseNm": {
        "type": "text",
        "fields": {
          "nori":  { "type": "text", "analyzer": "korean_analyzer" },
          "ngram": { "type": "text", "analyzer": "ngram_analyzer" },
          "raw":   { "type": "keyword" }
        }
      },
      "trprId": { "type": "keyword" },
      "instNm": { "type": "keyword" },
      "traStartDate": { "type": "date" }
    }
  }
}
```

- `trngCrseNm.raw` (keyword): 완전일치 검사용
- `trngCrseNm.nori`: 형태소 기반 의미 단위 검색 (조사/어순 차이에 강함)
- `trngCrseNm.ngram`: 2~3글자 조각 매칭 (띄어쓰기 차이, 부분 포함 관계에 강함)

> 사전 준비: nori 플러그인 설치 필요 (`elasticsearch-plugin install analysis-nori`)

---

## 4. 데이터 적재 파이프라인 (FastAPI)

```python
from elasticsearch import Elasticsearch, helpers

def index_all_courses(es: Elasticsearch):
    page = 1
    while True:
        items = call_api(page=page, size=100).get("srchList", [])
        if not items:
            break
        actions = [
            {
                "_index": "trng_courses",
                "_id": item["trprId"],   # API 고유키를 문서ID로 사용 → 재적재시 자동 upsert
                "_source": item,
            }
            for item in items
        ]
        helpers.bulk(es, actions)
        page += 1
```

- `_id`를 API 고유키(훈련과정ID)로 지정하면 재적재해도 중복 없이 자동 갱신(upsert)됨
- 운영 방식:
  - 매일/매주 배치로 전체 재적재, 또는
  - API가 변경분 조회 파라미터를 지원하면 증분 동기화로 전환
- FastAPI 내에서는 이 파이프라인을 다음 중 하나로 트리거:
  - 스케줄러(APScheduler, Celery beat 등)로 주기 실행
  - 관리자용 `POST /admin/reindex` 엔드포인트로 수동 트리거

---

## 5. 검색 쿼리 (부분검색 + 오탈자 허용)

```python
def search_course(es: Elasticsearch, owned_name: str, size=5):
    query = {
        "query": {
            "bool": {
                "should": [
                    {"term": {"trngCrseNm.raw": {"value": owned_name, "boost": 5}}},
                    {"match": {"trngCrseNm.nori": {"query": owned_name, "boost": 3}}},
                    {"match": {"trngCrseNm.ngram": {"query": owned_name, "boost": 1}}},
                    {"fuzzy": {"trngCrseNm.raw": {"value": owned_name, "fuzziness": "AUTO", "boost": 2}}}
                ],
                "minimum_should_match": 1
            }
        },
        "size": size
    }
    return es.search(index="trng_courses", body=query)["hits"]["hits"]
```

| 절 | 역할 | 커버하는 케이스 |
|---|---|---|
| `term` (raw) | 완전 일치, 최고 가중치 | 이름이 완전히 같은 경우 최상위 매칭 |
| `match` (nori) | 형태소 단위 일치 | 조사 차이, 어순 변경 |
| `fuzzy` (raw) | Levenshtein distance 기반 | 오탈자 1~2글자 차이 (`fuzziness: AUTO`) |
| `match` (ngram) | 2~3글자 조각 겹침 | 띄어쓰기 차이, 부분 포함 |

결과는 `_score` 기준 정렬됨.

---

## 6. 매칭 확정 로직 (임계치 기반)

```python
def resolve_match(owned_name: str, hits: list, threshold=0.85):
    if not hits:
        return {"matched": None, "status": "no_match"}
    top = hits[0]
    score = top["_score"]
    if score >= threshold:
        return {"matched": top["_source"], "score": score, "status": "auto"}
    return {"matched": top["_source"], "score": score, "status": "review"}  # 수동 확인 큐
```

- `_score`는 쿼리 boost 설정에 따라 상대적이므로, 초기 threshold는 낮게(예: 실험적으로 결정) 잡고 매칭 로그를 축적하면서 튜닝 권장
- `status = 'review'` 건은 관리 화면(Next.js)에서 수동 확인 큐로 전환 → loss 없이 운영 가능

---

## 7. MySQL 정본 테이블 (제안 스키마)

| 테이블 | 용도 |
|---|---|
| `owned_courses` | 보유한 과정명 원본 목록 |
| `course_match_log` | 매칭 결과 (owned_name, matched_trpr_id, score, status: auto / review / no_match, matched_at) |

---

## 8. FastAPI 백엔드 - API 레이어 설계

FastAPI는 ES/MySQL을 직접 노출하지 않고, 프론트엔드(Next.js)가 필요로 하는 형태로 가공해 제공하는 게이트웨이 역할을 한다.

### 8.1 제안 엔드포인트

| 메서드 | 경로 | 역할 |
|---|---|---|
| `GET` | `/courses` | 과정 목록 조회 (ES 기반, 페이지네이션·필터 지원) |
| `GET` | `/courses/search` | 부분검색/오탈자 검색 (owned_name 기준, ES `search_course` 호출) |
| `GET` | `/courses/{trprId}` | 단건 상세 조회 |
| `GET` | `/courses/export` | 목록/검색 결과 CSV·Excel 다운로드 |
| `GET` | `/match-log` | 매칭 결과 목록 (status별 필터: auto/review/no_match) |
| `POST` | `/match-log/{id}/confirm` | review 상태 건 수동 확정 처리 |
| `POST` | `/admin/reindex` | 고용24 API → ES 전체/증분 재색인 트리거 |

### 8.2 설계 원칙

- 프론트엔드는 ES 쿼리 문법을 알 필요 없이 REST 파라미터(`keyword`, `page`, `size`, `status` 등)만 사용
- 다운로드(`/courses/export`)는 동일한 검색/필터 로직을 재사용하되 응답을 스트리밍 CSV 또는 xlsx로 변환
- 재색인(`/admin/reindex`)은 장시간 작업이므로 백그라운드 태스크(FastAPI `BackgroundTasks` 또는 별도 워커/Celery)로 비동기 처리하고, 진행 상태 조회용 엔드포인트 별도 고려

---

## 9. Next.js 프론트엔드 설계

### 9.1 주요 화면

| 화면 | 기능 |
|---|---|
| 과정 목록 페이지 | 전체/검색 결과 목록, 페이지네이션, 정렬(기관명·시작일 등) |
| 검색 화면 | owned_name 입력 → `/courses/search` 호출 → 매칭 후보 리스트 및 `_score` 표시 |
| 매칭 검토 화면 | `status: review` 건 목록 표시, 담당자가 후보 중 확정 선택 → `/match-log/{id}/confirm` 호출 |
| 다운로드 | 현재 목록/검색 결과 조건 그대로 CSV·Excel 다운로드 버튼 (`/courses/export` 호출) |

### 9.2 데이터 흐름

1. 사용자가 검색어(owned_name) 입력
2. Next.js → FastAPI `/courses/search` 호출
3. FastAPI → ES 쿼리 실행 → 결과 반환
4. 결과 중 `status: review`인 항목은 별도 검토 화면에서 사람이 확정 → FastAPI `/match-log/{id}/confirm` → MySQL 갱신
5. 목록/다운로드는 항상 FastAPI를 통해서만 접근 (ES·MySQL 직접 노출 없음)

---

## 10. 확장 고려사항 (필요 시)

- **초성 검색**: "빅데분" 같은 축약어 대응이 필요하면, 색인 시 초성 문자열을 별도 필드로 미리 계산해 저장 (nori 플러그인 자체에는 초성 분석기 없음, 커스텀 필터 또는 별도 전처리 필요) — 실무 필요성 낮으면 생략 가능
- **Docker 배포**: ES + nori 플러그인, FastAPI, Next.js, MySQL을 묶은 docker-compose 구성 필요 시 별도 정리 가능
- **재색인 전략**: 무중단 재색인이 필요하면 alias + 신규 인덱스 방식 고려 (`trng_courses_v1` → `trng_courses_v2` + alias 전환)
- **동의어 사전**: 자주 쓰이는 약칭/동의어(예: "빅데이터" ↔ "Big Data")가 많다면 synonym filter 추가 고려
- **인증/권한**: 매칭 검토·재색인 등 관리 기능은 FastAPI 레벨에서 별도 인증(예: JWT) 적용 필요