# 데이터 파이프라인 설계

---

## 1. 파이프라인 목록

| 파이프라인명 | 책임 | 유형 | 스케줄 |
|------------|------|------|--------|
{% for pipe in pipelines %}
| {{ pipe.name }} | {{ pipe.responsibility }} | {{ pipe.type }} | {{ pipe.schedule }} |
{% endfor %}

---

## 2. 파이프라인 상세

{% for pipe in pipelines %}
### {{ pipe.name }}

> {{ pipe.responsibility }}

- **유형**: {{ pipe.type }}

#### 소스

| 소스명 | 시스템 | 추출 방식 | 데이터 형식 |
|--------|--------|----------|-----------|
{% for source_i in pipe.sources %}
| {{ source_i.name }} | {{ source_i.system }} | {{ source_i.extraction_method }} | {{ source_i.format }} |
{% endfor %}

{% if pipe.transformation_steps %}
#### 변환 로직

{% for transf_i in pipe.transformation_steps %}
{{ loop.index }}. {{ transf_i }}
{% endfor %}
{% endif %}

#### 싱크

| 싱크명 | 시스템 | 적재 방식 | 데이터 형식 |
|--------|--------|----------|-----------|
{% for sink_i in pipe.sinks %}
| {{ sink_i.name }} | {{ sink_i.system }} | {{ sink_i.load_method }} | {{ sink_i.format }} |
{% endfor %}

#### 스케줄

- **실행 주기**: {{ pipe.schedule }}
{% if pipe.expected_duration %}
- **예상 처리 시간**: {{ pipe.expected_duration }}
{% endif %}
{% if pipe.volume_per_run %}
- **데이터 볼륨**: {{ pipe.volume_per_run }}
{% endif %}

{% if pipe.quality_checks %}
#### 데이터 품질

| 검증 규칙 | 대상 | 실패 시 동작 |
|---------|------|------------|
{% for qualit_i in pipe.quality_checks %}
| {{ qualit_i.rule }} | {{ qualit_i.target }} | {{ qualit_i.on_failure }} |
{% endfor %}
{% endif %}

#### 실패 처리

{% if pipe.retry_policy %}
- **재시도**: {{ pipe.retry_policy }}
{% endif %}
{% if pipe.partial_failure_strategy %}
- **부분 실패**: {{ pipe.partial_failure_strategy }}
{% endif %}
{% if pipe.recovery_strategy %}
- **복구 방식**: {{ pipe.recovery_strategy }}
{% endif %}

#### 운영

{% if pipe.sla %}
- **SLA**: {{ pipe.sla }}
{% endif %}
{% if pipe.schema_change_handling %}
- **스키마 변경 대응**: {{ pipe.schema_change_handling }}
{% endif %}
{% if pipe.backfill_strategy %}
- **백필 전략**: {{ pipe.backfill_strategy }}
{% endif %}

---

{% endfor %}

## 3. 데이터 리니지

{{ mermaid_data_lineage }}

---

{% if pipeline_dependencies %}
## 4. 의존성

| 파이프라인 | 선행 파이프라인 | 이유 |
|-----------|-------------|------|
{% for pipeli_i in pipeline_dependencies %}
| {{ pipeli_i.pipeline }} | {{ pipeli_i.depends_on }} | {{ pipeli_i.reason }} |
{% endfor %}
{% endif %}

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지.
     파이프라인 추가 시 §3 데이터 리니지(mermaid)도 함께 갱신. -->
