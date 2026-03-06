# Testing — Prefect

> This skill defines testing rules for the **{{ name }}** service (Prefect / Python).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify flows complete without errors.
- Verify each task produces expected output shape.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: flows complete, tasks produce correct output.
- Edge cases: empty source data, schema drift, null values, date boundaries.
- Failure cases: source unavailable, transformation errors, invalid data types.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: flows complete, tasks produce correct output.
- Edge cases: empty source data, schema drift, null values, date boundaries.
- Failure cases: source unavailable, transformation errors, invalid data types.
- Security cases: SQL injection via parameters, credential exposure in logs, unauthorized data access.
{% endif %}

---

## 2. Test Structure

```
tests/
├── conftest.py                ← shared fixtures (mock blocks, test data)
├── unit/
│   ├── test_{domain}_tasks.py ← task unit tests
│   └── test_{domain}_service.py
├── integration/
│   └── test_{pipeline}_flow.py
└── data/                      ← test fixtures (sample CSV, JSON)
    └── {fixture_name}.json
```

**Naming:** `test_{component}_{condition}_{expected_result}`

---

## 3. Task Testing

Prefect tasks can be called directly as regular Python functions in tests.

```python
from src.{service_name}.tasks.user_tasks import extract_users, transform_users

def test_extract_users_returns_records(mock_db):
    result = extract_users.fn(connection_string="mock://", date="2024-01-15")
    assert isinstance(result, list)
    assert len(result) > 0

def test_transform_users_valid_data():
    raw = [{"id": "1", "email": "a@test.com", "created_at": "2024-01-01T00:00:00Z"}]
    result = transform_users.fn(raw)
    assert len(result) == 1
    assert result[0]["email"] == "a@test.com"

def test_transform_users_empty_input():
    result = transform_users.fn([])
    assert result == []
```

**Key:** Use `.fn()` to call the underlying function without Prefect orchestration overhead.

---

## 4. Flow Testing

```python
from prefect.testing.utilities import prefect_test_harness

def test_sync_users_flow_succeeds():
    with prefect_test_harness():
        result = sync_users(date="2024-01-15")
        assert result > 0

def test_sync_users_flow_empty_source():
    with prefect_test_harness():
        result = sync_users(date="1900-01-01")  # no data
        assert result == 0
```

**Rules:**
- Use `prefect_test_harness()` for integration tests that need Prefect runtime.
- Use `.fn()` for unit tests of individual tasks (faster, no Prefect overhead).

---

## 5. Mocking Rules

**What to mock:**
- External data sources and sinks (databases, APIs, S3).
- Prefect blocks in unit tests.
- Time/date for schedule testing.

**What NOT to mock:**
- Flow/task orchestration in integration tests — use `prefect_test_harness()`.
- Transformation logic — test with real sample data.
- Pydantic validation — let it run.

```python
from unittest.mock import patch, MagicMock

@patch("src.{service_name}.tasks.user_tasks.get_postgres_connection")
def test_extract_users_with_mock_db(mock_conn):
    mock_conn.return_value.execute.return_value = [{"id": "1"}]
    result = extract_users.fn(connection_string="mock://", date="2024-01-15")
    assert len(result) == 1
```

---

## 6. Test Execution

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src/{service_name} --cov-report=term-missing

# Task unit tests only
pytest tests/unit/

# Flow integration tests
pytest tests/integration/ -m integration
```

**Rules:**
- Task unit tests (`.fn()`) run on every commit — fast.
- Flow integration tests require `prefect_test_harness()`.
- Test with sample data fixtures in `tests/data/`.
