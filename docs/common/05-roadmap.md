# 로드맵

---

## 3. 기술 리스크

| 리스크 | 가능성 | 영향 | 완화 방안 | Plan B |
|--------|--------|------|----------|--------|
| AI가 생성한 YAML이 SDwC validation을 통과하지 못하는 경우 | medium | low | /generate 내부에서 SDwC /validate → 에러 피드백 → Sonnet 재호출 루프 (최대 2회). 시스템 프롬프트에 DELETE 원칙 + 템플릿 구조 포함. | 재시도 후에도 실패하는 에러 패턴을 수집하여 시스템 프롬프트에 반영 |
| intake_template.yaml 주석과 실제 validator 동작 사이의 불일치 | medium | low | validate-retry 루프가 불일치를 런타임에 자동 보정. 템플릿 주석에 없는 required 필드도 validator 에러 메시지로 AI가 인지하고 수정. | 빈번한 불일치 패턴을 시스템 프롬프트에 명시적으로 추가 |
| Anthropic API 비용이 예상을 초과 | low | low | 건당 ~$0.30 수준 (v1.34 분석). validate-retry 시 Sonnet 추가 호출 발생하나 최대 2회로 제한 (~$0.60/건 상한). Prompt caching 활용으로 비용 절감. | 월간 비용 상한 알림 설정 |

---

## 4. 되돌리기 어려운 결정

| 결정 | 왜 되돌리기 어려운가 | 확신도 | 되돌림 비용 |
|------|-------------------|--------|-----------|
| Python + FastAPI 기술 스택 | 전체 API 코드 재작성 필요 | high | 전체 재구현 (1~2주) |
| Stateless 서버 (클라이언트 상태 전달) | 서버 세션으로 전환 시 API 계약 + 클라이언트 로직 모두 변경 | high | API 계약 변경 + 클라이언트 상태 관리 로직 제거 (3~5일) |
| intake-assistant-web을 SDwC-web과 별도 서비스로 분리 | sdwc-web에 통합하려면 SDwC 모노레포 의존성 + UI 재작성 필요 | high | sdwc-web에 Simple 모드 UI 재작성 (1주) |

---


## 7. 운영 계획


<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지. -->
