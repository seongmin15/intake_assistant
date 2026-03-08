# intake-assistant

> SDwC용 intake_data.yaml을 생성하는 서비스 — AI 대화(Simple) 또는 8단계 위저드 폼(Advanced)

## 모드

### Simple 모드 (AI 대화)

비개발자가 자유 텍스트로 만들고 싶은 서비스를 설명하면, AI가 몇 가지 질문을 통해 의도를 파악하고 SDwC 호환 `intake_data.yaml`을 자동 생성합니다.

1. **자유 텍스트 입력** — 만들고 싶은 서비스를 자연어로 설명
2. **동적 질문** — AI가 생성한 5~6개 질문에 자유 텍스트로 답변
3. **YAML 생성** — SSE 스트리밍으로 실시간 진행 상태를 표시하며 `intake_data.yaml` 생성 + SDwC 자동 검증
4. **아키텍처 카드** — 5항목 요약 + 기능 체크리스트로 결과 확인
5. **수정 반복** — 자유 텍스트로 수정 요청 → 전체 재생성
6. **ZIP 다운로드** — SDwC `/generate`를 통해 프로젝트 스캐폴딩 ZIP 수신

### Advanced 모드 (8단계 위저드 폼)

intake_template의 8개 Phase를 단계별로 직접 입력하는 위저드 폼입니다. 150+ 필드를 데이터 기반으로 렌더링하며, 개별 필드에 AI 추천을 받을 수 있습니다.

1. **8단계 위저드** — WHY → WHAT → WHO → HOW → WHAT-IF → HOW-WELL → HOW-TO-WORK → WHAT-NEXT
2. **데이터 기반 폼** — `phaseSchema.ts`에서 필드 정의 → 자동 렌더링 (text, textarea, enum, boolean, number, array, service)
3. **서비스 에디터** — 5개 서비스 타입별 조건부 필드 (backend_api, web_ui, worker, mobile_app, data_pipeline)
4. **AI 필드 추천** — 개별 필드에 "AI 추천" 버튼 → Haiku 호출 → 값 자동 채움
5. **단계별 검증** — 필수 필드, 배열 최소 요건, 교차 참조 검증
6. **YAML 직렬화** — DELETE 원칙 적용 (미사용 optional 필드 제거)
7. **SDwC 검증 + ZIP 다운로드** — 직렬화 → SDwC 스키마 검증 → 프로젝트 ZIP 다운로드

## 서비스 구성

| 서비스 | 타입 | 기술 스택 | 역할 |
|--------|------|----------|------|
| `intake-assistant-api` | Backend API | Python + FastAPI | AI 대화 처리, 동적 질문 생성, YAML 생성, AI 필드 추천, SDwC 연동 |
| `intake-assistant-web` | Web UI | TypeScript + React + Vite | 모드 선택, Simple 모드(대화형), Advanced 모드(위저드 폼), ZIP 다운로드 |

## 아키텍처

- **패턴**: Modular Monolith (모노레포)
- **서버**: Stateless (클라이언트가 대화 상태를 매 요청에 전달)
- **인증**: 없음 (내부 도구 수준)
- **배포**: Kubernetes (k3s), GitHub Actions + ArgoCD

### 주요 기능

- **SSE 스트리밍**: analyze/generate 중 실시간 진행 상태 전달
- **Prompt Caching**: generate 시스템 프롬프트에 `cache_control: ephemeral` 적용
- **동적 프롬프트**: SDwC `field_requirements.yaml`에서 스키마 규칙을 동적 생성 (fallback: 하드코딩)
- **AI 필드 추천**: Advanced 모드에서 개별 필드에 Haiku 기반 AI 추천
- **Rate Limiting**: IP 기반 sliding window (20req/60s)
- **Input Sanitization**: HTML 태그 제거, 과도한 공백/개행 축소

## 외부 의존성

| 시스템 | 용도 |
|--------|------|
| Anthropic API | Haiku(질문 생성, 필드 추천), Sonnet(YAML 생성/수정) |
| SDwC API | 템플릿 수신, field_requirements 수신, YAML validation, ZIP 생성 |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/analyze` | 자유 텍스트 분석 → 동적 질문 생성 |
| POST | `/api/v1/analyze/stream` | analyze SSE 스트리밍 (실시간 진행 상태) |
| POST | `/api/v1/generate` | 사용자 응답 기반 YAML 생성 + 자동 검증 |
| POST | `/api/v1/generate/stream` | generate SSE 스트리밍 (실시간 진행 상태) |
| POST | `/api/v1/finalize` | 확정된 YAML → SDwC ZIP 생성 |
| POST | `/api/v1/validate-yaml` | YAML을 SDwC 스키마로 검증 |
| POST | `/api/v1/recommend` | 개별 필드 AI 추천 (Haiku) |
| GET | `/api/v1/health` | 헬스체크 (SDwC 연결 상태 포함) |

## 개발 환경 설정

### 환경 변수

```bash
cp intake-assistant-api/.env.example intake-assistant-api/.env
```

`.env` 파일에서 `ANTHROPIC_API_KEY`만 실제 키로 변경하면 됩니다.

```bash
ANTHROPIC_API_KEY=sk-ant-your-actual-key   # 필수: Anthropic API 키
SDWC_API_URL=http://sdwc.local:8080         # k3d 로컬 배포 시 기본값
DEBUG=false
```

| 환경 | `SDWC_API_URL` |
|------|----------------|
| K8s 클러스터 내부 | `http://sdwc-api.sdwc.svc.cluster.local:8000` |
| 로컬 개발 (k3d 배포 후) | `http://sdwc.local:8080` |
| 로컬 개발 (직접 실행) | `http://localhost:8000` |

### Backend (intake-assistant-api)

```bash
cd intake-assistant-api
poetry install
poetry run uvicorn intake_assistant_api.main:app --reload
```

### Frontend (intake-assistant-web)

```bash
cd intake-assistant-web
npm install
npm run dev
```

### 테스트

```bash
# Backend 단위 테스트
cd intake-assistant-api
poetry run pytest tests/

# Frontend E2E 테스트
cd intake-assistant-web
npx playwright test
```

## 배포

- **컨테이너**: 각 서비스별 multi-stage Dockerfile
- **오케스트레이션**: Kubernetes (k3d/k3s), Traefik Ingress
- **CI**: GitHub Actions (lint + test + GHCR push)
- **CD**: ArgoCD (sdwc-platform 레포에서 관리)

```bash
# 로컬 K8s 배포 (sdwc-platform 레포)
./scripts/deploy-all.sh

# 접속
# http://intake.local:8080     (Web UI)
# http://intake.local:8080/api (API)
```

## 프로젝트 구조

```
intake-assistant/
├── CLAUDE.md                          # AI 협업 규칙
├── docs/
│   ├── common/                        # 프로젝트 공통 문서
│   ├── intake-assistant-api/          # API 서비스 문서
│   └── intake-assistant-web/          # Web 서비스 문서
├── skills/                            # 코딩 표준 및 패턴
│   ├── common/                        # 공통 스킬 (git, 관측성 등)
│   ├── intake-assistant-api/          # API 코딩/배포/테스트 규칙
│   └── intake-assistant-web/          # Web 코딩/배포/테스트 규칙
├── intake-assistant-api/              # Backend 소스 (FastAPI + Poetry)
├── intake-assistant-web/              # Frontend 소스 (React + Vite)
└── .github/workflows/                 # CI 파이프라인 (lint, test, GHCR push)
```

## 문서

상세 문서는 `docs/` 디렉토리를 참조하세요.

- [프로젝트 개요](docs/common/00-project-overview.md)
- [요구사항](docs/common/01-requirements.md)
- [아키텍처 결정](docs/common/02-architecture-decisions.md)
- [품질 계획](docs/common/03-quality-plan.md)
- [API 계약](docs/intake-assistant-api/21-api-contract.md)
- [UI 설계](docs/intake-assistant-web/30-ui-design.md)
