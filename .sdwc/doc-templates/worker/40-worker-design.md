# Worker 설계

---

## 1. Worker 목록

| Worker명 | 책임 | 트리거 | 동시성 |
|---------|------|--------|--------|
{% for wkr in workers %}
| {{ wkr.name }} | {{ wkr.responsibility }} | {{ wkr.trigger_type }} | {{ wkr.concurrency }} |
{% endfor %}

---

## 2. Worker 상세

{% for wkr in workers %}
### {{ wkr.name }}

> {{ wkr.responsibility }}

#### 트리거

- **유형**: {{ wkr.trigger_type }}
- **설정**: {{ wkr.trigger_config }}

{% if wkr.processing_steps %}
#### 처리 로직

{% for step in wkr.processing_steps %}
{{ loop.index }}. {{ step }}
{% endfor %}
{% endif %}

{% if wkr.input_fields %}
#### 입력

| 필드 | 타입 | 설명 |
|------|------|------|
{% for input__i in wkr.input_fields %}
| {{ input__i.name }} | {{ input__i.type }} | {{ input__i.description }} |
{% endfor %}
{% endif %}

{% if wkr.outputs %}
#### 출력/부수효과

| 결과 | 설명 |
|------|------|
{% for output_i in wkr.outputs %}
| {{ output_i.result }} | {{ output_i.description }} |
{% endfor %}
{% endif %}

#### 실행 제어

- **동시성**: {{ wkr.concurrency }}
{% if wkr.batch_size %}
- **배치 크기**: {{ wkr.batch_size }}
{% endif %}
{% if wkr.ordering_required %}
- **순서 보장**: {{ wkr.ordering_required }}{{ " (기준: " ~ wkr.ordering_key ~ ")" if wkr.ordering_key else "" }}
{% endif %}
{% if wkr.trigger_type == "cron" %}
{% if wkr.overlap_policy %}
- **겹침 정책**: {{ wkr.overlap_policy }}
{% endif %}
{% endif %}

#### 실패 처리

{% if wkr.retry_policy %}
- **재시도**: {{ wkr.retry_policy }}
{% endif %}
{% if wkr.timeout %}
- **타임아웃**: {{ wkr.timeout }}
{% endif %}
- **멱등성**: {{ wkr.idempotent }}{{ " (" ~ wkr.idempotent_strategy ~ ")" if wkr.idempotent_strategy else "" }}
{% if wkr.failure_destination %}
- **실패 목적지**: {{ wkr.failure_destination }}
{% endif %}

#### 운영

{% if wkr.graceful_shutdown %}
- **셧다운**: {{ wkr.graceful_shutdown }}
{% endif %}
{% if wkr.execution_logging %}
- **실행 이력**: {{ wkr.execution_logging }}
{% endif %}

{% if wkr.dependencies %}
#### 의존성

| 의존 서비스 | 장애 시 동작 |
|-----------|------------|
{% for depend_i in wkr.dependencies %}
| {{ depend_i.service }} | {{ depend_i.failure_behavior }} |
{% endfor %}
{% endif %}

---

{% endfor %}

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지. -->
