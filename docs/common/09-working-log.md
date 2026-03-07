# 작업 이력

> 이 문서는 Claude가 개발 과정에서 작성·관리합니다.
> 상단 요약 테이블로 전체 흐름을 파악하고, 하단 상세 로그로 작업 간 맥락을 이어갑니다.

---

## 요약

| 날짜 | 작업 | 상태 |
|------|------|------|
| 2026-03-07 | 프로젝트 Init — README.md, .gitignore 생성, git init, remote push, 07-workplan 초기 태스크 작성 | 완료 |
| 2026-03-07 | T001: Backend 프로젝트 초기화 — Poetry + FastAPI 스켈레톤, 환경변수, 프로젝트 구조 | 완료 |
| 2026-03-07 | T002: Frontend 프로젝트 초기화 — React + Vite + Tailwind + Zustand + Router | 완료 |
| 2026-03-07 | T004: POST /api/v1/analyze — Haiku 기반 동적 질문 생성 엔드포인트 | 완료 |
| 2026-03-07 | T005: POST /api/v1/generate — Sonnet 기반 YAML 생성 + validate-retry 엔드포인트 | 완료 |
| 2026-03-07 | T006: POST /api/v1/finalize — SDwC ZIP 생성 + 스트림 응답 엔드포인트 | 완료 |
| 2026-03-07 | T007: ModeSelectorPage — Simple/Advanced 모드 선택 페이지 | 완료 |
| 2026-03-07 | T008: IntakePage 입력+질문 — TextInput, QuestionCard, Zustand store, API 연동 | 완료 |
| 2026-03-07 | T009: IntakePage 아키텍처 카드+수정 — ArchitectureCard, FeatureChecklist, RevisionInput | 완료 |
| 2026-03-07 | T010: IntakePage ZIP 다운로드 — finalizing/complete phase UI | 완료 |
| 2026-03-07 | T011: E2E 통합 테스트 — Playwright 기반 Simple 모드/Advanced 모드/에러 시나리오 | 완료 |
| 2026-03-07 | T012: 컨테이너화 + CI 파이프라인 — Dockerfile, nginx.conf, GitHub Actions CI | 완료 |

<!-- Claude: §5.8 작업 완료, §5.12 작업 중단/취소 시 한 줄 추가.
     작업 내용은 "무엇을 왜" 중심 1줄 요약.
     상태: 진행중 | 완료 | 중단 | 취소 -->

---

## 상세 로그

<!-- Claude: 작업 완료/중단/취소 시 아래 형식으로 추가.
     한 작업 = 한 엔트리. 세션 구분 불필요.
     "변경된 파일"은 docs/와 코드 모두 포함.
     "미완료/후속"은 다음 작업자(또는 다음 세션의 자신)가 즉시 이어갈 수 있는 수준으로. -->

### 2026-03-07 — 프로젝트 Init

- **작업**: Section 7 Init 수행. 전체 docs/ 확인, skills/ 구조 확인, README.md 생성, .gitignore 생성, git init, 초기 커밋, remote 연결 및 push.
- **변경된 파일**: README.md (신규), .gitignore (신규), 07-workplan.md (태스크 목록 추가 예정)
- **의사결정**: branch 이름을 github_flow 관례에 맞게 `main`으로 설정
- **미완료/후속**: 07-workplan에 초기 태스크 목록 작성 후 승인 대기

### 2026-03-07 — T001: Backend 프로젝트 초기화

- **작업**: Poetry + FastAPI 프로젝트 스켈레톤 생성. pyproject.toml, src/ layout, pydantic-settings config, structlog, 도메인 예외 체계, CORS, /api/v1/health, 테스트 conftest.
- **변경된 파일**: intake-assistant-api/ 전체 (신규), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: src/ layout 사용 (패키지 설치 시 import 경로 명확), structlog의 filtering bound logger에 logging.INFO 사용
- **미완료/후속**: 없음. T002 (Frontend 초기화) 또는 T003 (헬스체크 + SDwC 템플릿 동기화) 진행 가능.

### 2026-03-07 — T002: Frontend 프로젝트 초기화

- **작업**: Vite + React 19 + TypeScript 프로젝트 생성. Tailwind CSS v4, Zustand v5, React Router v7 설정. App/router/providers 구조, ModeSelectorPage·IntakePage 플레이스홀더 페이지, ESLint + Prettier + Vitest 환경 구성.
- **변경된 파일**: intake-assistant-web/ 전체 (신규), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: Tailwind v4 (@tailwindcss/vite 플러그인), path alias `@/` 사용, `src/app/` 하위에 App·router·providers 분리
- **미완료/후속**: 없음. T003~T007 중 선택하여 진행 가능.

### 2026-03-07 — T003: 헬스체크 + SDwC 템플릿 동기화

- **계획**: GET /api/v1/health 엔드포인트 개선 (status + sdwc_reachable), SDwCClient 서비스 모듈, template_cache 모듈, lifespan에서 template fetch, 라우터 분리, 단위 테스트.
- **작업**: HealthResponse 스키마, SDwCClient(httpx 기반), template_cache(모듈 변수), health 라우터 분리, lifespan에 startup fetch + shutdown close 통합. respx로 httpx mock 테스트.
- **변경된 파일**: schemas/health.py, services/sdwc_client.py, services/template_cache.py, routers/health.py (신규), main.py (수정), tests/unit/test_health.py, tests/unit/test_sdwc_client.py (신규), pyproject.toml (respx 추가), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: template_cache를 모듈 변수로 단순 관리 (stateless 서버), respx로 httpx mock
- **미완료/후속**: 없음. T004~T007 중 선택하여 진행 가능.

### 2026-03-07 — T004: POST /api/v1/analyze 구현 (동적 질문 생성)

- **계획**: 사용자 자유 텍스트를 받아 Haiku 호출로 Q1~Q4 동적 질문 + 분석 결과를 반환하는 엔드포인트 구현. schemas/analyze.py, services/prompts/analyze.py, services/analyze_service.py, routers/analyze.py 신규 생성. main.py에 Anthropic client + router 추가. 단위 테스트 작성.
- **작업**: AnalyzeRequest/Response 스키마, 시스템 프롬프트(Korean, JSON output), analyze_service(Haiku 호출 + 3회 exponential backoff), 얇은 라우터, main.py에 AsyncAnthropic lifecycle + router 등록. 서비스 테스트 5개 + API 테스트 5개.
- **변경된 파일**: schemas/analyze.py (신규), services/prompts/__init__.py (신규), services/prompts/analyze.py (신규), services/analyze_service.py (신규), routers/analyze.py (신규), main.py (수정), tests/unit/test_analyze_service.py (신규), tests/unit/test_analyze_api.py (신규), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: PydanticValidationError도 파싱 에러로 캐치하여 ExternalServiceError로 변환 (Anthropic이 잘못된 구조 반환 시)
- **미완료/후속**: 없음. T005(generate) 또는 T007~T008(프론트엔드) 진행 가능.

### 2026-03-07 — T005: POST /api/v1/generate 구현 (YAML 생성 + validate-retry)

- **계획**: 사용자 입력 + Q&A 응답을 기반으로 Sonnet 호출하여 intake_data.yaml 생성. SDwC /api/v1/validate로 검증 + 실패 시 에러 피드백 재생성(최대 2회). 아키텍처 카드 5항목 + 기능 체크리스트 추출. 수정 반복(revision_request + previous_yaml) 지원. SDwCClient.validate_yaml 추가, schemas/generate.py, services/prompts/generate.py, services/generate_service.py, routers/generate.py 신규, main.py 수정, 단위 테스트 작성.
- **작업**: GenerateRequest/Response + ArchitectureCard + FeatureItem 스키마, 시스템 프롬프트(DELETE 원칙, 템플릿 구조 참조, Korean output), generate_service(Sonnet 호출 + 3회 exponential backoff + SDwC validate-retry 최대 3회 시도 + YAML/JSON 블록 파싱), 얇은 라우터, SDwCClient.validate_yaml 추가(POST /api/v1/validate, 10초 타임아웃, ExternalServiceError). 서비스 테스트 7개 + API 테스트 4개 + SDwC 테스트 3개 신규 추가.
- **변경된 파일**: schemas/generate.py (신규), services/prompts/generate.py (신규), services/generate_service.py (신규), routers/generate.py (신규), services/sdwc_client.py (수정), main.py (수정), tests/unit/test_generate_service.py (신규), tests/unit/test_generate_api.py (신규), tests/unit/test_sdwc_client.py (수정), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: YAML/JSON 블록 파싱은 regex로 ```yaml/```json 마커 기반 추출. validate-retry 시 에러 피드백을 JSON 직렬화하여 user message에 포함. 파싱 에러는 즉시 실패(재시도 불가).
- **미완료/후속**: 없음. T006(finalize) 또는 T007~T008(프론트엔드) 진행 가능.

### 2026-03-07 — T006: POST /api/v1/finalize 구현 (ZIP 생성)

- **계획**: SDwCClient.generate_zip 추가(POST /api/v1/generate, 30초 타임아웃, bytes 반환). schemas/finalize.py(FinalizeRequest), routers/finalize.py(StreamingResponse로 ZIP 반환), main.py에 router 등록, 단위 테스트.
- **작업**: FinalizeRequest 스키마(yaml_content min_length=1), finalize 라우터(StreamingResponse + application/zip + Content-Disposition), SDwCClient.generate_zip(POST /api/v1/generate, 30초 타임아웃, ExternalServiceError). API 테스트 4개 + SDwC 테스트 3개.
- **변경된 파일**: schemas/finalize.py (신규), routers/finalize.py (신규), services/sdwc_client.py (수정), main.py (수정), tests/unit/test_finalize_api.py (신규), tests/unit/test_sdwc_client.py (수정), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: 서비스 레이어 불필요 — 라우터에서 직접 SDwCClient.generate_zip 호출 (비즈니스 로직 없음)
- **미완료/후속**: 없음. 백엔드 API 3개 엔드포인트(analyze, generate, finalize) 완성. T007~T010 프론트엔드 진행 가능.

### 2026-03-07 — T007: ModeSelectorPage 구현

- **계획**: ModeCard 컴포넌트 신규, ModeSelectorPage 구현. Simple → /intake 라우팅, Advanced → VITE_SDWC_WEB_URL 리다이렉트. 반응형 레이아웃. .env.example에 VITE_SDWC_WEB_URL 추가.
- **작업**: ModeCard(title/description/target/details + hover효과 + button), ModeSelectorPage(useNavigate + window.location.href), sm:flex-row 반응형 배치. .env.example에 VITE_SDWC_WEB_URL 추가.
- **변경된 파일**: pages/ModeSelectorPage/index.tsx (수정), pages/ModeSelectorPage/ModeCard.tsx (신규), .env.example (수정), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: ModeCard를 button 요소로 구현(접근성), SDWC_WEB_URL 미설정 시 Advanced 클릭해도 아무 동작 안 함(graceful)
- **미완료/후속**: 없음. T008~T010 프론트엔드 태스크 진행 가능.

### 2026-03-07 — T008: IntakePage - 자유 텍스트 입력 + 질문 표시

- **계획**: API 타입 정의, API 클라이언트(analyze 호출), Zustand intake store(전체 IntakePage 상태), TextInput 컴포넌트(textarea + 가이드 힌트 + 분석 버튼), QuestionCard 컴포넌트(single→radio, multi→checkbox), IntakePage(input→analyzing→questions 흐름 + 에러 처리).
- **작업**: api/types.ts(AnalyzeResponse, GenerateResponse, QaAnswer 등 전체 타입), api/client.ts(fetch 기반 analyze/generate/finalize 함수), stores/intakeStore.ts(Zustand store — phase 기반 상태 머신, 전 흐름 액션 포함), TextInput(textarea+placeholder+가이드힌트+분석버튼), QuestionCard(single→radio/multi→checkbox, 선택 시 파란 하이라이트), IntakePage(phase별 조건부 렌더링 — input/analyzing/questions/generating/error).
- **변경된 파일**: api/types.ts (신규), api/client.ts (신규), stores/intakeStore.ts (신규), pages/IntakePage/index.tsx (수정), pages/IntakePage/components/TextInput.tsx (신규), pages/IntakePage/components/QuestionCard.tsx (신규), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: Zustand store에 T009/T010 액션(revision, finalize)도 미리 포함 — 중복 작업 방지. API client는 fetch 기반(axios 불필요). allAnswered 체크로 모든 질문 응답 시에만 '생성하기' 활성화.
- **미완료/후속**: 없음. T009(아키텍처 카드+수정) 진행 시 review/revising phase 컴포넌트만 추가하면 됨.

### 2026-03-07 — T009: IntakePage - 아키텍처 카드 + 수정 반복

- **작업**: ArchitectureCard(5항목 dl/dd, FIELD_ORDER로 순서 보장), FeatureChecklist(체크마크+이름/설명), RevisionInput(textarea+취소/수정반영 버튼). IntakePage에 review phase(카드+체크리스트+'수정 요청'+'이대로 진행'), revising phase(카드+RevisionInput) 추가.
- **변경된 파일**: components/ArchitectureCard.tsx (신규), components/FeatureChecklist.tsx (신규), components/RevisionInput.tsx (신규), pages/IntakePage/index.tsx (수정), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: revising 취소 시 useIntakeStore.setState로 직접 phase 복원 (별도 액션 불필요)
- **미완료/후속**: 없음. T010(ZIP 다운로드) 진행 시 finalizing/complete phase만 추가하면 됨.

### 2026-03-07 — T010: IntakePage - ZIP 다운로드 (finalize 연동)

- **작업**: IntakePage에 finalizing phase(스피너+'ZIP 파일을 생성하고 있습니다'), complete phase(체크 아이콘+완료 메시지+'새 프로젝트 시작' 버튼으로 reset) UI 추가. submitFinalize(Blob 다운로드)와 '이대로 진행' 버튼은 이미 구현 완료.
- **변경된 파일**: pages/IntakePage/index.tsx (수정), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: complete 상태에서 '새 프로젝트 시작' 버튼으로 store reset → input phase로 복귀
- **미완료/후속**: T001~T010 전체 완료. T011(E2E 테스트), T012(컨테이너화+CI) Backlog 상태.

### 2026-03-07 — T011: E2E 통합 테스트

- **작업**: Playwright 설치+설정, chromium 브라우저 설치. page.route() 기반 API 모킹으로 3개 테스트 파일 작성. simple-mode.spec.ts(전체 흐름 3개 — 입력→질문→카드→완료, 수정 반복, 초기화), advanced-mode.spec.ts(리다이렉트+Simple이동 2개), error-scenarios.spec.ts(analyze/generate/finalize 실패+복구 4개). 총 9개 E2E 테스트 통과.
- **변경된 파일**: playwright.config.ts (신규), package.json (수정 — @playwright/test + test:e2e 스크립트), tests/e2e/fixtures.ts (신규), tests/e2e/simple-mode.spec.ts (신규), tests/e2e/advanced-mode.spec.ts (신규), tests/e2e/error-scenarios.spec.ts (신규), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: MSW 대신 Playwright 내장 page.route() 사용 — E2E에서 더 적합. chromium만 사용하여 빠른 실행. webServer로 Vite dev server 자동 시작.
- **미완료/후속**: T012(컨테이너화+CI) Backlog 상태.

### 2026-03-07 — T012: 컨테이너화 + CI 파이프라인

- **계획**: SDwC 프로젝트의 Dockerfile/CI 패턴을 참조하여 intake-assistant-api, intake-assistant-web 각각 2-stage Dockerfile, .dockerignore, GitHub Actions CI 워크플로우 작성. Web은 nginx.conf(SPA fallback + API reverse proxy) 추가.
- **작업**: API Dockerfile(python:3.12-slim builder → runtime, poetry export → pip install, non-root appuser, healthcheck /api/v1/health). Web Dockerfile(node:20-slim builder → nginx:alpine, npm ci → npm run build). nginx.conf(SPA try_files, /assets 캐시, /api/ reverse proxy). ci-api.yml(PR/push path trigger, ruff check + pytest, main push 시 GHCR 이미지 push). ci-web.yml(PR/push path trigger, eslint + npm run build, main push 시 GHCR push). 양쪽 .dockerignore.
- **변경된 파일**: intake-assistant-api/Dockerfile (신규), intake-assistant-api/.dockerignore (신규), intake-assistant-web/Dockerfile (신규), intake-assistant-web/.dockerignore (신규), intake-assistant-web/nginx.conf (신규), .github/workflows/ci-api.yml (신규), .github/workflows/ci-web.yml (신규), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: SDwC 패턴 그대로 따르되, API healthcheck 경로 /api/v1/health로 변경, .sdwc/ COPY 불필요, mypy 제외 (현재 CI에서 미사용), Web CI에서 typecheck/format:check 별도 스크립트 없이 npm run build(tsc -b 포함)로 대체
- **미완료/후속**: T001~T012 전체 완료. 초기 로드맵 태스크 모두 Done.

### 2026-03-07 — T013: SDwC API 연동 수정

- **계획**: sdwc-platform 및 SDwC 프로젝트 분석 후 발견된 API 계약 불일치 수정. (1) sdwc_client.py의 validate_yaml/generate_zip을 multipart file upload으로 변경. (2) generate_service.py의 validate 응답 필드명 `success`→`valid`, `error`→`errors`로 변경. (3) 단위 테스트 업데이트.
- **작업**: sdwc_client.py — json= 파라미터를 files={"file": ("intake_data.yaml", content.encode(), "application/x-yaml")}로 변경 (validate_yaml, generate_zip 두 메서드). generate_service.py — validate_result.get("success")→"valid", validate_result.get("error",{})→"errors",[]. test_sdwc_client.py, test_generate_service.py, test_generate_api.py — mock 응답을 SDwC 실제 ValidationResponse 스키마(valid/errors/warnings)로 변경.
- **변경된 파일**: services/sdwc_client.py (수정), services/generate_service.py (수정), tests/unit/test_sdwc_client.py (수정), tests/unit/test_generate_service.py (수정), tests/unit/test_generate_api.py (수정), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: SDwC API 소스(routers/intake.py)에서 UploadFile 파라미터 + ValidationResponse(valid/errors/warnings) 스키마 확인 후 수정
- **미완료/후속**: T014(인프라 매니페스트 커밋) Ready 상태.

### 2026-03-07 — T014: 인프라 매니페스트 커밋

- **계획**: sdwc-platform-infra-guide에 따라 수동 생성된 infra/ K8s 매니페스트와 config.py 기본값 변경을 커밋.
- **작업**: 기존 수동 생성된 infra/ 디렉토리와 config.py 변경을 feature branch에서 커밋.
- **변경된 파일**: infra/intake-assistant-api/deployment.yaml (신규), infra/intake-assistant-web/deployment.yaml (신규), intake-assistant-api/src/intake_assistant_api/core/config.py (수정), 07-workplan.md, 09-working-log.md, 10-changelog.md
- **의사결정**: sdwc-platform-infra-guide 지시대로 config.py 기본값을 K8s 내부 DNS로 변경. 로컬 개발은 .env 오버라이드.
- **미완료/후속**: 없음. T013~T014 완료.
