# Testing — Celery

> This skill defines testing rules for the **{{ name }}** service (Celery / Python).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify each task completes successfully with valid input.
- Confirm expected side effects (DB writes, API calls).
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: task completes successfully.
- Edge cases: empty inputs, large payloads, duplicate execution (idempotency).
- Failure cases: external service down, invalid input, timeout.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: task completes successfully.
- Edge cases: empty inputs, large payloads, duplicate execution (idempotency).
- Failure cases: external service down, invalid input, timeout.
- Security cases: injection via task args, privilege escalation, unauthorized data access.
{% endif %}

---

## 2. Test Structure

```
tests/
├── conftest.py                ← shared fixtures (celery app, db, mocks)
├── unit/                      ← service/repo logic in isolation
│   └── test_{domain}_service.py
├── integration/               ← tasks with real broker/db
│   └── test_{domain}_tasks.py
└── e2e/                       ← full workflow (publish → consume → verify)
```

**Naming:** `test_{task_name}_{condition}_{expected_result}`

```python
# ✅
def test_send_welcome_email_with_valid_user_sends_email():
def test_send_welcome_email_with_missing_user_raises_not_found():
def test_process_order_duplicate_call_is_idempotent():
```

---

## 3. Fixtures

### Celery Test App

```python
# conftest.py
import pytest
from celery import Celery

@pytest.fixture
def celery_app():
    app = Celery("test")
    app.config_from_object({
        "task_always_eager": True,       # execute synchronously
        "task_eager_propagates": True,   # propagate exceptions
    })
    return app
```

### Task Testing with Eager Mode

```python
def test_send_email_success(celery_app):
    result = send_welcome_email.apply(args=["user-123"])
    assert result.status == "SUCCESS"
    assert result.result["sent"] is True
```

**Rules:**
- Use `task_always_eager=True` for unit tests — runs tasks synchronously without a broker.
- Use a real broker (Redis/RabbitMQ via Docker) for integration tests.
- Each test gets isolated DB state (transaction rollback).

---

## 4. Mocking Rules

**What to mock:**
- External API calls (email, payment, third-party).
- Broker interactions in unit tests (use eager mode).
- Time-dependent logic (`datetime.now()`).

**What NOT to mock:**
- Database in integration tests — use real test DB.
- Task serialization — let Celery serialize/deserialize to catch issues.
- Service layer in integration tests — test the full path.

```python
# Mock external service
from unittest.mock import patch

def test_send_email_calls_smtp(celery_app):
    with patch("src.my_worker.services.email_service.smtp_client") as mock_smtp:
        mock_smtp.send.return_value = True
        result = send_welcome_email.apply(args=["user-123"])
        mock_smtp.send.assert_called_once()
```

---

## 5. Test Execution

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src/{service_name} --cov-report=term-missing

# Unit tests only
pytest tests/unit/

# Integration tests (requires running broker)
pytest tests/integration/ -m integration

# Single test
pytest tests/unit/test_email_service.py::test_send_email_success
```

**Rules:**
- Unit tests run without external dependencies.
- Integration tests marked with `@pytest.mark.integration`.
- CI runs unit tests always, integration tests with Docker services.
