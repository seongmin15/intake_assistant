# 모바일 설계

---

## 1. 기술 스택

- **접근법**: {{ approach }}
- **프레임워크**: {{ framework }}
{% if framework_rationale %}
- **선택 이유**: {{ framework_rationale }}
{% endif %}
- **최소 지원 버전**: {{ min_os_versions }}

{% if framework_alternatives %}
### 검토한 대안

| 대안 | 탈락 사유 |
|------|----------|
{% for framew_i in framework_alternatives %}
| {{ framew_i.name }} | {{ framew_i.rejection_reason }} |
{% endfor %}
{% endif %}

---

## 2. 네비게이션 구조

{% if navigation_pattern %}
- **패턴**: {{ navigation_pattern }}
{% endif %}

{{ mermaid_screen_flow }}

---

## 3. 화면 상세

{% for screen in screens %}
### {{ screen.name }}

> {{ screen.purpose }}

{% if screen.key_interactions %}
**주요 인터랙션:**

{% for key_in_i in screen.key_interactions %}
- {{ key_in_i }}
{% endfor %}
{% endif %}

{% if screen.connected_endpoints %}
**연동 API:**

{% for connec_i in screen.connected_endpoints %}
- {{ connec_i }}
{% endfor %}
{% endif %}

{% if screen.states %}
**UI 상태:**

{% for state_i in screen.states %}
- {{ state_i }}
{% endfor %}
{% endif %}

{% if screen.components %}
**컴포넌트:**

| 컴포넌트 | 역할 |
|---------|------|
{% for comp in screen.components %}
| {{ comp.name }} | {{ comp.purpose }} |
{% endfor %}
{% endif %}

---

{% endfor %}

## 4. 오프라인 전략

- **지원 여부**: {{ offline_support }}

{% if offline_support %}
{% if local_storage %}
- **로컬 저장소**: {{ local_storage }}
{% endif %}
{% if sync_strategy %}
- **동기화 전략**: {{ sync_strategy }}
{% endif %}
{% if cache_policy %}
- **캐시 정책**: {{ cache_policy }}
{% endif %}
{% endif %}

---

{% if device_features %}
## 5. 디바이스 기능

| 기능 | 용도 | 권한 | 거부 시 동작 |
|------|------|------|------------|
{% for device_i in device_features %}
| {{ device_i.feature }} | {{ device_i.purpose }} | {{ device_i.permission }} | {{ device_i.denial_behavior }} |
{% endfor %}

---
{% endif %}

{% if push_notification %}
## 6. 푸시 알림

- **서비스**: {{ push_notification.service }}

{% if push_notification.types %}
| 유형 | 트리거 | 내용 |
|------|--------|------|
{% for type_i in push_notification.types %}
| {{ type_i.type }} | {{ type_i.trigger }} | {{ type_i.content }} |
{% endfor %}
{% endif %}

---
{% endif %}

{% if distribution %}
## 7. 앱 배포

- **배포 채널**: {{ distribution }}
{% if update_strategy %}
- **업데이트 전략**: {{ update_strategy }}
{% endif %}

---
{% endif %}

## 8. 기타

{% if deep_link_scheme %}
- **딥링크**: {{ deep_link_scheme }}
{% endif %}
{% if app_size_target %}
- **앱 크기 목표**: {{ app_size_target }}
{% endif %}

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지.
     화면 추가 시 §2 네비게이션(mermaid)도 함께 갱신. -->
