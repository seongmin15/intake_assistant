# intake-assistant

> 대화형 AI를 통해 SDwC용 intake_data.yaml을 자동 생성하는 서비스

비개발자가 자유 텍스트로 만들고 싶은 서비스를 설명하면, AI가 3~4개의 핵심 질문을 통해 의도를 파악하고 SDwC가 처리할 수 있는 `intake_data.yaml`을 자동 생성합니다. 사용자는 기술 결정 없이 아키텍처 카드로 결과를 확인하고, ZIP 프로젝트를 받습니다.

## 핵심 흐름

1. **모드 선택** — Simple(AI 대화) / Advanced(sdwc-web 리다이렉트)
2. **자유 텍스트 입력** — 만들고 싶은 서비스를 자연어로 설명
3. **동적 질문(Q1~Q4)** — 플랫폼, 데이터 영속성, 멀티유저, 외부 의존성
4. **YAML 생성** — AI가 SDwC 호환 `intake_data.yaml` 전체 생성 + 자동 검증
5. **아키텍처 카드** — 5항목 요약 + 기능 체크리스트로 결과 확인
6. **수정 반복** — 자유 텍스트로 수정 요청 → 전체 재생성
7. **ZIP 다운로드** — SDwC `/generate`를 통해 프로젝트 스캐폴딩 ZIP 수신

## 서비스 구성

| 서비스 | 타입 | 기술 스택 | 역할 |
|--------|------|----------|------|
| `intake-assistant-api` | Backend API | Python + FastAPI | AI 대화 처리, 동적 질문 생성, YAML 생성, SDwC 연동 |
| `intake-assistant-web` | Web UI | TypeScript + React + Vite | 자유 텍스트 입력, 동적 질문, 아키텍처 카드, ZIP 다운로드 |

## 아키텍처

- **패턴**: Modular Monolith (모노레포)
- **서버**: Stateless (클라이언트가 대화 상태를 매 요청에 전달)
- **인증**: 없음 (내부 도구 수준)
- **배포**: Kubernetes (k3s), GitHub Actions + ArgoCD

## 외부 의존성

| 시스템 | 용도 |
|--------|------|
| Anthropic API | Haiku(질문 생성), Sonnet(YAML 생성/수정) |
| SDwC API | 템플릿 수신, YAML validation, ZIP 생성 |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/analyze` | 자유 텍스트 분석 → 동적 질문 생성 |
| POST | `/api/v1/generate` | 사용자 응답 기반 YAML 생성 + 자동 검증 |
| POST | `/api/v1/finalize` | 확정된 YAML → SDwC ZIP 생성 |
| GET | `/api/v1/health` | 헬스체크 (SDwC 연결 상태 포함) |

## 개발 환경 설정

### 환경 변수

```bash
ANTHROPIC_API_KEY=<your-api-key>
SDWC_API_URL=<sdwc-server-url>
```

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
├── infra/                             # K8s Deployment + Service 매니페스트
│   ├── intake-assistant-api/
│   └── intake-assistant-web/
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
