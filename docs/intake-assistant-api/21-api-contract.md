# API 계약

---

## 1. API 개요

- **스타일**: rest
- **선택 이유**: 단순한 요청-응답 패턴. GraphQL/gRPC의 복잡도가 불필요.

---

## 2. 인증

- **방식**: none
- **수용 리스크**: 내부 도구 수준이며 k3s 클러스터 내부 통신. 외부 노출 시 API gateway에서 제어.

---


## 4. 엔드포인트 상세

### POST /api/v1/analyze

> 첫 입력 텍스트를 분석하여 동적 질문 목록(Q1~Q4) 생성

- **인증**: False

**요청**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| user_input | string | True | 사용자의 자유 텍스트 입력 |

**응답**

| 필드 | 타입 | 설명 |
|------|------|------|
| questions | json | 동적 질문 목록 (Q1~Q4, 각 질문의 선택지 포함) |
| analysis | json | 첫 입력 분석 결과 (감지된 키워드, 추론된 힌트) |

**처리 로직**

1. 첫 입력 텍스트에서 키워드 감지 (자동화/배치/크론, 외부 서비스 힌트 등)
2. Haiku 호출로 Q1~Q4 선택지 구성 (조건부 선택지 포함/제외 결정)
3. 질문 목록 + 분석 결과 반환

---

### POST /api/v1/generate

> 사용자 입력 + Q&A 응답을 기반으로 intake_data.yaml 전체 생성

- **인증**: False

**요청**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| user_input | string | True | 사용자의 첫 입력 텍스트 |
| qa_answers | json | True | Q1~Q4 응답 (질문ID + 선택값) |
| revision_request | string | False | 수정 요청 텍스트 (수정 반복 시) |
| previous_yaml | string | False | 이전 생성된 intake_data.yaml (수정 반복 시) |

**응답**

| 필드 | 타입 | 설명 |
|------|------|------|
| yaml_content | string | 생성된 intake_data.yaml 전체 텍스트 |
| architecture_card | json | 아키텍처 카드 5항목 (서비스 구성, 데이터 저장, 인증, 외부 서비스, 화면 수) |
| feature_checklist | json | 기능 체크리스트 (화면/엔드포인트별 한 줄 요약) |

**처리 로직**

1. SDwC 템플릿 구조 + 사용자 입력 + Q&A 응답 + (수정 시) 이전 YAML을 컨텍스트에 포함
2. Sonnet 호출로 intake_data.yaml 전체 생성 (DELETE 원칙 적용)
3. SDwC /api/v1/validate 호출로 생성된 YAML 검증
4. validation 실패 시: 에러 메시지 + 생성된 YAML을 컨텍스트에 포함하여 Sonnet 재호출 (최대 2회 재시도)
5. 재시도 후에도 실패 시: 에러 로그 기록 + 사용자에게 '다시 생성' 표시
6. validation 통과 시: YAML 파싱하여 아키텍처 카드 5항목 추출
7. 기능 체크리스트 추출

---

### POST /api/v1/finalize

> '이대로 진행' -- 검증 완료된 YAML을 SDwC에 전달하여 ZIP 생성

- **인증**: False

**요청**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| yaml_content | string | True | 확정된 intake_data.yaml 텍스트 (/generate에서 validation 통과 완료) |

**응답**

| 필드 | 타입 | 설명 |
|------|------|------|
| zip_file | string | ZIP 파일 (바이너리, 스트림 응답) |

**처리 로직**

1. SDwC /api/v1/generate 호출로 ZIP 생성 (validation은 /generate에서 이미 완료)
2. ZIP 바이너리를 클라이언트에 스트림 응답

---

### GET /api/v1/health

> 헬스체크 (SDwC 연결 상태 포함)

- **인증**: False


**응답**

| 필드 | 타입 | 설명 |
|------|------|------|
| status | string | healthy | degraded |
| sdwc_reachable | boolean | SDwC API 접근 가능 여부 |


---


<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지. -->
