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

<!-- Claude: This is a hybrid document.
     Template Engine fills Operating Rules, Status Flow, Task Format.
     Claude fills the Tasks section during Init based on docs/common/05-roadmap.md.
     After Init, Claude updates task statuses with user approval.
     Rules:
     - Never delete task history.
     - Always get user approval before status transitions.
     - Keep tasks small (~30 min reviewable).
     - Record Result when Done. -->
