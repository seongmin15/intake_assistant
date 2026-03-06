# API 계약

---

## 1. API 개요

- **스타일**: {{ api_style }}
{% if api_style_rationale %}
- **선택 이유**: {{ api_style_rationale }}
{% endif %}
{% if api_versioning %}
- **버저닝**: {{ api_versioning }}
{% endif %}
{% if pagination %}
- **페이지네이션**: {{ pagination }}
{% endif %}

---

## 2. 인증

- **방식**: {{ auth.method }}
{% if auth.rationale %}
- **선택 이유**: {{ auth.rationale }}
{% endif %}
{% if auth.if_none_risks_accepted %}
- **수용 리스크**: {{ auth.if_none_risks_accepted }}
{% endif %}

---

{% if error_response_format %}
## 3. 에러 응답

- **포맷**: {{ error_response_format }}

{% if error_response_example %}
### 예시

```json
{{ error_response_example }}
```
{% endif %}

---
{% endif %}

## 4. 엔드포인트 상세

{% if api_style == "rest" %}
{% for ep in endpoints %}
### {{ ep.method }} {{ ep.path }}

> {{ ep.description }}

- **인증**: {{ ep.auth_required }}
{% if ep.idempotent %}
- **멱등성**: {{ ep.idempotent }}
{% endif %}
{% if ep.sync_async %}
- **동기/비동기**: {{ ep.sync_async }}
{% endif %}

{% if ep.request_fields %}
**요청**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
{% for reques_i in ep.request_fields %}
| {{ reques_i.name }} | {{ reques_i.type }} | {{ reques_i.required }} | {{ reques_i.description }} |
{% endfor %}
{% endif %}

{% if ep.response_fields %}
**응답**

| 필드 | 타입 | 설명 |
|------|------|------|
{% for respon_i in ep.response_fields %}
| {{ respon_i.name }} | {{ respon_i.type }} | {{ respon_i.description }} |
{% endfor %}
{% endif %}

{% if ep.processing_steps %}
**처리 로직**

{% for step in ep.processing_steps %}
{{ loop.index }}. {{ step }}
{% endfor %}
{% endif %}

---

{% endfor %}
{% endif %}

{% if api_style == "graphql" %}
### Types

{% for schema_i in graphql.schema_types %}
```graphql
{{ schema_i }}
```
{% endfor %}

### Queries

| 쿼리명 | 인자 | 반환 타입 | 설명 |
|--------|------|----------|------|
{% for querie_i in graphql.queries %}
| {{ querie_i.name }} | {{ querie_i.arguments }} | {{ querie_i.return_type }} | {{ querie_i.description }} |
{% endfor %}

### Mutations

| 뮤테이션명 | 인자 | 반환 타입 | 설명 |
|-----------|------|----------|------|
{% for mutati_i in graphql.mutations %}
| {{ mutati_i.name }} | {{ mutati_i.arguments }} | {{ mutati_i.return_type }} | {{ mutati_i.description }} |
{% endfor %}
{% endif %}

{% if api_style == "grpc" %}
### Services

| 서비스명 | 설명 |
|---------|------|
{% for svc in grpc.services %}
| {{ svc.name }} | {{ svc.description }} |
{% endfor %}

### RPC Methods

| 서비스 | 메서드 | 요청 타입 | 응답 타입 | 스트리밍 | 설명 |
|--------|--------|----------|----------|---------|------|
{% for rpc_me_i in grpc.rpc_methods %}
| {{ rpc_me_i.service }} | {{ rpc_me_i.method }} | {{ rpc_me_i.request_type }} | {{ rpc_me_i.response_type }} | {{ rpc_me_i.streaming }} | {{ rpc_me_i.description }} |
{% endfor %}
{% endif %}

---

{% if rate_limiting %}
## 5. 레이트 리밋

- **활성화**: {{ rate_limiting.enabled }}
{% if rate_limiting.strategy %}
- **전략**: {{ rate_limiting.strategy }}
{% endif %}
{% endif %}

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지. -->
