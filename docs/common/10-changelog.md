# Changelog

> 이 문서는 Claude가 릴리스 시마다 작성·관리합니다.

---

## [Unreleased]

### Changed
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
