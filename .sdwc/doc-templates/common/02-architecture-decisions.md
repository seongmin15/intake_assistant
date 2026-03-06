# 아키텍처 결정

---

## 1. 아키텍처 패턴

- **패턴**: {{ architecture.pattern }}
- **선택 이유**: {{ architecture.pattern_rationale }}

{% if architecture.internal_style %}
- **내부 스타일**: {{ architecture.internal_style }}
{% if architecture.internal_style_rationale %}
- **내부 스타일 이유**: {{ architecture.internal_style_rationale }}
{% endif %}
{% endif %}

{% if architecture.principles %}
### 설계 원칙

{% for princi_i in architecture.principles %}
- {{ princi_i }}
{% endfor %}
{% endif %}

---

## 2. 시스템 구성

### 서비스 목록

| 서비스명 | 타입 | 책임 | 언어/프레임워크 |
|---------|------|------|---------------|
{% for svc in services %}
| {{ svc.name }} | {{ svc.type }} | {{ svc.responsibility }} | {{ svc.language }}{{ " + " ~ svc.framework if svc.framework else "" }} |
{% endfor %}

### 서비스 간 통신

| 출발 | 도착 | 프로토콜 | 동기/비동기 |
|------|------|---------|-----------|
{% for svc in services %}
{% for commun_i in svc.communication_with %}
| {{ svc.name }} | {{ commun_i.target }} | {{ commun_i.protocol }} | {{ commun_i.sync_async }} |
{% endfor %}
{% endfor %}

{% if external_systems %}
### 외부 시스템 연동

| 시스템 | 목적 | 프로토콜 | 신뢰성 | 장애 대응 |
|--------|------|---------|--------|----------|
{% for ext in external_systems %}
| {{ ext.name }} | {{ ext.purpose }} | {{ ext.protocol }} | {{ ext.reliability }} | {{ ext.fallback }} |
{% endfor %}
{% endif %}

---

## 3. 핵심 라이브러리

{% for svc in services %}
{% if svc.key_libraries %}
### {{ svc.name }}

| 이름 | 용도 | 버전 제약 |
|------|------|----------|
{% for key_li_i in svc.key_libraries %}
| {{ key_li_i.name }} | {{ key_li_i.purpose }} | {{ key_li_i.version_constraint }} |
{% endfor %}
{% endif %}
{% endfor %}

---

{% if motivation.inspiration_references %}
## 4. 영감 및 참조

{% for ref in motivation.inspiration_references %}
- {{ ref }}
{% endfor %}

---
{% endif %}

## 5. ADR 로그

{# ADR은 순차 채번: Template Engine이 조건부 ADR을 건너뛰고 번호를 연속 부여 #}

### ADR-{{ adr_seq() }}: 아키텍처 패턴

- **결정**: {{ architecture.pattern }}
- **맥락**: {{ architecture.pattern_rationale }}
- **검토한 대안**:

| 대안 | 장점 | 단점 | 탈락 사유 |
|------|------|------|----------|
{% for patter_i in architecture.pattern_alternatives %}
| {{ patter_i.pattern }} | {{ patter_i.pros }} | {{ patter_i.cons }} | {{ patter_i.rejection_reason }} |
{% endfor %}

- **상태**: 확정

---

{% for svc in services %}
### ADR-{{ adr_seq() }}: {{ svc.name }} 기술 스택

- **결정**: {{ svc.language }}{{ " + " ~ svc.framework if svc.framework else "" }}{{ " + " ~ svc.build_tool if svc.build_tool else "" }}
{% if svc.framework_rationale %}
- **맥락**: {{ svc.framework_rationale }}
{% endif %}
{% if svc.build_tool_rationale %}
- **빌드 도구 선택 이유**: {{ svc.build_tool_rationale }}
{% endif %}

{% if svc.framework_alternatives %}
- **검토한 대안**:

| 대안 | 탈락 사유 |
|------|----------|
{% for framew_i in svc.framework_alternatives %}
| {{ framew_i.name }} | {{ framew_i.rejection_reason }} |
{% endfor %}
{% endif %}

- **상태**: 확정

---

{% if svc.databases %}
### ADR-{{ adr_seq() }}: {{ svc.name }} 데이터베이스

{% for db in svc.databases %}
- **결정**: {{ db.engine }} ({{ db.role }})
- **맥락**: {{ db.rationale }}

{% if db.alternatives_considered %}
- **검토한 대안**:

| 대안 | 탈락 사유 |
|------|----------|
{% for altern_i in db.alternatives_considered %}
| {{ altern_i.engine }} | {{ altern_i.rejection_reason }} |
{% endfor %}
{% endif %}
{% endfor %}

- **상태**: 확정

---
{% endif %}

### ADR-{{ adr_seq() }}: {{ svc.name }} 배포 방식

- **결정**: {{ svc.deployment.target }}
{% if svc.deployment.target_rationale %}
- **맥락**: {{ svc.deployment.target_rationale }}
{% endif %}

{% if svc.deployment.target_alternatives %}
- **검토한 대안**:

| 대안 | 탈락 사유 |
|------|----------|
{% for target_i in svc.deployment.target_alternatives %}
| {{ target_i.target }} | {{ target_i.rejection_reason }} |
{% endfor %}
{% endif %}

- **상태**: 확정

---

{% endfor %}

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지.
     ADR 번호는 이 문서의 마지막 ADR 번호 + 1로 채번.
     형식: ### ADR-NNN: 제목 → 결정/맥락/대안/상태.
     상태 값: 확정 | 제안 | 폐기 -->
