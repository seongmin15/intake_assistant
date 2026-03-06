# 아키텍처 결정

---

## 1. 아키텍처 패턴

- **패턴**: modular_monolith
- **선택 이유**: 서비스가 2개(API + Web)뿐이고 단일 개발자. 모노레포 내 모듈 분리로 충분.


---

## 2. 시스템 구성

### 서비스 목록

| 서비스명 | 타입 | 책임 | 언어/프레임워크 |
|---------|------|------|---------------|
| intake-assistant-api | backend_api | AI 대화 처리, 동적 질문 생성, intake_data.yaml 생성, SDwC 연동 | python + fastapi |
| intake-assistant-web | web_ui | Simple 모드 UI -- 자유 텍스트 입력, 동적 질문, 아키텍처 카드, 수정 반복, ZIP 다운로드 | typescript + react |

### 서비스 간 통신

| 출발 | 도착 | 프로토콜 | 동기/비동기 |
|------|------|---------|-----------|
| intake-assistant-api | intake-assistant-web | http | sync |
| intake-assistant-web | intake-assistant-api | http | sync |

### 외부 시스템 연동

| 시스템 | 목적 | 프로토콜 | 신뢰성 | 장애 대응 |
|--------|------|---------|--------|----------|
| Anthropic API | 동적 질문 생성 (Haiku), intake_data.yaml 생성 및 수정 (Sonnet) | http | high | 재시도 3회 후 사용자에게 에러 표시 |
| SDwC API | intake_template.yaml 수신, YAML validation, ZIP 프로젝트 생성 | http | high | SDwC 접속 불가 시 헬스체크에서 degraded 표시, ZIP 생성 단계에서 에러 표시 |
| sdwc-web | Advanced 모드 제공. ModeSelectorPage에서 Advanced 선택 시 리다이렉트 대상. | http | high |  |

---

## 3. 핵심 라이브러리

### intake-assistant-api

| 이름 | 용도 | 버전 제약 |
|------|------|----------|
| anthropic | Anthropic API 호출 (Haiku, Sonnet) |  |
| pyyaml | intake_data.yaml 파싱 및 생성 |  |
| httpx | SDwC API 호출 (비동기) |  |
| pydantic | 요청/응답 스키마 검증 |  |

---


## 5. ADR 로그


### ADR-1: 아키텍처 패턴

- **결정**: modular_monolith
- **맥락**: 서비스가 2개(API + Web)뿐이고 단일 개발자. 모노레포 내 모듈 분리로 충분.
- **검토한 대안**:

| 대안 | 장점 | 단점 | 탈락 사유 |
|------|------|------|----------|
| microservices | 독립 배포, 기술 스택 자유도 | 2개 서비스에 과도한 인프라 복잡도 | 단일 개발자 + 서비스 2개에서 마이크로서비스는 오버엔지니어링 |

- **상태**: 확정

---

### ADR-2: intake-assistant-api 기술 스택

- **결정**: python + fastapi + poetry
- **맥락**: Anthropic Python SDK와 자연스러운 통합, async 지원, 빠른 개발

- **검토한 대안**:

| 대안 | 탈락 사유 |
|------|----------|
| express | Anthropic SDK가 Python/TypeScript 모두 지원하나, 프롬프트 엔지니어링 도구 생태계가 Python에 더 풍부 |

- **상태**: 확정

---


### ADR-3: intake-assistant-api 배포 방식

- **결정**: kubernetes
- **맥락**: SDwC와 같은 k3s 클러스터에서 운영


- **상태**: 확정

---

### ADR-4: intake-assistant-web 기술 스택

- **결정**: typescript + react + vite
- **맥락**: SDwC 프로젝트 생태계와 일관성, 컴포넌트 기반 UI 구성에 적합


- **상태**: 확정

---


### ADR-5: intake-assistant-web 배포 방식

- **결정**: kubernetes
- **맥락**: intake-assistant-api와 같은 k3s 클러스터


- **상태**: 확정

---


<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지.
     ADR 번호는 이 문서의 마지막 ADR 번호 + 1로 채번.
     형식: ### ADR-NNN: 제목 → 결정/맥락/대안/상태.
     상태 값: 확정 | 제안 | 폐기 -->
