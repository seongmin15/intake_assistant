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
- Status: Ready
- Service: intake-assistant-api
- Description: 사용자 입력 + Q&A 응답을 기반으로 Sonnet을 호출하여 intake_data.yaml을 생성. SDwC /validate로 검증하고, 실패 시 에러 피드백으로 재생성 (최대 2회). 아키텍처 카드 5항목 + 기능 체크리스트 추출.
- Acceptance Criteria:
  - [ ] POST /api/v1/generate → yaml_content + architecture_card + feature_checklist 응답
  - [ ] Anthropic Sonnet 호출 + 시스템 프롬프트 (DELETE 원칙, 템플릿 구조 포함)
  - [ ] SDwC /api/v1/validate 호출로 YAML 검증
  - [ ] validate-retry 루프 (최대 2회 재시도)
  - [ ] 수정 반복 지원 (revision_request + previous_yaml 파라미터)
  - [ ] 단위 테스트 (mock Anthropic + SDwC 응답)
- Result:

---

### T006: POST /api/v1/finalize 구현 (ZIP 생성)
- Status: Ready
- Service: intake-assistant-api
- Description: 확정된 YAML을 SDwC /api/v1/generate에 전달하여 ZIP 파일을 받아 클라이언트에 스트림 응답.
- Acceptance Criteria:
  - [ ] POST /api/v1/finalize → ZIP 바이너리 스트림 응답
  - [ ] SDwC /api/v1/generate 호출
  - [ ] 30초 타임아웃 설정
  - [ ] 에러 시 적절한 에러 응답
  - [ ] 단위 테스트
- Result:

---

### T007: ModeSelectorPage 구현
- Status: Ready
- Service: intake-assistant-web
- Description: Simple/Advanced 모드 선택 페이지. ModeCard 컴포넌트로 각 모드 설명 표시. Simple → /intake, Advanced → sdwc-web 리다이렉트.
- Acceptance Criteria:
  - [ ] ModeCard 컴포넌트 (모드 설명, 대상, 차이점)
  - [ ] Simple 선택 → /intake 라우팅
  - [ ] Advanced 선택 → sdwc-web URL 리다이렉트 (환경 변수)
  - [ ] 반응형 레이아웃
- Result:

---

### T008: IntakePage - 자유 텍스트 입력 + 질문 표시
- Status: Ready
- Service: intake-assistant-web
- Description: TextInput 컴포넌트로 자유 텍스트 입력, '분석' 버튼 클릭 시 /api/v1/analyze 호출, QuestionCard로 Q1~Q4 동적 질문 표시 및 응답 수집.
- Acceptance Criteria:
  - [ ] TextInput 컴포넌트 (가이드 힌트 포함)
  - [ ] /api/v1/analyze API 호출 + 로딩 상태
  - [ ] QuestionCard 컴포넌트 (선택지 라디오/체크박스)
  - [ ] Zustand store로 대화 상태 관리
  - [ ] 에러 상태 처리
- Result:

---

### T009: IntakePage - 아키텍처 카드 + 수정 반복
- Status: Ready
- Service: intake-assistant-web
- Description: Q&A 응답 완료 후 /api/v1/generate 호출. ArchitectureCard(5항목) + FeatureChecklist 표시. RevisionInput으로 수정 요청 → 전체 재생성 반복.
- Acceptance Criteria:
  - [ ] /api/v1/generate API 호출 + 로딩 상태
  - [ ] ArchitectureCard 컴포넌트 (서비스 구성, 데이터 저장, 인증, 외부 서비스, 화면 수)
  - [ ] FeatureChecklist 컴포넌트 (읽기 전용)
  - [ ] RevisionInput 컴포넌트 + 수정 요청 시 재생성
  - [ ] 에러 상태 처리
- Result:

---

### T010: IntakePage - ZIP 다운로드 (finalize 연동)
- Status: Ready
- Service: intake-assistant-web
- Description: '이대로 진행' 버튼 클릭 시 /api/v1/finalize 호출 → ZIP 파일 브라우저 다운로드. complete 상태 표시.
- Acceptance Criteria:
  - [ ] '이대로 진행' 버튼 + /api/v1/finalize API 호출
  - [ ] ZIP 바이너리 다운로드 처리 (Blob + download)
  - [ ] finalizing 로딩 상태 + complete 상태
  - [ ] 에러 시 재시도 안내
- Result:

---

### T011: E2E 통합 테스트
- Status: Backlog
- Service: intake-assistant-api, intake-assistant-web
- Description: Playwright로 전체 흐름 E2E 테스트. 텍스트 입력 → 질문 응답 → 카드 확인 → ZIP 다운로드.
- Acceptance Criteria:
  - [ ] 전체 Simple 모드 흐름 E2E 테스트
  - [ ] Advanced 모드 리다이렉트 테스트
  - [ ] 에러 시나리오 테스트 (API 실패, SDwC 불가)
- Result:

---

### T012: 컨테이너화 + CI 파이프라인
- Status: Backlog
- Service: intake-assistant-api, intake-assistant-web
- Description: 각 서비스 Dockerfile 작성, GitHub Actions CI 파이프라인 구성 (lint, test, build).
- Acceptance Criteria:
  - [ ] intake-assistant-api Dockerfile
  - [ ] intake-assistant-web Dockerfile
  - [ ] GitHub Actions 워크플로우 (lint + test + build)
  - [ ] GHCR 이미지 push
- Result:

<!-- Claude: This is a hybrid document.
     Template Engine fills Operating Rules, Status Flow, Task Format.
     Claude fills the Tasks section during Init based on docs/common/05-roadmap.md.
     After Init, Claude updates task statuses with user approval.
     Rules:
     - Never delete task history.
     - Always get user approval before status transitions.
     - Keep tasks small (~30 min reviewable).
     - Record Result when Done. -->
