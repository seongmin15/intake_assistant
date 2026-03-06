# 품질 계획

---

## 1. 테스트 전략

- **접근법**: {{ testing.approach }}

### 테스트 레벨

| 레벨 | 커버리지 목표 | 프레임워크 |
|------|-------------|----------|
{% for level in testing.levels %}
| {{ level.level }} | {{ level.coverage_target }} | {{ level.framework }} |
{% endfor %}

> 테스트 파일 구조, 픽스처/mock 패턴, 실행 명령어 등 상세 규칙은 skills/{service}/testing/ 참조

---

## 2. 보안 요구사항

### 2.1 보안 항목

| 카테고리 | 요구사항 | 구현 접근 |
|---------|---------|----------|
{% for requir_i in security.requirements %}
| {{ requir_i.category }} | {{ requir_i.requirement }} | {{ requir_i.implementation_approach }} |
{% endfor %}

{% if security.input_validation_strategy %}
### 2.2 입력값 검증 전략

{{ security.input_validation_strategy }}
{% endif %}

{% if security.threat_model %}
### 2.3 위협 모델

| 위협 | 완화 방안 |
|------|----------|
{% for threat_i in security.threat_model %}
| {{ threat_i.threat }} | {{ threat_i.mitigation }} |
{% endfor %}
{% endif %}

{% if security.sensitive_data %}
### 2.4 민감 데이터

| 데이터 | 보호 방법 | 보관 정책 |
|--------|----------|----------|
{% for sensit_i in security.sensitive_data %}
| {{ sensit_i.data_type }} | {{ sensit_i.protection_method }} | {{ sensit_i.retention_policy }} |
{% endfor %}
{% endif %}

{% if security.compliance_requirements %}
### 2.5 규제 준수

{% for compli_i in security.compliance_requirements %}
- {{ compli_i }}
{% endfor %}
{% endif %}

{% if security.accepted_security_risks %}
### 2.6 수용한 보안 리스크

| 리스크 | 수용 사유 | 재검토 시점 |
|--------|----------|-----------| 
{% for accept_i in security.accepted_security_risks %}
| {{ accept_i.risk }} | {{ accept_i.acceptance_rationale }} | {{ accept_i.reconsider_when }} |
{% endfor %}
{% endif %}

---

## 3. 에러 처리 및 실패 시나리오

### 핵심 플로우별 분석

{% for flow in critical_flows %}
#### {{ flow.flow_name }}

- **정상 흐름**: {{ flow.happy_path }}

{% if flow.failure_scenarios %}
- **실패 시나리오**:

| 시나리오 | 가능성 | 영향 | 대응 |
|---------|--------|------|------|
{% for failur_i in flow.failure_scenarios %}
| {{ failur_i.scenario }} | {{ failur_i.likelihood }} | {{ failur_i.impact }} | {{ failur_i.handling_strategy }} |
{% endfor %}
{% endif %}

{% endfor %}

{% if global_error_handling %}
### 전역 에러 처리

{% if global_error_handling.retry_policy %}
- **재시도**: {{ global_error_handling.retry_policy }}
{% endif %}
{% if global_error_handling.circuit_breaker %}
- **서킷 브레이커**: {{ global_error_handling.circuit_breaker }}
{% endif %}
{% if global_error_handling.graceful_degradation %}
- **우아한 퇴화**: {{ global_error_handling.graceful_degradation }}
{% endif %}
{% if global_error_handling.dead_letter_queue %}
- **DLQ**: {{ global_error_handling.dead_letter_queue }}
{% endif %}
{% endif %}

{% if data_consistency %}
### 데이터 정합성

{{ data_consistency }}
{% endif %}

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지. -->
