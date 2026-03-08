# Changelog

> 이 문서는 Claude가 릴리스 시마다 작성·관리합니다.

---

## [Unreleased]

### Fixed
- intake-assistant-web: Advanced 모드 폼 입력 불가 수정 — FormField/ArrayItemCard가 Zustand store의 getField 함수 참조만 구독하여 formData 변경 시 re-render되지 않던 문제 해결
- intake-assistant-web: AI 추천 실패 시 에러 피드백 추가 — 기존 silent catch에서 "추천 실패" 메시지 + console.error로 변경
- intake-assistant-web: ZIP 다운로드 파일명을 프로젝트 이름으로 변경 — Simple 모드(YAML에서 project_name 추출) + Advanced 모드(formData.project.name 사용), fallback "project.zip"

### Added
- intake-assistant-web: Simple 모드에 "모드 선택으로 돌아가기" 버튼 추가 — Advanced 모드와 동일한 위치/스타일

### Added
- intake-assistant-api: POST /api/v1/recommend 엔드포인트 — Haiku 기반 개별 필드 AI 추천 (context + field_path → suggestion + rationale), 2회 재시도, 단위 테스트 11개 (T036)
- intake-assistant-api: POST /api/v1/validate-yaml 엔드포인트 — SDwC 스키마 YAML 검증 프록시 (T035)
- intake-assistant-web: Advanced 모드 8단계 위저드 폼 — phaseSchema(150+ 필드), advancedStore, StepWizard, PhaseRenderer, FormField, ArrayField, ServiceEditor, 검증, YAML 직렬화, ZIP 제출 (T031-T035)
- intake-assistant-web: AiRecommendButton 컴포넌트 — FormField에 aiRecommend 플래그 기반 AI 추천 버튼 통합, advancedStore.requestRecommendation() 액션 (T037)

### Changed
- intake-assistant-web: ModeSelectorPage Advanced 모드를 sdwc-web 리다이렉트에서 내장 /advanced 라우트로 변경 (T031)
- docs: 01-requirements.md — Advanced 모드를 non-goals에서 in-scope로 이동 (T031)
- docs: 21-api-contract.md — validate-yaml + recommend 엔드포인트 문서 추가 (T035, T036)

### Added
- intake-assistant-api: prompt_builder.py 모듈 — SDwC field_requirements.yaml을 동적 파싱하여 generate 프롬프트의 Required Sections, Per-Service Fields, Array Minimums, Enum Reference 자동 생성 (T030)
- intake-assistant-api: SDwCClient.fetch_field_requirements() — GET /api/v1/field-requirements에서 field_requirements.yaml fetch (T030)
- intake-assistant-api: template_cache에 field_requirements 캐시 추가 — startup 시 fetch + 캐시 (T030)

### Documentation
- README.md를 현재 상태로 동기화 — 모드별(Simple/Advanced) 설명 분리, 동적 질문 5~6개 자유 텍스트 반영, SSE 스트리밍 엔드포인트 추가, 주요 기능(SSE/Prompt Caching/동적 프롬프트/Rate Limiting/Sanitization) 섹션 추가

### Changed
- intake-assistant-api: generate.py를 static header/dynamic sections/fallback/footer로 분리 — build_system_prompt(template, field_requirements) 시그니처 변경 (T030)
- intake-assistant-api: generate_service.py에서 field_requirements를 build_system_prompt에 전달 (T030)
- intake-assistant-api: Anthropic API 재시도 횟수 3→2회로 축소 (analyze_service, generate_service), backoff [1,2,4]→[1,2] (T029)
- intake-assistant-api: generate 시스템 프롬프트를 field_requirements.yaml 기반으로 전면 보정 — Per-Service Type Required Fields 섹션 신설, 누락 required 필드/enum/array minimum 추가, kotlin→kotlin_mobile 수정, worker/data_pipeline/deployment 등 30+ enum 추가 (T029)
- intake-assistant-api: 객관식 질문(3~4개, single/multi select)을 자유 텍스트 질문(5~6개, open-ended)으로 변경 — Choice 클래스 삭제, Question 단순화(placeholder 추가), QaAnswer.selected_ids→answer, analyze/generate 프롬프트 재작성 (T028)
- intake-assistant-web: QuestionCard를 radio/checkbox에서 textarea 기반으로 전환, intakeStore answers 타입을 Record<string, string>으로 변경, E2E 테스트를 textarea.fill()로 전환 (T028)

### Fixed
- intake-assistant-web: Simple 모드 설명 "3~4개 핵심 질문에 답변" → "몇 가지 질문에 자유롭게 답변"으로 수정 — T028 자유 텍스트 전환 반영
- intake-assistant-web: Advanced 모드 버튼 클릭 시 VITE_SDWC_WEB_URL 미설정이면 안내 alert 표시 — 기존에는 무반응
- intake-assistant-api: generate API JSON 메타데이터 블록을 optional로 변경 — JSON 블록 누락/파싱 실패 시 기본 메타데이터 fallback 적용, "No JSON block found" 오류 완전 해소
- intake-assistant-api: generate API JSON 파싱 강화 — brace-balancing 기반 _find_raw_json() fallback으로 raw JSON 감지 개선
- intake-assistant-api: generate API YAML/JSON 파싱 강화 — 코드 펜스 없이 반환된 raw YAML/JSON fallback 추가, "No YAML block found" 오류 감소
- intake-assistant-api: analyze API의 inferred_hints 타입을 dict[str, Any]로 변경 — Haiku가 bool 값을 반환할 때 Pydantic 검증 실패 수정

### Added
- intake-assistant-api: IP 기반 rate limiting 미들웨어 — sliding window 방식 20req/60s, 429 + Retry-After 응답, /health 제외 (T026)
- intake-assistant-api: 입력 텍스트 sanitization — HTML 태그 제거, 과도한 공백/개행 축소, whitespace-only 입력 거부 (T026)
- intake-assistant-web: Error Recovery UX — 에러 발생 시 errorSource별 재시도 버튼(분석 재시도/생성 재시도/다시 시도) 추가, 기존 "처음부터 다시 시작" 버튼도 유지, E2E 재시도 성공 테스트 2개 추가 (T025)

### Changed
- intake-assistant-web: Playwright E2E 테스트를 SSE 스트리밍 API 모킹으로 전환 — fixtures.ts SSE 응답 빌더, simple-mode/error-scenarios 테스트 업데이트, 스트리밍 진행 상태 검증 테스트 추가, 총 11개 E2E 통과 (T024)
- intake-assistant-api: generate 시스템 프롬프트 강화 — enum 값 치트시트, 필수 섹션 체크리스트, 배열 최소 요건, 교차 참조 규칙, 흔한 실수 예시 추가로 SDwC validation 첫 시도 통과율 향상 (T023)

### Added
- intake-assistant-api: POST /api/v1/analyze/stream SSE 스트리밍 엔드포인트 — 분석 중 LLM 응답 실시간 전달, 진행 상태(analyzing) SSE 이벤트 (T022)
- intake-assistant-web: 분석 중 실시간 진행 상태 표시 — SSE 스트리밍으로 동적 상태 텍스트 표시 (T022)
- intake-assistant-api: POST /api/v1/generate/stream SSE 스트리밍 엔드포인트 — LLM 응답 실시간 전달, 진행 상태(generating/validating/retry) SSE 이벤트 (T021)
- intake-assistant-api: generate 시스템 프롬프트에 prompt caching 적용 (cache_control: ephemeral) — validate-retry 재시도 및 수정 요청 시 캐시 활용 (T020)
- intake-assistant-web: 생성 중 실시간 진행 상태 표시 — SSE 스트리밍으로 동적 상태 텍스트 + 재시도 횟수 표시 (T021)
- intake-assistant-api: Poetry 프로젝트 초기화 + FastAPI 앱 스켈레톤 (T001)
- intake-assistant-web: Vite + React + TypeScript 프로젝트 초기화, Tailwind·Zustand·Router 설정 (T002)
- intake-assistant-api: 헬스체크 엔드포인트 개선 (healthy/degraded + sdwc_reachable), SDwC 템플릿 fetch + 메모리 캐시 (T003)
- intake-assistant-api: POST /api/v1/analyze 엔드포인트 — Haiku 기반 동적 질문 생성, exponential backoff 재시도, Pydantic 입력 검증 (T004)
- intake-assistant-api: POST /api/v1/generate 엔드포인트 — Sonnet 기반 intake_data.yaml 생성, SDwC validate-retry(최대 3회), 아키텍처 카드 + 기능 체크리스트 추출, 수정 반복 지원 (T005)
- intake-assistant-api: POST /api/v1/finalize 엔드포인트 — SDwC ZIP 생성 + StreamingResponse 바이너리 응답 (T006)
- intake-assistant-web: ModeSelectorPage — Simple/Advanced 모드 선택, ModeCard 컴포넌트, 반응형 레이아웃 (T007)
- intake-assistant-web: IntakePage 입력+질문 — TextInput, QuestionCard, Zustand store, API 클라이언트 (T008)
- intake-assistant-web: IntakePage 아키텍처 카드+수정 — ArchitectureCard, FeatureChecklist, RevisionInput (T009)
- intake-assistant-web: IntakePage ZIP 다운로드 — finalizing/complete phase UI (T010)
- intake-assistant-web: Playwright E2E 테스트 — Simple 모드 전체 흐름(3개), Advanced 모드 리다이렉트(2개), 에러 시나리오(4개), 총 9개 테스트 (T011)
- intake-assistant-api: Dockerfile (2-stage, python:3.12-slim, non-root user, healthcheck) + .dockerignore (T012)
- intake-assistant-web: Dockerfile (2-stage, node:20-slim → nginx:alpine) + nginx.conf (SPA fallback, API reverse proxy) + .dockerignore (T012)
- CI: GitHub Actions 워크플로우 — ci-api.yml (ruff + pytest + GHCR push), ci-web.yml (eslint + build + GHCR push) (T012)

### Changed
- intake-assistant-api: config.py sdwc_api_url 기본값을 K8s 내부 DNS(`sdwc-api.sdwc.svc.cluster.local:8000`)로 변경 (T014)
- intake-assistant-api: .env.example SDWC_API_URL을 `http://sdwc.local:8080`으로 수정 + 환경별 가이드 주석 추가 (T016)

### Fixed
- intake-assistant-api: SDwC API 연동 — JSON body → multipart file upload으로 변경 (validate, generate 엔드포인트), validate 응답 필드명 `success`→`valid`, `error`→`errors`로 수정 (T013)
- intake-assistant-web: API URL fallback을 빈 문자열로 변경 — k3d 환경에서 ERR_CONNECTION_REFUSED 해결 (T017)
- intake-assistant-api: analyze API 응답에서 markdown 코드 블록 스트리핑 추가 — Haiku가 JSON을 코드 블록으로 감쌀 때 파싱 실패 수정 (T018)
- intake-assistant-api: generate API YAML/JSON 파싱을 유연화 — 언어 태그 없는 코드 블록 fallback 처리 (T019)

### Removed
- infra/ 디렉토리 삭제 — K8s 매니페스트를 sdwc-platform 레포(manifests/intake/)로 이관하여 중앙 관리 (T015)

### Infrastructure
- intake-assistant-api: K8s Deployment + ClusterIP Service 매니페스트 추가 (SDWC_API_URL env, ANTHROPIC_API_KEY secret, liveness/readiness probes) (T014) → sdwc-platform으로 이관 (T015)
- intake-assistant-web: K8s Deployment + ClusterIP Service 매니페스트 추가 (T014) → sdwc-platform으로 이관 (T015)

<!-- Claude: §5.8 작업 완료 시 해당 변경을 [Unreleased]에 기록.
     분류 기준:
     - Added: 새 기능, 새 엔드포인트, 새 엔티티
     - Changed: 기존 동작 변경, 리팩터링
     - Fixed: 버그 수정
     - Removed: 기능/코드 삭제
     한 줄에 "무엇이 어떻게 변했는가"만 간결하게.
     릴리스 시 [Unreleased]를 버전 번호로 전환.
     형식: ## [X.Y.Z] - YYYY-MM-DD -->
