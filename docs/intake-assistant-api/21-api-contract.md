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

### POST /api/v1/analyze/stream

> SSE 스트리밍 방식으로 동적 질문 생성 (실시간 진행 상태 표시)

- **인증**: False

**요청**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| user_input | string | True | 사용자의 자유 텍스트 입력 |

**응답**: `text/event-stream` (Server-Sent Events)

| SSE 이벤트 | data 필드 | 설명 |
|------------|-----------|------|
| status | phase | 진행 상태 (analyzing) |
| chunk | text | LLM 응답 텍스트 조각 (실시간 스트리밍) |
| result | questions, analysis | 최종 분석 결과 (/analyze 응답과 동일) |
| error | message | 에러 발생 시 에러 메시지 |

**처리 로직**

1. /api/v1/analyze와 동일한 로직 (Haiku 호출 + 질문 생성)
2. 차이점: LLM 응답을 실시간 스트리밍 (`client.messages.stream()` 사용)
3. 진행 상태를 SSE 이벤트로 클라이언트에 실시간 전달

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

### POST /api/v1/generate/stream

> SSE 스트리밍 방식으로 intake_data.yaml 생성 (실시간 진행 상태 표시)

- **인증**: False

**요청**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| user_input | string | True | 사용자의 첫 입력 텍스트 |
| qa_answers | json | True | Q1~Q4 응답 (질문ID + 선택값) |
| revision_request | string | False | 수정 요청 텍스트 (수정 반복 시) |
| previous_yaml | string | False | 이전 생성된 intake_data.yaml (수정 반복 시) |

**응답**: `text/event-stream` (Server-Sent Events)

| SSE 이벤트 | data 필드 | 설명 |
|------------|-----------|------|
| status | phase, attempt, max_attempts | 진행 상태 (generating, validating, retry) |
| chunk | text | LLM 응답 텍스트 조각 (실시간 스트리밍) |
| result | yaml_content, architecture_card, feature_checklist | 최종 생성 결과 (/generate 응답과 동일) |
| error | message | 에러 발생 시 에러 메시지 |

**처리 로직**

1. /api/v1/generate와 동일한 로직 (SDwC 템플릿 + Sonnet 호출 + validate-retry)
2. 차이점: LLM 응답을 실시간 스트리밍 (`client.messages.stream()` 사용)
3. 진행 상태를 SSE 이벤트로 클라이언트에 실시간 전달
4. 시스템 프롬프트에 prompt caching 적용 (`cache_control: ephemeral`)

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


### POST /api/v1/validate-yaml

> Advanced 모드에서 작성한 YAML을 SDwC 스키마로 검증

- **인증**: False

**요청**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| yaml_content | string | True | 검증할 intake_data.yaml 텍스트 |

**응답**

| 필드 | 타입 | 설명 |
|------|------|------|
| valid | boolean | 검증 통과 여부 |
| errors | string[] | 검증 에러 목록 |
| warnings | string[] | 검증 경고 목록 |

**처리 로직**

1. SDwC /api/v1/validate 호출로 YAML 검증
2. SDwC 응답 형식(dict 또는 list)을 플랫 문자열 목록으로 변환
3. SDwC 연결 실패 시 valid=false + 연결 에러 메시지 반환

---

### POST /api/v1/recommend

> Advanced 모드에서 개별 필드에 대한 AI 추천 값 생성

- **인증**: False

**요청**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| context | json | False | 사용자가 이미 입력한 부분 폼 데이터 (기본값: {}) |
| field_path | string | True | 추천할 필드의 dot-notation 경로 (e.g., "problem.severity") |
| field_info | json | False | 필드 메타데이터 (description, enum_values, field_type) |

**응답**

| 필드 | 타입 | 설명 |
|------|------|------|
| suggestion | string | AI가 추천하는 필드 값 |
| rationale | string | 추천 이유 (한국어) |

**처리 로직**

1. context + field_path + field_info를 사용자 메시지로 조합
2. Haiku 호출로 단일 필드 추천 값 + 근거 생성
3. JSON 응답 파싱 (마크다운 코드 블록 자동 제거)
4. API 에러 시 최대 2회 재시도 (1초, 2초 백오프)

---

### 4.9. GET /api/v1/schema-meta

> 템플릿 메타데이터 반환 — 프론트엔드 스키마 드리프트 감지용

**요청**: 없음 (GET)

**응답**

| 필드 | 타입 | 설명 |
|------|------|------|
| template_hash | string | 템플릿 YAML의 SHA-256 해시 (sha256:...) |
| service_types | string[] | 사용 가능한 서비스 타입 목록 |
| enum_fields | Record<string, string[]> | enum 필드별 허용값 (dot-notation path → values) |
| required_fields | string[] | 필수 필드 경로 목록 (dot-notation) |

**처리 로직**

1. template_cache에서 field_requirements.yaml 로드
2. 재귀 파싱으로 enum 필드, required 필드, service_types 추출
3. template YAML 원본 텍스트의 SHA-256 해시 계산
4. field_requirements 미로드 시 빈 fallback 반환 (template_hash만 포함)

**상태**

- Rate limit 제외 (GET 엔드포인트)
- 템플릿 미로드 시 200 + 빈 메타데이터 반환

---

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지. -->
