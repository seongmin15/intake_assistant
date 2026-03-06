# UI 설계

---

## 1. 기술 스택

- **언어**: typescript
- **프레임워크**: react
- **빌드 도구**: vite
- **렌더링**: spa (서버사이드 렌더링 불필요. 단일 페이지에서 상태 전환으로 흐름 진행.)
- **CSS**: tailwind
- **상태 관리**: zustand

---

## 3. 페이지 상세

### ModeSelectorPage

> Simple / Advanced 모드 선택. Advanced 선택 시 sdwc-web으로 리다이렉트.

**주요 인터랙션:**

- Simple 모드 선택 → IntakePage로 이동
- Advanced 모드 선택 → sdwc-web URL로 리다이렉트 (외부 링크)


**컴포넌트:**

| 컴포넌트 | 역할 |
|---------|------|
| ModeCard | Simple/Advanced 모드 설명 카드 (각 모드의 대상과 차이점 표시) |

---

### IntakePage

> Simple 모드 전체 흐름을 단계별로 진행 (텍스트 입력 → 질문 → 카드 확인 → 수정 → 완료)

**주요 인터랙션:**

- 자유 텍스트 입력 후 '분석' 버튼
- Q1~Q4 선택지 응답
- 아키텍처 카드 5항목 + 기능 체크리스트 확인
- 자유 텍스트로 수정 요청 → 전체 재생성
- '이대로 진행' 버튼 → ZIP 다운로드

**연동 API:**

- POST /api/v1/analyze
- POST /api/v1/generate
- POST /api/v1/finalize

**UI 상태:**

- input -- 자유 텍스트 입력 대기
- analyzing -- 질문 생성 중 (로딩)
- questions -- Q1~Q4 표시
- generating -- YAML 생성 중 (로딩)
- review -- 아키텍처 카드 + 기능 체크리스트 표시
- revising -- 수정 요청 입력
- finalizing -- ZIP 생성 중 (로딩)
- complete -- ZIP 다운로드 완료
- error -- 에러 표시

**컴포넌트:**

| 컴포넌트 | 역할 |
|---------|------|
| TextInput | 자유 텍스트 입력 영역 + 가이드 힌트 표시 |
| QuestionCard | 동적 질문 하나의 선택지 UI (라디오/체크박스) |
| ArchitectureCard | 아키텍처 카드 5항목 표시 |
| FeatureChecklist | 기능 체크리스트 (읽기 전용) |
| RevisionInput | 수정 요청 자유 텍스트 입력 |

---


## 4. 횡단 관심사


<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지.
     페이지 추가 시 §2 페이지 흐름(mermaid)도 함께 갱신. -->
