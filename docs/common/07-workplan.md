# Work Plan

> This document is the single source of truth (SSOT) for project tasks.
> AI proposes tasks, and they are reflected after user approval.

## Operating Rules

- WIP Limit: 2
- Status transitions require user approval.
- History must not be deleted.

## Status Flow

```
Backlog -> Ready -> In Progress -> Review -> Done
                        |    ^
                        v    |
                      Paused

Any active status -> Cancelled
```

- **Paused**: task is temporarily stopped. Only from In Progress.
- **Cancelled**: task is abandoned. Record reason in Result.

## Task Format

```
### T<NNN>: <title>
- Status: Backlog | Ready | In Progress | Review | Paused | Cancelled | Done
- Service: <service name>
- Origin: T<NNN> (optional, when derived from another task)
- Description: <description>
- Acceptance Criteria:
  - [ ] <criterion 1>
  - [ ] <criterion 2>
- Result: (recorded after completion)
```

### Origin Rules

- Record when a task is derived from issues found in another task's Result.
- Omit Origin for initial tasks.

### Result Rules

- Result must be recorded when Status becomes Done or Cancelled.
- All Acceptance Criteria items must be checked before transitioning to Done.
- If some items are split into other tasks, mark as "deferred to T<NNN>" on the original item.
- Include: created files, test results, discovered issues.
- Record issues resolved within the task as well.
- Issues exceeding 30 minutes should be split into a new task.
- Out-of-scope issues move to docs/common/05-roadmap.md.

---

## Tasks

### T001: Backend 프로젝트 초기화 (FastAPI + Poetry)
- Status: Done
- Service: intake-assistant-api
- Description: Poetry 프로젝트 생성, FastAPI 앱 스켈레톤, 환경 변수 설정(ANTHROPIC_API_KEY, SDWC_API_URL), 기본 프로젝트 구조(app/main.py, app/config.py 등) 구성
- Acceptance Criteria:
  - [x] poetry init + pyproject.toml에 핵심 의존성(fastapi, uvicorn, anthropic, httpx, pyyaml, pydantic) 추가
  - [x] `uvicorn app.main:app --reload`로 서버 기동 확인
  - [x] 환경 변수 로딩 구조 (pydantic Settings)
  - [x] 프로젝트 디렉토리 구조 생성
- Result: Poetry 프로젝트 생성 완료. FastAPI 앱 스켈레톤 (lifespan, CORS, 글로벌 예외 핸들러), pydantic-settings 기반 config, structlog 설정, /api/v1/health 엔드포인트, 도메인 예외 체계, 테스트 conftest. ruff 린트 통과.

---

### T002: Frontend 프로젝트 초기화 (React + Vite + Tailwind)
- Status: Done
- Service: intake-assistant-web
- Description: Vite + React + TypeScript 프로젝트 생성, Tailwind CSS 설정, Zustand 설치, 기본 라우팅(ModeSelectorPage, IntakePage) 구조 설정
- Acceptance Criteria:
  - [x] `npm create vite` + React + TypeScript 템플릿
  - [x] Tailwind CSS 설정 완료
  - [x] Zustand 설치
  - [x] React Router로 `/` (ModeSelectorPage) + `/intake` (IntakePage) 라우팅
  - [x] `npm run dev`로 개발 서버 기동 확인
- Result: Vite + React 19 + TypeScript 프로젝트 생성 완료. Tailwind CSS v4 (@tailwindcss/vite), Zustand v5, React Router v7 설정. App/router/providers 구조, ModeSelectorPage·IntakePage 플레이스홀더, ESLint + Prettier + Vitest 설정. 빌드·lint 통과.

---

### T003: 헬스체크 + SDwC 템플릿 동기화
- Status: Done
- Service: intake-assistant-api
- Description: GET /api/v1/health 엔드포인트 구현. 앱 시작 시 SDwC /api/v1/template에서 최신 intake_template.yaml을 수신하여 메모리 캐시에 저장.
- Acceptance Criteria:
  - [x] GET /api/v1/health → status, sdwc_reachable 응답
  - [x] 앱 시작 시 SDwC 템플릿 fetch + 메모리 캐시
  - [x] SDwC 접속 불가 시 degraded 상태 반환
  - [x] 단위 테스트
- Result: HealthResponse 스키마, SDwCClient 서비스, template_cache 모듈, health 라우터 분리. lifespan에서 SDwC 템플릿 fetch + 캐시. respx 기반 단위 테스트 5개 통과. ruff lint/format 통과.

---

### T004: POST /api/v1/analyze 구현 (동적 질문 생성)
- Status: Done
- Service: intake-assistant-api
- Description: 사용자 자유 텍스트를 받아 Haiku를 호출하여 Q1~Q4 동적 질문 + 분석 결과를 반환하는 엔드포인트 구현.
- Acceptance Criteria:
  - [x] POST /api/v1/analyze → questions + analysis 응답
  - [x] Anthropic Haiku 호출 + 시스템 프롬프트 작성
  - [x] 입력 텍스트 길이 제한 (Pydantic validation)
  - [x] Anthropic API 실패 시 재시도 로직 (3회)
  - [x] 단위 테스트 (mock Anthropic 응답)
- Result: schemas/analyze.py, services/prompts/analyze.py, services/analyze_service.py, routers/analyze.py 신규 생성. main.py에 AsyncAnthropic client lifecycle + analyze router 추가. Haiku 호출 + exponential backoff 재시도(3회). Pydantic validation(1~5000자). 단위 테스트 10개(서비스 5 + API 5) 전체 통과. ruff lint/format 통과.

---

### T005: POST /api/v1/generate 구현 (YAML 생성 + validate-retry)
- Status: Done
- Service: intake-assistant-api
- Description: 사용자 입력 + Q&A 응답을 기반으로 Sonnet을 호출하여 intake_data.yaml을 생성. SDwC /validate로 검증하고, 실패 시 에러 피드백으로 재생성 (최대 2회). 아키텍처 카드 5항목 + 기능 체크리스트 추출.
- Acceptance Criteria:
  - [x] POST /api/v1/generate → yaml_content + architecture_card + feature_checklist 응답
  - [x] Anthropic Sonnet 호출 + 시스템 프롬프트 (DELETE 원칙, 템플릿 구조 포함)
  - [x] SDwC /api/v1/validate 호출로 YAML 검증
  - [x] validate-retry 루프 (최대 2회 재시도)
  - [x] 수정 반복 지원 (revision_request + previous_yaml 파라미터)
  - [x] 단위 테스트 (mock Anthropic + SDwC 응답)
- Result: schemas/generate.py, services/prompts/generate.py, services/generate_service.py, routers/generate.py 신규 생성. services/sdwc_client.py에 validate_yaml 추가. main.py에 generate router 등록. Sonnet 호출 + exponential backoff 재시도(3회) + SDwC validate-retry(최대 3회 시도). 단위 테스트 14개(서비스 7 + API 4 + SDwC 3) 신규 추가, 전체 29개 통과. ruff lint/format 통과.

---

### T006: POST /api/v1/finalize 구현 (ZIP 생성)
- Status: Done
- Service: intake-assistant-api
- Description: 확정된 YAML을 SDwC /api/v1/generate에 전달하여 ZIP 파일을 받아 클라이언트에 스트림 응답.
- Acceptance Criteria:
  - [x] POST /api/v1/finalize → ZIP 바이너리 스트림 응답
  - [x] SDwC /api/v1/generate 호출
  - [x] 30초 타임아웃 설정
  - [x] 에러 시 적절한 에러 응답
  - [x] 단위 테스트
- Result: schemas/finalize.py, routers/finalize.py 신규 생성. SDwCClient.generate_zip 추가(30초 타임아웃). main.py에 finalize router 등록. StreamingResponse로 ZIP 바이너리 반환. 단위 테스트 7개(API 4 + SDwC 3) 신규 추가, 전체 36개 통과. ruff lint/format 통과.

---

### T007: ModeSelectorPage 구현
- Status: Done
- Service: intake-assistant-web
- Description: Simple/Advanced 모드 선택 페이지. ModeCard 컴포넌트로 각 모드 설명 표시. Simple → /intake, Advanced → sdwc-web 리다이렉트.
- Acceptance Criteria:
  - [x] ModeCard 컴포넌트 (모드 설명, 대상, 차이점)
  - [x] Simple 선택 → /intake 라우팅
  - [x] Advanced 선택 → sdwc-web URL 리다이렉트 (환경 변수)
  - [x] 반응형 레이아웃
- Result: ModeCard 컴포넌트 신규(title, description, target, details props + hover 효과). ModeSelectorPage에서 Simple→navigate("/intake"), Advanced→VITE_SDWC_WEB_URL 리다이렉트. sm: breakpoint에서 가로 배치. .env.example에 VITE_SDWC_WEB_URL 추가. ESLint + TypeScript 빌드 통과.

---

### T008: IntakePage - 자유 텍스트 입력 + 질문 표시
- Status: Done
- Service: intake-assistant-web
- Description: TextInput 컴포넌트로 자유 텍스트 입력, '분석' 버튼 클릭 시 /api/v1/analyze 호출, QuestionCard로 Q1~Q4 동적 질문 표시 및 응답 수집.
- Acceptance Criteria:
  - [x] TextInput 컴포넌트 (가이드 힌트 포함)
  - [x] /api/v1/analyze API 호출 + 로딩 상태
  - [x] QuestionCard 컴포넌트 (선택지 라디오/체크박스)
  - [x] Zustand store로 대화 상태 관리
  - [x] 에러 상태 처리
- Result: api/types.ts(전체 API 타입), api/client.ts(analyze/generate/finalize), stores/intakeStore.ts(Zustand, 전체 IntakePage 상태+액션), TextInput(textarea+가이드힌트+분석버튼), QuestionCard(single→radio, multi→checkbox, 선택 하이라이트). IntakePage에서 input→analyzing→questions→generating+error 흐름 구현. ESLint + 빌드 통과.

---

### T009: IntakePage - 아키텍처 카드 + 수정 반복
- Status: Done
- Service: intake-assistant-web
- Description: Q&A 응답 완료 후 /api/v1/generate 호출. ArchitectureCard(5항목) + FeatureChecklist 표시. RevisionInput으로 수정 요청 → 전체 재생성 반복.
- Acceptance Criteria:
  - [x] /api/v1/generate API 호출 + 로딩 상태
  - [x] ArchitectureCard 컴포넌트 (서비스 구성, 데이터 저장, 인증, 외부 서비스, 화면 수)
  - [x] FeatureChecklist 컴포넌트 (읽기 전용)
  - [x] RevisionInput 컴포넌트 + 수정 요청 시 재생성
  - [x] 에러 상태 처리
- Result: ArchitectureCard(5항목 dl/dd 표시), FeatureChecklist(체크 아이콘 + 이름/설명), RevisionInput(textarea + 수정반영/취소 버튼) 컴포넌트 신규. IntakePage에 review/revising phase 추가 + '수정 요청'/'이대로 진행' 버튼. ESLint + 빌드 통과.

---

### T010: IntakePage - ZIP 다운로드 (finalize 연동)
- Status: Done
- Service: intake-assistant-web
- Description: '이대로 진행' 버튼 클릭 시 /api/v1/finalize 호출 → ZIP 파일 브라우저 다운로드. complete 상태 표시.
- Acceptance Criteria:
  - [x] '이대로 진행' 버튼 + /api/v1/finalize API 호출
  - [x] ZIP 바이너리 다운로드 처리 (Blob + download)
  - [x] finalizing 로딩 상태 + complete 상태
  - [x] 에러 시 재시도 안내
- Result: IntakePage에 finalizing(스피너) + complete(체크 아이콘+완료 메시지+'새 프로젝트 시작' 버튼) phase UI 추가. '이대로 진행' 버튼은 T009에서 이미 submitFinalize 연결 완료. Blob 다운로드는 T008 store에서 구현 완료. ESLint + 빌드 통과.

---

### T011: E2E 통합 테스트
- Status: Done
- Service: intake-assistant-api, intake-assistant-web
- Description: Playwright로 전체 흐름 E2E 테스트. 텍스트 입력 → 질문 응답 → 카드 확인 → ZIP 다운로드.
- Acceptance Criteria:
  - [x] 전체 Simple 모드 흐름 E2E 테스트
  - [x] Advanced 모드 리다이렉트 테스트
  - [x] 에러 시나리오 테스트 (API 실패, SDwC 불가)
- Result: Playwright 설치+설정(chromium only, webServer 자동 시작). page.route() 기반 API 모킹. simple-mode.spec.ts(3개 — 전체 흐름/수정 반복/초기화), advanced-mode.spec.ts(2개 — 리다이렉트/Simple 이동), error-scenarios.spec.ts(4개 — analyze/generate/finalize 실패+복구). 총 9개 E2E 테스트 통과. ESLint + 빌드 통과.

---

### T012: 컨테이너화 + CI 파이프라인
- Status: Done
- Service: intake-assistant-api, intake-assistant-web
- Description: 각 서비스 Dockerfile 작성, GitHub Actions CI 파이프라인 구성 (lint, test, build).
- Acceptance Criteria:
  - [x] intake-assistant-api Dockerfile
  - [x] intake-assistant-web Dockerfile
  - [x] GitHub Actions 워크플로우 (lint + test + build)
  - [x] GHCR 이미지 push
- Result: 2-stage Dockerfile (API: python:3.12-slim + non-root user, Web: node:20-slim → nginx:alpine), .dockerignore, nginx.conf (SPA fallback + API reverse proxy), ci-api.yml (ruff + pytest + GHCR push), ci-web.yml (eslint + tsc+build + GHCR push). Docker build 검증 완료.

### T013: SDwC API 연동 수정 (multipart upload + response 필드)
- Status: Done
- Service: intake-assistant-api
- Origin: T005, T006
- Description: SDwC API가 multipart/form-data file upload을 기대하지만 sdwc_client.py가 JSON body를 전송하는 문제 수정. validate 응답 필드명 불일치(`success`→`valid`, `error`→`errors`) 수정. 단위 테스트 반영.
- Acceptance Criteria:
  - [x] sdwc_client.validate_yaml — multipart file upload으로 변경
  - [x] sdwc_client.generate_zip — multipart file upload으로 변경
  - [x] generate_service.py — validate 응답 필드 `valid`/`errors` 사용으로 변경
  - [x] 단위 테스트 업데이트 (multipart 요청 mock + 응답 필드 반영)
  - [x] 기존 테스트 전체 통과
- Result: sdwc_client.py의 validate_yaml/generate_zip을 files= multipart upload으로 변경. generate_service.py의 validate 응답 필드 valid/errors로 수정. 테스트 3개 파일(test_sdwc_client.py, test_generate_service.py, test_generate_api.py) 업데이트. ruff lint/format 통과. 전체 36개 테스트 통과.

---

### T014: 인프라 매니페스트 커밋 (infra/ + config.py)
- Status: Done
- Service: intake-assistant-api, intake-assistant-web
- Description: sdwc-platform-infra-guide에 따라 수동 생성된 infra/ K8s 매니페스트와 config.py 기본값 변경을 커밋. infra/intake-assistant-api/deployment.yaml, infra/intake-assistant-web/deployment.yaml, config.py sdwc_api_url 기본값 K8s 내부 DNS로 변경.
- Acceptance Criteria:
  - [x] infra/intake-assistant-api/deployment.yaml 커밋
  - [x] infra/intake-assistant-web/deployment.yaml 커밋
  - [x] config.py sdwc_api_url 기본값 변경 커밋
  - [x] 10-changelog 기록
- Result: infra/ 디렉토리(API Deployment+Service, Web Deployment+Service) 및 config.py 기본값 변경 커밋. sdwc-platform-infra-guide 섹션 3-3, 3-4 완료.

---

### T015: infra/ 매니페스트를 sdwc-platform으로 이관
- Status: Done
- Service: intake-assistant-api, intake-assistant-web
- Origin: T014
- Description: intake-assistant의 infra/ K8s 매니페스트를 sdwc-platform/manifests/intake/로 이관. 모든 인프라/배포 설정은 sdwc-platform 레포에서 중앙 관리하는 패턴 통일. intake-assistant에서 infra/ 삭제. sdwc-platform의 deploy-all.sh, ArgoCD 설정 업데이트.
- Acceptance Criteria:
  - [x] sdwc-platform/manifests/intake/ 에 매니페스트 이동
  - [x] sdwc-platform deploy-all.sh — intake 매니페스트 경로 변경
  - [x] sdwc-platform argocd/intake-app.yaml — source를 sdwc-platform 레포로 변경
  - [x] intake-assistant infra/ 삭제
  - [x] intake-assistant README.md에서 infra/ 제거
  - [x] intake-assistant 10-changelog 기록
- Result: sdwc-platform에 manifests/intake/ 생성 및 매니페스트 이동, deploy-all.sh 경로 변경, ArgoCD intake-app.yaml source를 sdwc-platform 레포로 변경, sdwc-platform 커밋+푸시 완료. intake-assistant에서 infra/ 삭제, README/changelog 업데이트.

---

### T016: .env.example 수정 (SDWC_API_URL 값 보정)
- Status: Done
- Service: intake-assistant-api
- Description: .env.example의 SDWC_API_URL이 http://localhost:8080으로 되어 있으나, k3d 로컬 배포 시 Traefik Host 기반 라우팅으로 인해 http://sdwc.local:8080이 올바른 값. 환경별 가이드 주석도 추가.
- Acceptance Criteria:
  - [x] .env.example의 SDWC_API_URL → http://sdwc.local:8080 변경
  - [x] 환경별 SDWC_API_URL 주석 추가
  - [x] 10-changelog 기록
- Result: .env.example의 SDWC_API_URL을 http://sdwc.local:8080으로 수정. K8s/k3d/direct 3가지 환경별 URL 주석 추가. README.md 환경 변수 섹션도 이전에 업데이트 완료.

---

### T017: Frontend API URL fallback 수정 (k3d 환경 대응)
- Status: Done
- Service: intake-assistant-web
- Origin: T016
- Description: client.ts의 VITE_API_URL fallback이 http://localhost:8000이라 k3d 환경에서 브라우저가 직접 localhost:8000에 요청하여 ERR_CONNECTION_REFUSED 발생. fallback을 빈 문자열("")로 변경하여 상대 경로로 요청하면 nginx가 /api/를 backend로 프록시.
- Acceptance Criteria:
  - [x] client.ts의 API_URL fallback → "" (빈 문자열)
  - [x] .env.example 주석으로 로컬 개발 시 설정 안내
  - [x] 10-changelog 기록
- Result: client.ts fallback을 ""로 변경. k3d에서는 상대 경로(/api/v1/...)로 요청하여 nginx 프록시 경유. 로컬 dev는 .env에서 VITE_API_URL=http://localhost:8000 설정.

---

### T018: analyze API 응답 JSON 파싱 오류 수정
- Status: Done
- Service: intake-assistant-api
- Origin: T004
- Description: Anthropic Haiku가 JSON을 markdown 코드 블록(```json ... ```)으로 감싸서 반환하는 경우 json.loads() 파싱 실패 (500 에러). generate_service.py에는 이미 코드 블록 스트리핑 로직이 있으나 analyze_service.py에는 누락.
- Acceptance Criteria:
  - [x] analyze_service.py에 markdown 코드 블록 스트리핑 추가
  - [x] 단위 테스트 추가 (코드 블록 감싸진 응답 케이스)
  - [x] 10-changelog 기록
- Result: analyze_service.py에 regex 기반 코드 블록 스트리핑 추가 (```json 및 ``` 모두 처리). 단위 테스트 2개 추가, 전체 7개 통과.

---

### T019: generate API YAML 파싱 오류 수정
- Status: Done
- Service: intake-assistant-api
- Origin: T005
- Description: Sonnet이 YAML을 ```yaml 코드 블록 없이 반환하거나, ``` 언어 태그 없이 반환하는 경우 _parse_response()가 "No YAML block found" 에러 발생. 코드 블록 감지 패턴을 유연하게 확장.
- Acceptance Criteria:
  - [x] _parse_response()에서 언어 태그 없는 코드 블록도 처리
  - [x] 코드 블록 없이 YAML/JSON이 반환된 경우 fallback 처리
  - [x] 단위 테스트 추가
  - [x] 10-changelog 기록
- Result: _extract_block() 헬퍼 추가. 언어 태그 우선 매칭 후 untagged 코드 블록 fallback (YAML은 project_name:/project: 시작, JSON은 { 시작으로 판별). 단위 테스트 2개 추가, 전체 9개 통과.

---

### T020: Prompt Caching (generate 시스템 프롬프트)
- Status: Done
- Service: intake-assistant-api
- Description: generate API의 Anthropic 호출 시 시스템 프롬프트에 cache_control: ephemeral을 적용하여 validate-retry 루프 내 재시도 및 5분 이내 수정 요청 시 프롬프트 캐싱 활용.
- Acceptance Criteria:
  - [x] _call_anthropic()의 system 파라미터를 cache_control 포함 리스트 형식으로 변경
  - [x] 단위 테스트에서 system arg가 cache_control을 포함하는지 검증
- Result: _call_anthropic()의 system 파라미터를 `[{"type": "text", "text": ..., "cache_control": {"type": "ephemeral"}}]` 형식으로 변경. generate_stream()에도 동일 적용. 단위 테스트 1개 추가, 전체 46개 통과.

---

### T021: Streaming Generate Endpoint (실시간 진행 상태)
- Status: Done
- Service: intake-assistant-api, intake-assistant-web
- Description: POST /api/v1/generate/stream SSE 스트리밍 엔드포인트 추가. 프론트엔드에서 generateStream() 함수로 실시간 진행 상태(generating, validating, retry) 표시. 기존 /generate 엔드포인트는 하위 호환 유지.
- Acceptance Criteria:
  - [x] generate_service.py에 generate_stream() + _sse_event() 추가
  - [x] routers/generate.py에 POST /generate/stream 엔드포인트 추가
  - [x] api/client.ts에 generateStream() 함수 추가 (ReadableStream SSE 파싱)
  - [x] api/types.ts에 SSE 이벤트 타입 추가
  - [x] stores/intakeStore.ts에 streamStatus/streamAttempt 상태 추가 + submitGenerate/submitRevision 스트리밍 전환
  - [x] IntakePage generating phase에 동적 상태 텍스트 + 시도 횟수 표시
  - [x] 스트리밍 단위 테스트 (성공/재시도/파싱에러/API에러)
  - [x] API 테스트 (text/event-stream 응답 확인)
  - [x] 기존 테스트 전체 통과
  - [x] 21-api-contract.md에 스트리밍 엔드포인트 사양 추가
- Result: Backend: generate_stream() AsyncGenerator + _sse_event() 헬퍼 + POST /generate/stream StreamingResponse 엔드포인트. Frontend: generateStream() (fetch + ReadableStream SSE 파싱) + SSE 타입 4종 + intakeStore 스트리밍 상태 + IntakePage 동적 진행 텍스트. 테스트: 서비스 5개 + API 1개 신규, 전체 46개 통과. ruff + build 통과.

---

### T022: Streaming Analyze Endpoint (실시간 진행 상태)
- Status: Done
- Service: intake-assistant-api, intake-assistant-web
- Origin: T021
- Description: POST /api/v1/analyze/stream SSE 스트리밍 엔드포인트 추가. 프론트엔드에서 analyzeStream() 함수로 분석 중 실시간 진행 상태 표시. 기존 /analyze 엔드포인트는 하위 호환 유지.
- Acceptance Criteria:
  - [x] analyze_service.py에 analyze_stream() + _sse_event() 추가
  - [x] routers/analyze.py에 POST /analyze/stream 엔드포인트 추가
  - [x] api/types.ts에 AnalyzeStreamEvent 타입 추가
  - [x] api/client.ts에 analyzeStream() 함수 추가
  - [x] stores/intakeStore.ts의 submitAnalyze를 스트리밍으로 전환
  - [x] IntakePage analyzing phase에 동적 상태 텍스트 표시
  - [x] 스트리밍 단위 테스트 (성공/API에러/파싱에러)
  - [x] API 테스트 (text/event-stream 응답 확인)
  - [x] 기존 테스트 전체 통과
  - [x] 21-api-contract.md에 스트리밍 엔드포인트 사양 추가
- Result: Backend: analyze_stream() AsyncGenerator + _sse_event() 헬퍼 + POST /analyze/stream StreamingResponse 엔드포인트. Frontend: analyzeStream() (fetch + ReadableStream SSE 파싱) + AnalyzeStreamEvent 타입 + intakeStore 스트리밍 전환 + IntakePage 동적 진행 텍스트. 테스트: 서비스 3개 + API 1개 신규, 전체 50개 통과. ruff + build 통과.

---

### T023: Prompt Quality Tuning (검증 실패율 감소)
- Status: Done
- Service: intake-assistant-api
- Description: generate 시스템 프롬프트에 enum 값 치트시트, 필수 섹션 체크리스트, 배열 최소 요건, 교차 참조 규칙, 흔한 실수 예시를 추가하여 SDwC validation 첫 시도 통과율을 높인다.
- Acceptance Criteria:
  - [x] 시스템 프롬프트에 enum 값 치트시트 추가
  - [x] 필수 섹션 체크리스트 추가
  - [x] 배열 최소 1개 요건 명시
  - [x] collaboration.per_service ↔ services 1:1 교차 참조 규칙 추가
  - [x] 흔한 실수 예시 (빈 문자열, 빈 배열, enum 위반) 추가
  - [x] 기존 테스트 전체 통과
- Result: generate 시스템 프롬프트에 5개 섹션 추가: Required Sections Checklist(19개 필수 섹션), Array Minimum Requirements(16개 배열 필드), Enum Value Reference(35+ enum 필드), Cross-reference rule(per_service↔services 1:1), Common Mistakes to Avoid(5개 안티패턴). 기존 50개 테스트 전체 통과. ruff lint 통과.

---

### T024: E2E Tests for Streaming
- Status: Done
- Service: intake-assistant-web
- Origin: T021, T022
- Description: Playwright E2E 테스트를 업데이트하여 새로운 SSE 스트리밍 흐름(generate/stream, analyze/stream)을 커버. 기존 E2E 테스트가 non-streaming API를 모킹하고 있으므로, 스트리밍 SSE 응답 모킹으로 전환하거나 별도 테스트 추가.
- Acceptance Criteria:
  - [x] simple-mode E2E 테스트가 스트리밍 API 응답을 모킹
  - [x] 스트리밍 중 진행 상태 텍스트가 UI에 표시되는지 검증
  - [x] 스트리밍 에러 시나리오 테스트
  - [x] 기존 E2E 테스트 전체 통과
- Result: fixtures.ts를 SSE 스트리밍 API 모킹으로 전환(formatSseEvent, buildAnalyzeSseBody, buildGenerateSseBody, buildSseErrorBody 헬퍼 + setupApiMocks에서 analyze/stream, generate/stream 라우트). simple-mode.spec.ts에 "스트리밍 중 진행 상태 텍스트 표시" 테스트 추가(300ms 지연 라우트로 status text 검증). error-scenarios.spec.ts를 스트리밍 엔드포인트 모킹으로 전환 + SSE error 이벤트 테스트 추가. 총 11개 E2E 테스트 전체 통과. build + lint 통과.

---

### T025: Error Recovery UX
- Status: Done
- Service: intake-assistant-web
- Description: generate 에러 발생 시 "처음부터 다시 시작" 대신 "생성 재시도" 옵션을 제공하여, 사용자가 질문 응답을 다시 하지 않고 generate만 재시도할 수 있게 한다. analyze 에러도 동일하게 "분석 재시도" 옵션 제공.
- Acceptance Criteria:
  - [x] generate 에러 시 "생성 재시도" 버튼 추가 (questions phase로 복귀)
  - [x] analyze 에러 시 "분석 재시도" 버튼 추가 (input phase로 복귀, 입력 유지)
  - [x] "처음부터 다시 시작" 버튼도 유지 (전체 리셋)
  - [x] 기존 테스트 통과 + 빌드 성공
- Result: intakeStore에 errorSource 상태 + retryAnalyze/retryGenerate 액션 추가. IntakePage 에러 phase에 errorSource별 재시도 버튼(분석 재시도/생성 재시도/다시 시도) + 처음부터 다시 시작 버튼 조건부 렌더링. E2E 테스트 7개(기존 5개 업데이트 + 재시도 성공 2개 신규), 총 13개 통과. 빌드 + lint 통과.

---

### T026: Rate Limiting / Input Sanitization
- Status: Done
- Service: intake-assistant-api
- Description: 프로덕션 사용 전 기본 요청 제한(rate limiting)과 입력 정제(sanitization) 추가. IP 기반 요청 제한, 입력 텍스트 정제(XSS 방지, 과도한 공백 제거 등).
- Acceptance Criteria:
  - [x] IP 기반 rate limiting 미들웨어 추가
  - [x] 입력 텍스트 sanitization (user_input 필드)
  - [x] rate limit 초과 시 429 응답 + 적절한 에러 메시지
  - [x] 단위 테스트
  - [x] 기존 테스트 전체 통과
- Result: core/rate_limiter.py(in-memory sliding window, IP별 20req/60s), core/sanitizer.py(HTML 태그 제거, 과도한 공백/개행 축소), RateLimitError(429 + Retry-After), RateLimitMiddleware(/health 제외), schemas에 mode="before" field_validator로 sanitization 적용. 단위 테스트 19개 신규(rate_limiter 5 + sanitizer 13 + API 2), 전체 69개 통과. ruff lint 통과.

---

### T027: LLM 응답 파싱 안정화 (analyze + generate)
- Status: Done
- Service: intake-assistant-api
- Origin: T004, T019
- Description: 프로덕션 테스트 중 발견된 LLM 응답 파싱 오류 2건 수정. (1) analyze API에서 Haiku가 inferred_hints에 bool 값을 반환할 때 Pydantic 검증 실패. (2) generate API에서 Sonnet이 코드 펜스 없이 raw YAML/JSON을 반환할 때 "No YAML block found" 오류.
- Acceptance Criteria:
  - [x] inferred_hints 타입을 dict[str, Any]로 변경하여 혼합 타입 허용
  - [x] _parse_response()에 raw YAML fallback 추가 (코드 펜스 없는 경우)
  - [x] _parse_response()에 raw JSON fallback 추가 (코드 펜스 없는 경우)
  - [x] 기존 테스트 전체 통과
  - [x] 11-troubleshooting에 원인/해결/예방 기록
- Result: schemas/analyze.py의 inferred_hints를 dict[str, Any]로 변경. generate_service.py에 _find_raw_yaml() 헬퍼 추가(project_name:/project: 탐지) + raw JSON regex fallback(architecture_card 키 탐지). 11-troubleshooting에 2건 기록. 전체 69개 테스트 통과. ruff lint 통과.

---

### T028: Open-ended Text Q&A (Multiple Choice → Free Text)
- Status: Done
- Service: intake-assistant-api, intake-assistant-web
- Description: 기존 3~4개 객관식 질문(single/multi select)을 5~6개 자유 텍스트 질문으로 변경. 비개발자가 자연어로 답변할 수 있도록 textarea 기반 UI로 전환. generate 프롬프트에 풍부한 컨텍스트 전달.
- Acceptance Criteria:
  - [x] Backend: Choice 클래스 삭제, Question에서 type/choices 제거, placeholder 추가
  - [x] Backend: QaAnswer.selected_ids → answer (단일 문자열)
  - [x] Backend: analyze 프롬프트를 5~6개 open-ended 질문으로 변경
  - [x] Backend: generate 프롬프트의 Q&A 포매팅을 자유 텍스트 형식으로 변경
  - [x] Frontend: Choice 인터페이스 삭제, Question/QaAnswer 타입 업데이트
  - [x] Frontend: QuestionCard를 textarea 기반으로 재작성
  - [x] Frontend: intakeStore의 answers 타입을 Record<string, string>으로 변경
  - [x] Frontend: IntakePage 유효성 검사 및 props 업데이트
  - [x] Backend 테스트 전체 통과 (69개)
  - [x] Frontend 빌드 + ESLint 통과
  - [x] E2E 테스트 전체 통과 (13개)
- Result: Backend schemas/analyze.py에서 Choice 삭제, Question 단순화(placeholder 추가), schemas/generate.py QaAnswer.answer로 변경. analyze 프롬프트 5~6개 open-ended 질문으로 재작성. generate 프롬프트 Q&A 포매팅 업데이트. Frontend types.ts/QuestionCard.tsx/intakeStore.ts/IntakePage 전면 업데이트. E2E fixtures/simple-mode/error-scenarios를 textarea.fill()로 전환. Backend 69개 + E2E 13개 테스트 전체 통과.

---

### T029: Retry 축소 + field_requirements 기반 프롬프트 개선
- Status: Done
- Service: intake-assistant-api
- Origin: T023
- Description: Anthropic API 재시도 횟수를 3→2회로 축소. SDwC field_requirements.yaml(287개 필드 명세)를 기반으로 generate 시스템 프롬프트의 Required Sections, Enum Reference, Array Minimums를 보정하여 YAML 검증 통과율을 높인다.
- Acceptance Criteria:
  - [x] MAX_RETRIES 3→2 변경 (analyze_service, generate_service)
  - [x] 누락된 required 필드를 Required Sections Checklist에 추가 (test_case_coverage, web_ui pages, worker workers, data_pipeline pipelines 등)
  - [x] 잘못된 enum 값 수정 (kotlin→kotlin_mobile, sbt 추가)
  - [x] 누락된 enum 값 추가 (worker, data_pipeline, deployment 관련)
  - [x] 누락된 array minimum 추가
  - [x] 기존 테스트 전체 통과
- Result: MAX_RETRIES 3→2 + BACKOFF_SECONDS [1,2,4]→[1,2] (analyze_service, generate_service). generate 프롬프트에 Per-Service Type Required Fields 섹션 신설(5개 타입별 필수 필드), Required Sections에 자식 필드 상세화, Array Minimums에 7개 추가, Enum Reference에 30+ enum 추가(worker/data_pipeline/mobile_app/deployment/backend_api), kotlin→kotlin_mobile 수정, sbt 추가, Common Mistakes에 4개 예시 추가. 테스트 2개 업데이트, 전체 69개 통과. ruff lint 통과.

---

### T030: Dynamic Generate Prompt from field_requirements.yaml
- Status: Done
- Service: intake-assistant-api
- Origin: T029
- Description: field_requirements.yaml을 SDwC에서 동적으로 fetch하여 generate 시스템 프롬프트의 Required Sections, Per-Service Fields, Array Minimums, Enum Reference를 자동 생성. SDwC 모델 변경 시 intake-assistant가 자동 동기화.
- Acceptance Criteria:
  - [x] SDwCClient.fetch_field_requirements() 추가 (GET /api/v1/field-requirements)
  - [x] template_cache에 field_requirements 캐시 추가
  - [x] main.py lifespan에서 startup 시 fetch + 캐시
  - [x] prompt_builder.py 모듈 — YAML 파싱 + 4개 동적 섹션 생성
  - [x] generate.py를 static header/dynamic/fallback/footer로 분리
  - [x] generate_service.py에서 field_requirements를 build_system_prompt에 전달
  - [x] SDwC 미접속 시 기존 하드코딩된 static fallback 사용 (동작 동일)
  - [x] 단위 테스트 (prompt_builder 11개 + sdwc_client 3개 + generate_service 1개)
  - [x] 전체 테스트 통과 (84개) + ruff lint 통과
- Result: prompt_builder.py 신규 — build_dynamic_sections()가 field_requirements.yaml을 재귀적으로 walk하여 4개 섹션 동적 생성. generate.py를 _STATIC_HEADER/_STATIC_FALLBACK/_STATIC_FOOTER로 분리, build_system_prompt(template, field_requirements) 시그니처 변경. SDwCClient.fetch_field_requirements(), template_cache.get/set_field_requirements() 추가. fallback 전략: SDwC 미접속 → None → static fallback = 기존 동작 동일. 테스트 15개 신규(prompt_builder 11 + sdwc_client 3 + generate_service 1), 전체 84개 통과.

---

### T031: Advanced Mode 기반 구조 (스키마, 스토어, 라우트, 네비게이션)
- Status: Done
- Service: intake-assistant-web
- Description: phaseSchema.ts + fieldTypes.ts — 8 phases 필드 정의, useAdvancedStore — formData/currentPhase/setField/navigation, pathUtils.ts — dot-notation get/set, /advanced 라우트 + AdvancedPage 스켈레톤 + StepWizard, ModeSelectorPage 수정 — /advanced 내비게이션, 01-requirements.md 스코프 변경
- Acceptance Criteria:
  - [x] phaseSchema.ts에 8 phases 필드 정의 완료
  - [x] fieldTypes.ts에 FieldDef/SectionDef/PhaseDef 타입 정의
  - [x] useAdvancedStore — formData, currentPhase, setField, navigation actions
  - [x] pathUtils.ts — getByPath/setByPath/deleteByPath
  - [x] /advanced 라우트 + AdvancedPage + StepWizard + AdvancedNavigation
  - [x] ModeSelectorPage — /advanced 내비게이션으로 변경
  - [x] 01-requirements.md — Advanced 모드 비목표에서 in-scope로 이동
  - [x] npm run build + lint 통과
- Result: phaseSchema.ts(8 phases, ~150+ 필드), fieldTypes.ts(FieldDef/SectionDef/PhaseDef), advancedStore.ts(Zustand — formData/services/navigation/array/AI actions), pathUtils.ts(getByPath/setByPath/deleteByPath), router.tsx에 /advanced 추가, AdvancedPage(StepWizard+PhaseRenderer 스켈레톤+AdvancedNavigation), ModeSelectorPage 수정(/advanced 네비게이션+설명 업데이트), 01-requirements.md 스코프 변경. build+lint 통과.

---

### T032: 기본 폼 컴포넌트 (Phase 1-2 렌더링)
- Status: Done
- Service: intake-assistant-web
- Description: FormField, TextField, TextAreaField, EnumSelect, BooleanToggle, NumberField, FieldGroup, PhaseRenderer 실제 폼 렌더링. Phase 1 (WHY), Phase 2 (WHAT) 폼 렌더링 동작 확인.
- Acceptance Criteria:
  - [x] FormField — 필드 타입별 dispatch
  - [x] TextField, TextAreaField, EnumSelect, BooleanToggle, NumberField 컴포넌트
  - [x] FieldGroup — collapsible section
  - [x] PhaseRenderer — 실제 폼 필드 렌더링
  - [x] ArrayField + ArrayItemCard — simple/complex array items (T033 범위이나 Phase 1-2에 필요하여 선행 구현)
  - [x] Phase 1, Phase 2 폼 입력 동작 확인
  - [x] npm run build + lint 통과
- Result: FormField(타입별 dispatch), TextField, TextAreaField, EnumSelect, BooleanToggle, NumberField, FieldGroup(collapsible), ArrayField(동적 추가/삭제), ArrayItemCard(simple string/complex object) 컴포넌트 구현. PhaseRenderer를 FieldGroup 기반 실제 폼으로 업데이트. build+lint 통과.

---

### T033: 배열 필드 + 서비스 에디터 (Phase 3-4)
- Status: Done
- Service: intake-assistant-web
- Description: ArrayField, ArrayItemCard, ServiceTypeSelector, ServiceEditor — 5개 서비스 타입별 조건부 필드. Phase 3 (WHO), Phase 4 (HOW) 렌더링. advancedStore 서비스 관리 액션.
- Acceptance Criteria:
  - [x] ArrayField — 동적 아이템 추가/삭제 (T032에서 선행 구현)
  - [x] ArrayItemCard — 배열 아이템 카드 UI (T032에서 선행 구현)
  - [x] ServiceTypeSelector — 서비스 타입 선택
  - [x] ServiceEditor — 타입별 조건부 필드 렌더링
  - [x] serviceSchema.ts — 5개 서비스 타입별 필드 정의 (common + type-specific + deployment)
  - [x] ServiceArrayField — 서비스 내 배열 필드 관리
  - [x] Phase 3, Phase 4 폼 렌더링 동작 확인
  - [x] npm run build + lint 통과
- Result: serviceSchema.ts(5개 서비스 타입 — backend_api/web_ui/worker/mobile_app/data_pipeline별 필드 + common + deployment), ServiceTypeSelector, ServiceEditor, ServiceArrayField 컴포넌트 구현. FieldGroup에서 service_list 타입을 ServiceListRenderer로 연결. advancedStore.setServiceField 중첩 경로 지원 추가. build+lint 통과.

---

### T034: Phase 5-8 폼 + 검증
- Status: Done
- Service: intake-assistant-web
- Description: Phase 5-8 폼 렌더링. validators.ts — required/enum/array minimum/조건부/교차참조 검증. PhaseValidationSummary 컴포넌트. nextPhase() 검증 연동.
- Acceptance Criteria:
  - [x] Phase 5-8 폼 렌더링 동작 확인 (phaseSchema에 이미 정의, FieldGroup으로 자동 렌더링)
  - [x] validators.ts — required/array minimum/교차참조(per_service↔services) 검증
  - [x] PhaseValidationSummary 컴포넌트
  - [x] nextPhase() 검증 연동 — AdvancedNavigation에서 다음 클릭 시 검증
  - [x] npm run build + lint 통과
- Result: validators.ts(validatePhase, validateAllPhases, phaseHasErrors — required 필드 검증, 배열 최소 요건, per_service↔services 교차참조), PhaseValidationSummary(에러 목록 표시), AdvancedNavigation에 검증 연동(다음/제출 클릭 시 에러 있으면 차단). build+lint 통과.

---

### T035: YAML 직렬화 + 제출 흐름
- Status: Done
- Service: intake-assistant-web, intake-assistant-api
- Description: js-yaml 의존성 추가, yamlSerializer.ts — formData → YAML (DELETE 원칙), POST /api/v1/validate-yaml 엔드포인트, 제출 흐름 — 직렬화 → SDwC 검증 → ZIP 다운로드.
- Acceptance Criteria:
  - [x] js-yaml + @types/js-yaml 의존성 추가
  - [x] yamlSerializer.ts — formData → YAML (DELETE 원칙 — 빈값 재귀 삭제)
  - [x] Backend POST /api/v1/validate-yaml 엔드포인트 (schemas/validate.py, routers/validate.py)
  - [x] 제출 흐름 연동 (직렬화 → SDwC 검증 → ZIP 다운로드)
  - [x] AdvancedPage 완료/에러/로딩 상태 UI
  - [x] api/client.ts — validateYaml(), recommend() 함수 추가
  - [x] api/types.ts — ValidateYamlResponse, RecommendRequest/Response 타입 추가
  - [x] npm run build + lint + pytest(84개) 통과
- Result: yamlSerializer.ts(js-yaml + deleteEmpty 재귀), POST /api/v1/validate-yaml(SDwC proxy — errors/warnings flatten), advancedStore.submitAdvanced(직렬화→검증→ZIP 다운로드), AdvancedPage(complete/validating/generating/error UI), api/client.ts(validateYaml+recommend). build+lint+84 pytest 통과.

---

### T036: AI 추천 백엔드 (POST /api/v1/recommend)
- Status: Done
- Service: intake-assistant-api
- Description: routers/recommend.py, schemas/recommend.py, services/recommend_service.py, prompts/recommend.py. Haiku 호출 — context + field_path → suggestion + rationale. 단위 테스트.
- Acceptance Criteria:
  - [x] POST /api/v1/recommend 엔드포인트
  - [x] Haiku 기반 필드 추천 서비스
  - [x] 단위 테스트
  - [x] 21-api-contract.md 업데이트
  - [x] pytest 통과
- Result: recommend 엔드포인트 구현 완료. 신규 파일: prompts/recommend.py, schemas/recommend.py, services/recommend_service.py, routers/recommend.py, tests/unit/test_recommend_service.py(7), tests/unit/test_recommend_api.py(4). 전체 95 테스트 통과. 21-api-contract.md에 validate-yaml + recommend 엔드포인트 문서 추가.

---

### T037: AI 추천 UI 연동
- Status: Done
- Service: intake-assistant-web
- Description: AiRecommendButton 컴포넌트, FormField에 AI 추천 버튼 통합, advancedStore.requestRecommendation() 액션, api/client.ts에 recommend() 함수 추가.
- Acceptance Criteria:
  - [x] AiRecommendButton 컴포넌트
  - [x] FormField에 AI 추천 버튼 통합
  - [x] advancedStore.requestRecommendation() 액션
  - [x] api/client.ts recommend() 함수 (T035에서 이미 추가됨)
  - [x] npm run build + lint 통과
- Result: AiRecommendButton.tsx 생성 (로딩 상태 + AI 추천 버튼). FormField.tsx에 aiRecommend 플래그 기반 버튼 통합. advancedStore에 requestRecommendation() 액션 추가 (recommend API 호출 → 필드 값 자동 설정). build + lint 통과.

---

<!-- Claude: This is a hybrid document.
     Template Engine fills Operating Rules, Status Flow, Task Format.
     Claude fills the Tasks section during Init based on docs/common/05-roadmap.md.
     After Init, Claude updates task statuses with user approval.
     Rules:
     - Never delete task history.
     - Always get user approval before status transitions.
     - Keep tasks small (~30 min reviewable).
     - Record Result when Done. -->
