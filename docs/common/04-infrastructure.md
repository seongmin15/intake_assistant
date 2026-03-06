# 인프라 및 운영

---

## 1. 배포

### 서비스별 배포 개요

| 서비스 | 배포 대상 | CI | CD | 컨테이너 레지스트리 | 시크릿 관리 |
|--------|----------|-----|-----|---------------------|-----------|
| intake-assistant-api | kubernetes | github_actions | argocd | ghcr | env_file |
| intake-assistant-web | kubernetes | github_actions | argocd | ghcr | env_file |

> 배포 명령어, Dockerfile 작성, CI/CD 파이프라인 설정 등 상세 규칙은 skills/{service}/deployment/ 참조

---

## 2. 관측성

| 항목 | 도구 |
|------|------|
| 로깅 | structlog (구조화: True) |


> 로그 레벨 기준, 메트릭 네이밍, 마스킹 패턴 등 상세 규칙은 skills/common/observability/ 참조

---

## 4. 성능 요구사항

- **예상 동시 사용자**: 1~5

### 응답 시간 목표

| 엔드포인트/플로우 | P50 | P99 |
|-----------------|-----|-----|
| POST /api/v1/analyze (Haiku) | 2s | 5s |
| POST /api/v1/generate (Sonnet + validate-retry) | 12s | 45s |


---

## 5. 개발 프로세스

- **방법론**: kanban
- **WIP 제한**: 2


---

## 6. 코딩 표준 (요약)


- **커밋 컨벤션**: conventional


> 상세 규칙은 skills/ 참조

---

## 7. 버전 관리 (요약)

- **브랜치 전략**: github_flow
- **저장소 구조**: monorepo


> 상세 규칙은 skills/git/SKILL.md 참조

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지. -->
