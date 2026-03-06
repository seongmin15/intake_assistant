# Output Contract — SDwC v1

> 이 문서는 Template Engine이 생성하는 ZIP 파일의 **기대 결과 명세**입니다.
> 구현자는 이 문서를 기준으로 출력 결과를 검증합니다.
> 생성 과정(치환·렌더링 규칙)은 generation_rules.md를 참조하세요.

---

## 1. 개요

### 1.1 목적

Template Engine의 출력인 ZIP 파일이 **무엇을 포함해야 하는가**를 정의합니다.

- generation_rules.md: **생성자 관점** — 어떻게 만드는가
- output_contract.md: **검증자 관점** — 무엇이 나와야 하는가

### 1.2 ZIP 파일명

```
{project.name}.zip
```

`project.name`에 공백이 포함된 경우 그대로 사용합니다 (파일 시스템 호환성은 사용자 책임).

---

## 2. ZIP 루트 구조

### 2.1 전체 디렉터리 트리

```
{project.name}/
├── CLAUDE.md                              ← 항상 생성
├── docs/
│   ├── common/                            ← 항상 생성
│   │   ├── 00-project-overview.md
│   │   ├── 01-requirements.md
│   │   ├── 02-architecture-decisions.md
│   │   ├── 03-quality-plan.md
│   │   ├── 04-infrastructure.md
│   │   ├── 05-roadmap.md
│   │   ├── 06-glossary.md
│   │   ├── 09-working-log.md
│   │   ├── 10-changelog.md
│   │   ├── 11-troubleshooting.md
│   │   └── 12-runbook.md
│   ├── {service-name}/                    ← 서비스마다 1개 폴더
│   │   └── (서비스 타입에 따른 문서)
│   └── ...
├── skills/
│   ├── common/                            ← 항상 생성
│   │   ├── git/SKILL.md
│   │   ├── observability/SKILL.md
│   │   └── code-comments/SKILL.md
│   ├── {service-name}/                    ← 서비스마다 1개 폴더
│   │   ├── coding-standards/SKILL.md
│   │   ├── testing/SKILL.md
│   │   ├── framework/SKILL.md
│   │   └── deployment/SKILL.md
│   └── ...
└── .sdwc/                                 ← 항상 생성 (서버 리소스 원본)
    ├── intake_template.yaml
    ├── CLAUDE_BASE.md
    ├── generation_rules.md
    ├── output_contract.md
    ├── doc-templates/
    │   ├── common/                        (11개 파일)
    │   ├── backend_api/                   (2개 파일)
    │   ├── web_ui/                        (1개 파일)
    │   ├── worker/                        (1개 파일)
    │   ├── mobile_app/                    (1개 파일)
    │   └── data_pipeline/                 (1개 파일)
    └── skill-templates/
        ├── common/                        (3개 폴더)
        └── per-framework/                 (34개 프레임워크 폴더)
```

### 2.2 디렉터리 수 공식

```
총 디렉터리 수 = 1 (루트)
              + 1 (docs/)
              + 1 (docs/common/)
              + N (docs/{service-name}/ × N개 서비스)
              + 1 (skills/)
              + 1 (skills/common/)
              + 3 (skills/common/git/, observability/, code-comments/)
              + N (skills/{service-name}/ × N개 서비스)
              + 4N (skills/{service-name}/ 하위 4개 폴더 × N개 서비스)
```

> **참고**: `.sdwc/`와 그 하위 디렉터리는 위 공식에 포함되지 않습니다. `.sdwc/`는 서버 리소스의 원본 복사본으로, 렌더링 산출물이 아니기 때문에 별도 검증 항목(§5.4)으로 관리합니다.

---

## 3. 파일 목록

### 3.1 고정 파일 (항상 생성)

| 출력 경로 | 소스 템플릿 | 컨텍스트 |
|----------|-----------|---------|
| `CLAUDE.md` | `CLAUDE_BASE.md` | Global |
| `docs/common/00-project-overview.md` | `doc-templates/common/00-project-overview.md` | Global |
| `docs/common/01-requirements.md` | `doc-templates/common/01-requirements.md` | Global |
| `docs/common/02-architecture-decisions.md` | `doc-templates/common/02-architecture-decisions.md` | Global |
| `docs/common/03-quality-plan.md` | `doc-templates/common/03-quality-plan.md` | Global |
| `docs/common/04-infrastructure.md` | `doc-templates/common/04-infrastructure.md` | Global |
| `docs/common/05-roadmap.md` | `doc-templates/common/05-roadmap.md` | Global |
| `docs/common/06-glossary.md` | `doc-templates/common/06-glossary.md` | Global |
| `docs/common/07-workplan.md` | `doc-templates/common/07-workplan.md` | Global |
| `docs/common/09-working-log.md` | `doc-templates/common/09-working-log.md` | Global |
| `docs/common/10-changelog.md` | `doc-templates/common/10-changelog.md` | Global |
| `docs/common/11-troubleshooting.md` | `doc-templates/common/11-troubleshooting.md` | Global |
| `docs/common/12-runbook.md` | `doc-templates/common/12-runbook.md` | Global |
| `skills/common/git/SKILL.md` | `skill-templates/common/git/SKILL.md` | Global |
| `skills/common/observability/SKILL.md` | `skill-templates/common/observability/SKILL.md` | Global |
| `skills/common/code-comments/SKILL.md` | `skill-templates/common/code-comments/SKILL.md` | Global |

**고정 파일 수**: 16개 (CLAUDE.md 1 + docs/common 12 + skills/common 3)

### 3.2 서비스별 파일 — docs/

서비스 타입에 따라 생성되는 파일이 달라집니다.

| 서비스 타입 | 출력 파일 | 소스 템플릿 |
|-----------|----------|-----------|
| `backend_api` | `docs/{name}/20-data-design.md` | `doc-templates/backend_api/20-data-design.md` |
| `backend_api` | `docs/{name}/21-api-contract.md` | `doc-templates/backend_api/21-api-contract.md` |
| `web_ui` | `docs/{name}/30-ui-design.md` | `doc-templates/web_ui/30-ui-design.md` |
| `worker` | `docs/{name}/40-worker-design.md` | `doc-templates/worker/40-worker-design.md` |
| `mobile_app` | `docs/{name}/50-mobile-design.md` | `doc-templates/mobile_app/50-mobile-design.md` |
| `data_pipeline` | `docs/{name}/60-pipeline-design.md` | `doc-templates/data_pipeline/60-pipeline-design.md` |

**컨텍스트**: 모두 Service 컨텍스트 (`services[i]` 단일 객체)

**타입별 docs/ 파일 수:**

| 서비스 타입 | 파일 수 |
|-----------|--------|
| `backend_api` | 2 |
| `web_ui` | 1 |
| `worker` | 1 |
| `mobile_app` | 1 |
| `data_pipeline` | 1 |

### 3.3 서비스별 파일 — skills/

모든 서비스 타입에 대해 동일한 4개 파일이 생성됩니다.

| 출력 파일 | 소스 템플릿 |
|----------|-----------|
| `skills/{name}/coding-standards/SKILL.md` | `skill-templates/per-framework/{framework}/coding-standards/SKILL.md` |
| `skills/{name}/testing/SKILL.md` | `skill-templates/per-framework/{framework}/testing/SKILL.md` |
| `skills/{name}/framework/SKILL.md` | `skill-templates/per-framework/{framework}/framework/SKILL.md` |
| `skills/{name}/deployment/SKILL.md` | `skill-templates/per-framework/{framework}/deployment/SKILL.md` |

**컨텍스트**: Service 컨텍스트 (`services[i]` + `collaboration.per_service[i]` 병합)

**서비스별 skills/ 파일 수**: 4개 (고정)

### 3.4 총 파일 수 공식

```
총 파일 수 = 16 (고정)
           + Σ docs_count(service[i].type)   ← §3.2 참조
           + 4N (skills/ 서비스별 4개 × N개 서비스)
```

**예시**: backend_api 1개 + web_ui 1개 (서비스 2개)

```
고정: 16
docs/my-api/: 2 (20-data-design, 21-api-contract)
docs/my-frontend/: 1 (30-ui-design)
skills/my-api/: 4
skills/my-frontend/: 4
합계: 16 + 3 + 8 = 27개 파일
```

> **참고**: `.sdwc/` 내의 파일은 위 공식에 포함되지 않습니다. 별도 검증 항목(§5.4)으로 관리합니다.

---

## 4. 파일 네이밍 규칙

### 4.1 서비스 폴더명

`services[i].name` 값이 **그대로** 폴더 이름으로 사용됩니다.

```yaml
services:
  - name: "my-api"     → docs/my-api/, skills/my-api/
  - name: "my-frontend" → docs/my-frontend/, skills/my-frontend/
```

### 4.2 제약

- **공백 금지**: 서버 validation에서 거부
- **권장 형식**: kebab-case (`my-api`, `user-service`)
- **대소문자 구분**: 유지 (name이 `MyAPI`이면 폴더도 `MyAPI`)

### 4.3 docs/ 파일명

doc-templates의 원본 파일명을 그대로 유지합니다. 번호 접두사(`00-`, `20-` 등) 포함.

### 4.4 skills/ 폴더 구조

`skill-templates/per-framework/{framework}/` 하위의 **폴더 구조를 그대로** 복사합니다.

```
skill-templates/per-framework/fastapi/
├── coding-standards/SKILL.md
├── testing/SKILL.md
├── framework/SKILL.md
└── deployment/SKILL.md

→ skills/my-api/
├── coding-standards/SKILL.md
├── testing/SKILL.md
├── framework/SKILL.md
└── deployment/SKILL.md
```

---

## 5. 검증 체크리스트

출력 ZIP이 유효한지 판정하는 규칙입니다. 모든 항목을 통과해야 합니다.

### 5.1 구조 검증

| # | 검증 항목 | 판정 기준 |
|---|----------|----------|
| S-1 | ZIP 루트 폴더 | `{project.name}/` 단일 루트 |
| S-2 | CLAUDE.md 존재 | 루트에 1개 |
| S-3 | docs/common/ 파일 수 | 정확히 12개 |
| S-4 | skills/common/ 폴더 수 | 정확히 3개 (git, observability, code-comments) |
| S-5 | 서비스 폴더 일치 | `services[].name`마다 `docs/{name}/`과 `skills/{name}/`이 **둘 다** 존재 |
| S-6 | 서비스별 docs/ 파일 | 타입에 맞는 파일이 존재 (§3.2 참조) |
| S-7 | 서비스별 skills/ 파일 | 정확히 4개 (coding-standards, testing, framework, deployment) |
| S-8 | 총 파일 수 | §3.4 공식과 일치 |
| S-9 | 빈 파일 없음 | 모든 파일 크기 > 0 bytes |

### 5.2 내용 검증

| # | 검증 항목 | 판정 기준 |
|---|----------|----------|
| C-1 | Jinja2 미치환 없음 | `{{`와 `}}`가 남아있지 않음 |
| C-2 | ADR 번호 연속 | `02-architecture-decisions.md`의 ADR-N이 1부터 연속, 빈 번호 없음 |
| C-3 | Mermaid 코드 블록 | 소스 데이터가 truthy인 다이어그램만 존재. 빈 Mermaid 블록 없음 |
| C-4 | 빈 테이블 없음 | 헤더+구분행만 있고 데이터 행이 없는 테이블이 없음 |
| C-5 | 빈 섹션 없음 | 섹션 헤더 바로 다음에 다른 헤더나 구분선만 오는 경우 없음 (07, 09, 10, 11, 12 제외) |
| C-6 | 연속 구분선 없음 | `---`가 연속으로 등장하지 않음 |
| C-7 | 후행 공백 없음 | 줄 끝에 불필요한 공백 없음 |

### 5.3 교차 검증

| # | 검증 항목 | 판정 기준 |
|---|----------|----------|
| X-1 | CLAUDE.md ↔ services | CLAUDE.md §1, §2의 서비스 목록이 `services[]`와 일치 |
| X-2 | CLAUDE.md ↔ docs/ | CLAUDE.md §4 Document Map에 나열된 서비스 문서가 실제 docs/에 존재 |
| X-3 | docs/common/04 ↔ services | 04-infrastructure §1 배포 테이블의 서비스가 `services[]`와 일치 |
| X-4 | docs/common/12 ↔ services | 12-runbook §1~§2의 서비스가 `services[]`와 일치 |
| X-5 | docs/common/02 ↔ services | 02-architecture-decisions §2 서비스 목록이 `services[]`와 일치 |

### 5.4 서버 리소스 원본 검증 (.sdwc/)

`.sdwc/`는 렌더링 산출물이 아닌 **서버 리소스 원본의 단순 복사**입니다. 파일 수 공식(§3.4)에는 포함되지 않으며, 아래 항목으로 별도 검증합니다.

| # | 검증 항목 | 판정 기준 |
|---|----------|----------|
| R-1 | `.sdwc/` 디렉터리 존재 | ZIP 루트에 `.sdwc/` 존재 |
| R-2 | 필수 파일 존재 | `intake_template.yaml`, `CLAUDE_BASE.md`, `generation_rules.md`, `output_contract.md` — 4개 모두 존재 |
| R-3 | 필수 디렉터리 존재 | `doc-templates/`, `skill-templates/` — 2개 모두 존재, 각각 비어있지 않음 |

---

## 6. 에러 케이스

Template Engine이 정상적으로 ZIP을 생성할 수 없는 경우의 동작을 정의합니다.

### 6.1 에러 분류

| 에러 | 원인 | 시점 | 동작 |
|------|------|------|------|
| **E-1: Validation 실패** | required 필드 누락, CRITICAL enum 불일치, per_service ↔ services 불일치 | 렌더링 전 | ZIP 생성 중단. 에러 메시지 반환 |
| **E-2: 템플릿 미존재** | `services[i].framework` 값에 해당하는 skill-templates/per-framework/ 폴더 없음 | 렌더링 시 | ZIP 생성 중단. 에러 메시지: "Framework '{value}' not supported" |
| **E-3: 렌더링 실패** | Jinja2 문법 오류, 존재하지 않는 변수 참조 | 렌더링 시 | ZIP 생성 중단. 에러 메시지: 실패한 템플릿 파일명 + 오류 상세 |
| **E-4: Mermaid 생성 실패** | 소스 데이터 구조 불일치 (예: relationships.target이 존재하지 않는 엔티티 참조) | 렌더링 시 | 해당 다이어그램 생략, 경고 로그. ZIP 생성은 계속 |
| **E-5: .sdwc/ 복사 실패** | 서버 리소스 파일 접근 불가, 디스크 공간 부족 | 패키징 시 | `.sdwc/` 생략, 경고 로그. ZIP 생성은 계속 |

### 6.2 원칙

- **E-1 ~ E-3**: ZIP을 **생성하지 않습니다**. 불완전한 ZIP을 전달하면 Claude Code가 잘못된 문서를 기반으로 작업하게 됩니다.
- **E-4**: Mermaid 다이어그램은 보조 자료이므로 생략해도 문서의 핵심 기능은 유지됩니다. 경고를 남기고 계속 진행합니다.
- **E-5**: `.sdwc/`는 프로젝트 진화 시 참조용 원본이므로, 핵심 산출물(CLAUDE.md, docs/, skills/)과 독립적입니다. 경고를 남기고 계속 진행합니다.

### 6.3 에러 응답 형식

```json
{
  "success": false,
  "error": {
    "code": "E-2",
    "message": "Framework 'unknown_framework' not supported",
    "detail": "Service 'my-api' uses framework 'unknown_framework', but skill-templates/per-framework/unknown_framework/ does not exist.",
    "service": "my-api"
  }
}
```

성공 시:

```json
{
  "success": true,
  "file_count": 26,
  "warnings": [
    "Mermaid ERD skipped for service 'my-api': entity 'Post' references unknown target 'Comment'"
  ]
}
```
