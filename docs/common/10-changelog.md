# Changelog

> 이 문서는 Claude가 릴리스 시마다 작성·관리합니다.

---

## [Unreleased]

### Added
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

<!-- Claude: §5.8 작업 완료 시 해당 변경을 [Unreleased]에 기록.
     분류 기준:
     - Added: 새 기능, 새 엔드포인트, 새 엔티티
     - Changed: 기존 동작 변경, 리팩터링
     - Fixed: 버그 수정
     - Removed: 기능/코드 삭제
     한 줄에 "무엇이 어떻게 변했는가"만 간결하게.
     릴리스 시 [Unreleased]를 버전 번호로 전환.
     형식: ## [X.Y.Z] - YYYY-MM-DD -->
