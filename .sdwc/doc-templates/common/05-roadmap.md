# 로드맵

---

{% if evolution.future_features %}
## 1. 향후 기능

| 기능 | 예정 시점 | 아키텍처 영향 | 지금 준비할 것 |
|------|----------|-------------|-------------|
{% for future_i in evolution.future_features %}
| {{ future_i.feature }} | {{ future_i.planned_phase }} | {{ future_i.architectural_impact }} | {{ future_i.preparation_needed }} |
{% endfor %}
{% endif %}

---

## 2. 진화 경로

{% if evolution.migration_path %}
{{ evolution.migration_path }}
{% endif %}

{% if evolution.sunset_criteria %}
- **폐기 기준**: {{ evolution.sunset_criteria }}
{% endif %}

---

## 3. 기술 리스크

| 리스크 | 가능성 | 영향 | 완화 방안 | Plan B |
|--------|--------|------|----------|--------|
{% for techni_i in risks.technical %}
| {{ techni_i.risk }} | {{ techni_i.likelihood }} | {{ techni_i.impact }} | {{ techni_i.mitigation }} | {{ techni_i.contingency }} |
{% endfor %}

---

## 4. 되돌리기 어려운 결정

| 결정 | 왜 되돌리기 어려운가 | 확신도 | 되돌림 비용 |
|------|-------------------|--------|-----------|
{% for irreve_i in risks.irreversible_decisions %}
| {{ irreve_i.decision }} | {{ irreve_i.why_irreversible }} | {{ irreve_i.confidence_level }} | {{ irreve_i.reversal_cost }} |
{% endfor %}

---

{% if risks.known_technical_debt %}
## 5. 기술 부채

| 부채 | 지금 안 하는 이유 | 해결 계획 |
|------|-----------------|----------|
{% for known__i in risks.known_technical_debt %}
| {{ known__i.debt }} | {{ known__i.reason }} | {{ known__i.resolution_plan }} |
{% endfor %}

---
{% endif %}

{% if rollout %}
## 6. 롤아웃 계획

{% if rollout.strategy %}
- **전략**: {{ rollout.strategy }}
{% endif %}

{% if rollout.phases %}
### 단계

| 단계 | 대상 | 성공 기준 |
|------|------|----------|
{% for phase in rollout.phases %}
| {{ phase.phase }} | {{ phase.audience }} | {{ phase.success_criteria }} |
{% endfor %}
{% endif %}

{% if rollout.rollback_plan %}
- **롤백 계획**: {{ rollout.rollback_plan }}
{% endif %}
{% if rollout.db_migration_strategy %}
- **DB 마이그레이션**: {{ rollout.db_migration_strategy }}
{% endif %}

---
{% endif %}

## 7. 운영 계획

{% if operations.on_call_policy %}
- **온콜**: {{ operations.on_call_policy }}
{% endif %}
{% if operations.incident_response %}
- **인시던트 대응**: {{ operations.incident_response }}
{% endif %}
{% if operations.maintenance_window %}
- **유지보수 윈도우**: {{ operations.maintenance_window }}
{% endif %}
{% if operations.documentation_maintenance %}
- **문서 관리**: {{ operations.documentation_maintenance }}
{% endif %}

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지. -->
