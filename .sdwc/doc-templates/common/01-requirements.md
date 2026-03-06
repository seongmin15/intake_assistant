# 요구사항

---

## 1. 핵심 목표

| 목표 | 측정 기준 | 우선순위 |
|------|----------|---------|
{% for goal in goals.primary %}
| {{ goal.goal }} | {{ goal.measurable_criterion }} | {{ goal.priority }} |
{% endfor %}

---

## 2. 성공 시나리오

{{ goals.success_scenario }}

{% if goals.success_metrics %}
### 성공 지표

| 지표 | 현재 값 | 목표 값 | 측정 방법 |
|------|--------|--------|----------|
{% for metric in goals.success_metrics %}
| {{ metric.metric }} | {{ metric.current_value }} | {{ metric.target_value }} | {{ metric.measurement_method }} |
{% endfor %}
{% endif %}

---

## 3. 비목표

| 비목표 | 근거 | 재검토 시점 |
|--------|------|-----------|
{% for ng in non_goals %}
| {{ ng.statement }} | {{ ng.rationale }} | {{ ng.reconsider_when }} |
{% endfor %}

---

## 4. 범위

### 4.1 포함 (In-Scope)

| 기능 | 사용자 스토리 | 우선순위 | 복잡도 |
|------|-------------|---------|--------|
{% for feat in scope.in_scope %}
| {{ feat.feature }} | {{ feat.user_story }} | {{ feat.priority }} | {{ feat.complexity_estimate }} |
{% endfor %}

### 4.2 제외 (Out-of-Scope)

| 기능 | 제외 사유 | 예정 시점 |
|------|----------|----------|
{% for ofeat in scope.out_of_scope %}
| {{ ofeat.feature }} | {{ ofeat.reason }} | {{ ofeat.planned_phase }} |
{% endfor %}

---

## 5. 가정

| 가정 | 틀리면? | 검증 계획 |
|------|--------|----------|
{% for assump_i in assumptions %}
| {{ assump_i.assumption }} | {{ assump_i.if_wrong }} | {{ assump_i.validation_plan }} |
{% endfor %}

---

## 6. 제약 조건

{% if constraints %}
| 제약 | 출처 | 협상 가능 |
|------|------|----------|
{% for constr_i in constraints %}
| {{ constr_i.constraint }} | {{ constr_i.source }} | {{ constr_i.negotiable }} |
{% endfor %}
{% endif %}

{% if timeline %}
### 일정

- **데드라인**: {{ timeline.deadline }}
- **이유**: {{ timeline.reason }}
- **유연성**: {{ timeline.flexibility }}
{% endif %}

{% if budget %}
### 예산

{% if budget.monthly_budget %}
- **월 운영 예산**: {{ budget.monthly_budget }}
{% endif %}
{% if budget.one_time_budget %}
- **일회성 예산**: {{ budget.one_time_budget }}
{% endif %}
{% if budget.constraint_items %}
- **제약**:
{% for constr_i in budget.constraint_items %}
  - {{ constr_i }}
{% endfor %}
{% endif %}
{% endif %}

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지. -->
