# 트러블슈팅 가이드

> 이 문서는 Claude가 개발·운영 과정에서 발견한 문제와 해결법을 기록합니다.
> 배포·운영 절차는 12-runbook.md를 참조하세요.

---

## 알려진 이슈 및 해결법

<!-- Claude: 아래 기준에 해당하면 기록:
     - 원인 파악에 10분 이상 걸린 이슈
     - 같은 원인이 반복될 가능성이 있는 이슈
     - 환경/설정 관련 이슈 (다른 개발자도 겪을 수 있음)
     단순 오타, 1회성 실수는 기록 불필요.
     카테고리 예시: [환경] [빌드] [런타임] [데이터] [배포] [외부서비스] -->

### [런타임] analyze API — inferred_hints Pydantic 검증 실패
- **증상**: POST /api/v1/analyze 호출 시 `AnalyzeResponse` 검증 오류 발생. `inferred_hints` 필드에 `Input should be a valid string` 에러 다수 (location_based, filtering_required 등).
- **원인**: `Analysis.inferred_hints` 타입이 `dict[str, str]`로 정의되어 있었으나, Haiku가 `"location_based": true` 같은 bool 값을 반환. Pydantic이 str이 아닌 bool을 거부.
- **해결**: `inferred_hints` 타입을 `dict[str, Any]`로 변경하여 str, bool, int 등 혼합 타입 허용.
- **예방**: AI 응답 스키마 정의 시 LLM이 다양한 타입을 반환할 수 있는 필드는 `Any` 또는 유니온 타입으로 선언. `analysis` 필드는 내부 참조용이므로 엄격한 타입 불필요.
- **발견일**: 2026-03-08
