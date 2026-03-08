# 요구사항

---

## 1. 핵심 목표

| 목표 | 측정 기준 | 우선순위 |
|------|----------|---------|
| 비개발자가 자유 텍스트와 3~4개 질문 응답만으로 유효한 intake_data.yaml을 생성 | SDwC validation 에러 0건으로 통과 | P0 |
| 사용자가 아키텍처 카드로 결과를 이해하고 수정 요청 가능 | 수정 반복 후 재생성된 YAML도 validation 0건 통과 | P0 |
| 생성 완료 후 SDwC를 통해 ZIP 프로젝트를 다운로드 | intake-assistant-web에서 SDwC /generate 호출 → ZIP 수신 성공 | P0 |

---

## 2. 성공 시나리오

비개발자가 "점심 메뉴 추천 앱을 만들고 싶어요"라고 입력하면, 3~4개 질문(플랫폼, 저장 방식, 멀티유저, 외부 서비스)에 답한 뒤 아키텍처 카드(iOS 앱/SwiftUI, 로컬 저장, 인증 없음, Google Places API, 3화면)를 확인하고, "이대로 진행" 버튼으로 ZIP 프로젝트를 다운로드한다.


---

## 3. 비목표

| 비목표 | 근거 | 재검토 시점 |
|--------|------|-----------|
| 실시간 대화형 코딩 어시스턴트 | intake-assistant는 intake_data.yaml 생성까지만 담당. 이후 개발 과정 지원은 SDwC와 Claude Code의 역할. |  |
| intake_data.yaml의 부분 수정 (diff 기반) | 전체 재생성 방식이 비용 차이 미미하고 정합성 보장. 부분 수정은 불필요한 복잡도. |  |

---

## 4. 범위

### 4.1 포함 (In-Scope)

| 기능 | 사용자 스토리 | 우선순위 | 복잡도 |
|------|-------------|---------|--------|
| 모드 선택 (Simple / Advanced) | 사용자가 Simple 모드와 Advanced 모드 중 선택한다. Advanced 선택 시 8단계 위저드 폼으로 이동한다. | must | S |
| Advanced 모드 (8단계 위저드 폼) | 개발자가 intake_template.yaml의 8 phase(WHY~WHAT-NEXT)를 단계별 폼으로 직접 입력하고, 필드별 AI 추천을 받아 YAML을 생성한다. | must | XL |
| 자유 텍스트 입력 | 사용자가 만들고 싶은 서비스를 자유롭게 설명한다 | must | S |
| 동적 질문 생성 (Q1~Q4) | AI가 첫 입력을 분석하여 플랫폼, 데이터 영속성, 멀티유저, 외부 의존성 질문을 제시한다 | must | M |
| intake_data.yaml 생성 | 사용자 응답 기반으로 AI가 SDwC 호환 intake_data.yaml 전체를 생성한다 | must | L |
| 아키텍처 카드 표시 | 생성 결과를 비개발자가 이해할 수 있는 5항목 카드와 기능 체크리스트로 확인한다 | must | M |
| 수정 반복 | 사용자가 자유 텍스트로 수정 요청을 하면 AI가 intake_data.yaml을 전체 재생성한다 | must | M |
| SDwC 연동 (ZIP 생성) | '이대로 진행' 버튼을 누르면 SDwC /generate를 호출하여 ZIP 프로젝트를 다운로드한다 | must | S |
| SDwC 템플릿 동기화 | intake-assistant 시작 시 SDwC /api/v1/template에서 최신 템플릿을 수신한다 | must | S |

### 4.2 제외 (Out-of-Scope)

| 기능 | 제외 사유 | 예정 시점 |
|------|----------|----------|
| 대화 이력 저장 | stateless 설계. 브라우저 탭을 닫으면 대화 종료. |  |
| 사용자 계정/인증 | 내부 도구 수준이며 개인 데이터를 저장하지 않음 |  |
| intake_data.yaml 직접 편집 UI (텍스트 에디터) | 폼 기반 UI를 제공하므로 raw YAML 텍스트 에디터는 불필요. |  |

---

## 5. 가정

| 가정 | 틀리면? | 검증 계획 |
|------|--------|----------|
| SDwC /api/v1/generate와 /api/v1/template 엔드포인트가 안정적으로 동작한다 | intake-assistant의 ZIP 생성과 템플릿 동기화가 모두 실패 |  |
| Anthropic API (Haiku, Sonnet)가 안정적으로 접근 가능하다 | 동적 질문 생성과 YAML 생성 모두 불가 |  |
| A-B-C 모델로 비개발자에게 기술 질문 없이도 유효한 아키텍처를 추론할 수 있다 | 생성된 YAML의 아키텍처 품질이 떨어져서 수정 반복 횟수 증가 |  |
| intake_template.yaml의 주석에 명시된 필드 속성(required/optional, enum 값)이 실제 validator 동작과 일치한다 | 템플릿 주석에 없는 필드가 validator에서 required로 요구되어 validation 에러 발생. 시스템 프롬프트에 validator 기준 스키마를 별도 관리해야 함. |  |

---

## 6. 제약 조건


<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지. -->
