# 데이터 설계

---

{% if databases %}
## 1. 데이터베이스 선택

| 엔진 | 역할 | 선택 이유 |
|------|------|----------|
{% for db in databases %}
| {{ db.engine }} | {{ db.role }} | {{ db.rationale }} |
{% endfor %}

### 검토한 대안

{% for db in databases %}
{% if db.alternatives_considered %}
#### {{ db.engine }} ({{ db.role }})

| 대안 | 탈락 사유 |
|------|----------|
{% for altern_i in db.alternatives_considered %}
| {{ altern_i.engine }} | {{ altern_i.rejection_reason }} |
{% endfor %}
{% endif %}
{% endfor %}

---
{% endif %}

{% if entities %}
## 2. 엔티티 관계 다이어그램

{{ mermaid_erd }}

---

## 3. 엔티티 상세

{% for entity in entities %}
### {{ entity.name }}

> {{ entity.description }}

| 속성 | 타입 | Nullable | 설명 |
|------|------|----------|------|
{% for key_at_i in entity.key_attributes %}
| {{ key_at_i.name }} | {{ key_at_i.type }} | {{ key_at_i.nullable }} | {{ key_at_i.description }} |
{% endfor %}

{% if entity.relationships %}
**관계:**

| 대상 | 카디널리티 | 설명 |
|------|-----------|------|
{% for rel in entity.relationships %}
| {{ rel.target }} | {{ rel.cardinality }} | {{ rel.description }} |
{% endfor %}
{% endif %}

{% if entity.indexes %}
**인덱스:**

{% for indexe_i in entity.indexes %}
- {{ indexe_i }}
{% endfor %}
{% endif %}

---

{% endfor %}
{% endif %}

{% if data_storage_decisions %}
## 4. 데이터 저장 결정

| 결정 | 근거 | 트레이드오프 |
|------|------|------------|
{% for data_s_i in data_storage_decisions %}
| {{ data_s_i.decision }} | {{ data_s_i.rationale }} | {{ data_s_i.tradeoff }} |
{% endfor %}

---
{% endif %}

{% if schema_evolution_strategy %}
## 5. 스키마 변경 관리

{{ schema_evolution_strategy }}

---
{% endif %}

{% if file_storage %}
## 6. 파일 저장

- **전략**: {{ file_storage.strategy }}
{% if file_storage.rationale %}
- **이유**: {{ file_storage.rationale }}
{% endif %}
{% if file_storage.size_limits %}
- **크기 제한**: {{ file_storage.size_limits }}
{% endif %}
{% if file_storage.retention_policy %}
- **보관 정책**: {{ file_storage.retention_policy }}
{% endif %}
{% endif %}

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지.
     엔티티 추가 시 §2 ERD(mermaid)도 함께 갱신. -->
