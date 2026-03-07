# 트러블슈팅 가이드

> 이 문서는 Claude가 개발·운영 과정에서 발견한 문제와 해결법을 기록합니다.
> 배포·운영 절차는 12-runbook.md를 참조하세요.

---

## 알려진 이슈 및 해결법

<!-- Claude: 아래 기준에 해당하면 기록:
     - 원인 파악에 10분 이상 걸린 이슈
     - 같은 원인이 반복될 가능성이 있는 이슈
     - 환경/설정 관련 이슈 (다른 개발자도 겪을 수 있음)
     단순 오타, 1회성 실수는 기록 불필요.
     카테고리 예시: [환경] [빌드] [런타임] [데이터] [배포] [외부서비스] -->

### [런타임] analyze API — inferred_hints Pydantic 검증 실패
- **증상**: POST /api/v1/analyze 호출 시 `AnalyzeResponse` 검증 오류 발생. `inferred_hints` 필드에 `Input should be a valid string` 에러 다수 (location_based, filtering_required 등).
- **원인**: `Analysis.inferred_hints` 타입이 `dict[str, str]`로 정의되어 있었으나, Haiku가 `"location_based": true` 같은 bool 값을 반환. Pydantic이 str이 아닌 bool을 거부.
- **해결**: `inferred_hints` 타입을 `dict[str, Any]`로 변경하여 str, bool, int 등 혼합 타입 허용.
- **예방**: AI 응답 스키마 정의 시 LLM이 다양한 타입을 반환할 수 있는 필드는 `Any` 또는 유니온 타입으로 선언. `analysis` 필드는 내부 참조용이므로 엄격한 타입 불필요.
- **발견일**: 2026-03-08

### [런타임] generate API — "No YAML block found in response"
- **증상**: POST /api/v1/generate/stream 호출 시 `응답 형식 오류: No YAML block found in response` 에러 반환.
- **원인**: `_parse_response()`가 ` ```yaml ` 태그가 있는 코드 블록만 우선 탐색하고, fallback도 untagged 코드 블록(` ``` ` 로 감싼 것)만 처리. Sonnet이 코드 펜스 없이 raw YAML/JSON을 반환하는 경우 감지 불가.
- **해결**: `_find_raw_yaml()` fallback 추가 — 코드 펜스 밖에서 `project_name:` 또는 `project:`로 시작하는 YAML 텍스트를 탐지. JSON도 `"architecture_card"` 키를 포함하는 raw JSON fallback 추가.
- **예방**: LLM 응답 파싱 시 코드 펜스 의존도를 낮추고, 내용 기반 휴리스틱 fallback을 항상 포함. T019에서 유사 수정을 했으나 raw content fallback은 누락되어 있었음.
- **발견일**: 2026-03-08

### [런타임] generate API — "No JSON block found in response" (재발)
- **증상**: brace-balancing fallback 적용 후에도 `No JSON block found in response` 에러 재발. LLM이 JSON 메타데이터 블록 자체를 아예 생성하지 않는 케이스.
- **원인**: 모든 JSON fallback(tagged → untagged → raw brace-balancing)을 통과해도 `"architecture_card"` 키워드가 응답에 없으면 감지 불가. 이 경우 ValueError를 raise하여 전체 생성이 실패.
- **해결**: JSON 메타데이터를 optional로 변경. JSON 블록이 없거나 파싱 실패 시 `_default_metadata()`로 placeholder 값(`"-"`, 빈 리스트) 반환. YAML만 있으면 생성 성공.
- **예방**: LLM 응답의 보조 데이터(메타데이터)는 필수가 아닌 optional로 설계. 핵심 출력(YAML)만 필수, 부가 정보는 best-effort.
- **발견일**: 2026-03-08

### [런타임] generate API — "No JSON block found in response"
- **증상**: POST /api/v1/generate/stream 호출 시 `응답 형식 오류: No JSON block found in response` 에러 반환. YAML은 파싱 성공했으나 JSON 메타데이터 블록을 찾지 못함.
- **원인**: raw JSON fallback의 regex `\{[^{}]*"architecture_card".*\}`가 중첩 brace를 포함한 JSON을 매칭하지 못함. `[^{}]*`가 내부 `{}`를 건너뛸 수 없어 실패.
- **해결**: regex 대신 `_find_raw_json()` 헬퍼 추가 — `"architecture_card"` 키워드를 찾고 역방향으로 `{` 탐색 후 brace-balancing으로 정확한 JSON 범위 추출.
- **예방**: 중첩 구조가 있는 JSON/YAML 파싱에 regex 대신 brace-balancing 또는 구조적 파서 사용.
- **발견일**: 2026-03-08
