# Testing — Django

> This skill defines testing rules for the **{{ name }}** service (Django + DRF / Python).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify the main success scenario for each endpoint/function.
- Confirm correct status codes and response shapes.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: main success scenario.
- Edge cases: boundary values, empty inputs, max-length inputs, pagination limits.
- Failure cases: invalid input, missing required fields, unauthorized access, resource not found.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: main success scenario.
- Edge cases: boundary values, empty inputs, max-length inputs, pagination limits.
- Failure cases: invalid input, missing required fields, unauthorized access, resource not found.
- Security cases: injection attempts, token tampering, privilege escalation, IDOR, CORS violations.
{% endif %}

The number of test cases per function is not fixed — judge by the function's complexity and branching.

---

## 2. Test Structure

```
tests/
├── conftest.py                ← shared fixtures (api_client, users, db)
├── unit/                      ← service/repository logic in isolation
│   └── test_{module}.py
├── integration/               ← endpoint tests with real DB
│   └── test_{resource}_api.py
└── e2e/                       ← full workflow tests
    └── test_{flow}.py
```

**Naming:** `test_{action}_{condition}_{expected_result}`

```python
# ✅
def test_create_user_with_valid_data_returns_201():
def test_create_user_with_duplicate_email_returns_400():
def test_list_users_unauthorized_returns_401():

# ❌ too vague
def test_user():
def test_create():
```

**Pattern:** Arrange → Act → Assert. One assertion focus per test.

```python
def test_create_user_with_valid_data_returns_201(api_client, db):
    # Arrange
    payload = {"email": "test@example.com", "name": "Test User"}

    # Act
    response = api_client.post("/api/v1/users/", payload, format="json")

    # Assert
    assert response.status_code == 201
    assert response.data["email"] == "test@example.com"
```

---

## 3. Fixtures & Factories

### API Client

```python
# conftest.py
import pytest
from rest_framework.test import APIClient

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client
```

### Database — pytest-django

Each test runs in a transaction that rolls back automatically.

```python
# conftest.py
@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="test@example.com",
        password="testpass123",
        name="Test User",
    )
```

### Factories (factory_boy)

```python
# tests/factories.py
import factory
from src.{service_name}.apps.users.models import User

class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    name = factory.Faker("name")
    is_active = True
```

**Rules:**
- Use `factory_boy` for test data creation — not raw `Model.objects.create()` repeated across tests.
- Define shared fixtures in `conftest.py`. Test-specific fixtures stay in the test file.
- Never share mutable state between tests — each test gets a fresh transaction.
- Use `@pytest.mark.django_db` or the `db` fixture for tests that need database access.

---

## 4. Mocking Rules

**Use `force_authenticate` for auth mocking** — DRF's built-in mechanism.

```python
# Override authentication
api_client.force_authenticate(user=user)
api_client.force_authenticate(user=admin_user)

# Test unauthenticated
api_client.force_authenticate(user=None)
```

**What to mock:**
- External API calls (payment, email, third-party).
- Time-dependent logic (`django.utils.timezone.now()`).
- File storage (`default_storage`).
- Celery task calls (`.delay()`, `.apply_async()`).

**What NOT to mock:**
- Database in integration tests — use real test DB with transaction rollback.
- DRF serializer validation — let it run to catch schema regressions.
- Django middleware — test through the full request cycle.
- Permissions — test real permission classes against the endpoint.

```python
# Mock external service
from unittest.mock import patch

@patch("src.{service_name}.apps.payments.services.PaymentGateway.charge")
def test_create_order_charges_payment(mock_charge, authenticated_client):
    mock_charge.return_value = {"transaction_id": "txn_123"}
    response = authenticated_client.post("/api/v1/orders/", data, format="json")
    assert response.status_code == 201
    mock_charge.assert_called_once()
```

---

## 5. Test Execution

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src/{service_name} --cov-report=term-missing

# Run specific category
pytest tests/unit/
pytest tests/integration/

# Run single test
pytest tests/unit/test_user_service.py::test_create_user_with_valid_data_returns_201

# Parallel execution
pytest -n auto
```

**pytest.ini / pyproject.toml:**

```toml
[tool.pytest.ini_options]
DJANGO_SETTINGS_MODULE = "src.{service_name}.settings"
python_files = "test_*.py"
python_classes = ""
python_functions = "test_*"
addopts = "--strict-markers -ra"
markers = [
    "integration: tests requiring external services",
]
```

**Rules:**
- All tests must pass before committing.
- Integration tests that need external services use `@pytest.mark.integration` marker.
- Always use `pytest-django` — not Django's `TestCase` (for consistency with other Python services).
