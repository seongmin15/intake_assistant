# Testing — Airflow

> This skill defines testing rules for the **{{ name }}** service (Airflow / Python).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify DAGs parse without errors.
- Verify each task succeeds with valid input data.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: DAGs parse, tasks succeed.
- Edge cases: empty source data, schema drift, partial extracts, late-arriving data.
- Failure cases: source unavailable, transformation errors, load conflicts.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: DAGs parse, tasks succeed.
- Edge cases: empty source data, schema drift, partial extracts, late-arriving data.
- Failure cases: source unavailable, transformation errors, load conflicts.
- Security cases: SQL injection via parameters, credential exposure in logs, unauthorized data access.
{% endif %}

---

## 2. Test Structure

```
tests/
├── conftest.py                ← shared fixtures (Airflow context, test DB)
├── unit/
│   ├── test_dag_integrity.py  ← DAG parse validation
│   └── test_{domain}_service.py
├── integration/
│   └── test_{pipeline}_tasks.py
└── data/                      ← test fixtures (sample CSV, JSON)
    └── {fixture_name}.json
```

**Naming:** `test_{component}_{condition}_{expected_result}`

---

## 3. DAG Integrity Tests

Every project must have a DAG parse test — catches import errors and cycle issues.

```python
import pytest
from airflow.models import DagBag

def test_all_dags_parse_without_errors():
    dag_bag = DagBag(dag_folder="dags/", include_examples=False)
    assert len(dag_bag.import_errors) == 0, f"DAG import errors: {dag_bag.import_errors}"

def test_dag_has_expected_tasks():
    dag_bag = DagBag(dag_folder="dags/", include_examples=False)
    dag = dag_bag.get_dag("user_sync")
    task_ids = [t.task_id for t in dag.tasks]
    assert "extract_users" in task_ids
    assert "load_to_warehouse" in task_ids
```

---

## 4. Task & Service Testing

### Service/transformation logic (unit tests)

```python
def test_transform_user_records_valid_data():
    raw = [{"id": "1", "email": "a@test.com", "created_at": "2024-01-01T00:00:00Z"}]
    result = transform_user_records(raw)
    assert len(result) == 1
    assert result[0].email == "a@test.com"

def test_transform_user_records_missing_field_raises():
    raw = [{"id": "1"}]  # missing email
    with pytest.raises(ValidationError):
        transform_user_records(raw)
```

### Operator testing

```python
def test_custom_operator_execute(mocker):
    op = ExtractUsersOperator(task_id="test_extract", source="test_db")
    mock_hook = mocker.patch.object(op, "get_hook")
    mock_hook.return_value.get_records.return_value = [{"id": "1"}]

    result = op.execute(context={})
    assert len(result) == 1
```

---

## 5. Mocking Rules

**What to mock:**
- External data sources and sinks (databases, APIs, S3).
- Airflow Connections and Variables in unit tests.
- Time/date for schedule testing.

**What NOT to mock:**
- DAG parsing — always parse real DAG files.
- Transformation logic — test with real sample data.
- Pydantic validation — let it run.

```python
# Mock Airflow Variable
from unittest.mock import patch

@patch("airflow.models.Variable.get", return_value="test_schema")
def test_uses_correct_schema(mock_var):
    ...
```

---

## 6. Test Execution

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src/{service_name} --cov-report=term-missing

# DAG integrity tests only
pytest tests/unit/test_dag_integrity.py

# Integration tests
pytest tests/integration/ -m integration
```

**Rules:**
- DAG integrity tests run on every commit — fast and critical.
- Integration tests require Docker services (Postgres, etc.).
- Test with sample data fixtures in `tests/data/`.
