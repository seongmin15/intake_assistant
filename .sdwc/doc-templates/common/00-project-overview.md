# {{ project.name }}

{% if project.codename %}
> 코드네임: {{ project.codename }}
{% endif %}

> {{ project.one_liner }}

---

## 1. 개요

{{ project.elevator_pitch }}

---

## 2. 문제 정의

### 2.1 핵심 문제

{{ problem.statement }}

### 2.2 이 문제를 겪는 사람

{{ problem.who_has_this_problem }}

- **심각도**: {{ problem.severity }}
- **빈도**: {{ problem.frequency }}

### 2.3 현재 해결 방법과 한계

{{ problem.current_workaround }}

**문제점:**

{% for pain in problem.workaround_pain_points %}
- {{ pain }}
{% endfor %}

{% if problem.prior_attempts %}
### 2.4 이전 시도

{{ problem.prior_attempts }}
{% endif %}

---

## 3. 왜 지금인가

{{ motivation.why_now }}

{% if motivation.trigger_event %}
- **트리거**: {{ motivation.trigger_event }}
{% endif %}

{% if motivation.opportunity_cost %}
### 기회비용

{{ motivation.opportunity_cost }}
{% endif %}

{% if motivation.competitive_landscape %}
### 경쟁 환경

{{ motivation.competitive_landscape }}
{% endif %}

---

## 4. 핵심 가치 제안

- **핵심 가치**: {{ value_proposition.core_value }}
- **차별점**: {{ value_proposition.unique_differentiator }}

{% if value_proposition.value_hypothesis %}
- **가설**: {{ value_proposition.value_hypothesis }}
{% endif %}

---

## 5. 대상 사용자

### 5.1 사용자 페르소나

{% for user_p_i in user_personas %}
#### {{ user_p_i.name }}{{ " (핵심)" if user_p_i.is_primary else "" }}

- **설명**: {{ user_p_i.description }}
- **핵심 목표**: {{ user_p_i.primary_goal }}
- **페인 포인트**:
{% for pain_p_i in user_p_i.pain_points %}
  - {{ pain_p_i }}
{% endfor %}
{% if user_p_i.tech_proficiency %}
- **기술 수준**: {{ user_p_i.tech_proficiency }}
{% endif %}
{% if user_p_i.usage_frequency %}
- **사용 빈도**: {{ user_p_i.usage_frequency }}
{% endif %}

{% endfor %}

{% if anti_personas %}
### 5.2 안티 페르소나

| 이름 | 대상이 아닌 이유 |
|------|----------------|
{% for anti_p_i in anti_personas %}
| {{ anti_p_i.name }} | {{ anti_p_i.reason }} |
{% endfor %}
{% endif %}

{% if stakeholders %}
### 5.3 이해관계자

| 역할 | 주요 관심사 | 영향력 |
|------|-----------|--------|
{% for stakeh_i in stakeholders %}
| {{ stakeh_i.role }} | {{ stakeh_i.concern }} | {{ stakeh_i.influence_level }} |
{% endfor %}
{% endif %}

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지. -->
