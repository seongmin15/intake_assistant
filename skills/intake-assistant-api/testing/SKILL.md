# Testing — FastAPI

> This skill defines testing rules for the **intake-assistant-api** service (FastAPI / Python).
> Test case coverage level: **standard**

---

## 1. Test Case Coverage

Write **happy path + edge cases + failure cases**.
- Happy path: main success scenario.
- Edge cases: boundary values, empty inputs, max-length inputs, concurrent access.
- Failure cases: invalid input, missing required fields, unauthorized access, resource not found.

The number of test cases per function is not fixed — judge by the function's complexity and branching.

---

## 2. Test Structure

```
tests/
├── conftest.py                ← shared fixtures (app, client, db, auth)
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
async def test_create_user_with_valid_data_returns_201():
async def test_create_user_with_duplicate_email_returns_409():
async def test_get_user_unauthorized_returns_401():

# ❌ too vague
async def test_user():
async def test_create():
```

**Pattern:** Arrange → Act → Assert. One assertion focus per test.

```python
async def test_create_user_with_valid_data_returns_201(client, db_session):
    # Arrange
    payload = {"email": "test@example.com", "name": "Test User"}

    # Act
    response = await client.post("/api/v1/users", json=payload)

    # Assert
    assert response.status_code == 201
    assert response.json()["email"] == "test@example.com"
```

---

## 3. Fixtures & Factories

### App & Client

```python
# conftest.py
import pytest
from httpx import ASGITransport, AsyncClient
from src.{service_name}.main import app

@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
```

### Database

Each test gets an isolated transaction that rolls back after the test.

```python
@pytest.fixture
async def db_session(engine):
    async with engine.connect() as conn:
        trans = await conn.begin()
        session = AsyncSession(bind=conn)
        yield session
        await trans.rollback()
```

### Auth Override

```python
@pytest.fixture
def authenticated_client(client):
    app.dependency_overrides[get_current_user] = lambda: fake_user
    yield client
    app.dependency_overrides.clear()
```

**Rules:**
- Define shared fixtures in `conftest.py`. Test-specific fixtures stay in the test file.
- Use factories (functions) for test data creation, not raw dicts repeated across tests.
- Never share mutable state between tests.

---

## 4. Mocking Rules

**Use `app.dependency_overrides` for all mocking** — this is FastAPI's built-in mechanism.

```python
# Override a dependency
app.dependency_overrides[get_db] = lambda: mock_db_session
app.dependency_overrides[get_external_client] = lambda: FakeExternalClient()

# Always clean up
app.dependency_overrides.clear()
```

**What to mock:**
- External API calls (payment, email, third-party).
- Time-dependent logic (`datetime.now()`).
- Non-deterministic outputs (UUIDs, random values) when asserting exact values.

**What NOT to mock:**
- Database in integration tests — use a real test DB with transaction rollback.
- Pydantic validation — let it run to catch schema regressions.
- FastAPI's own request handling — test through the client, not by calling functions directly.

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

**Rules:**
- All tests must pass before committing.
- Integration tests that need DB use `@pytest.mark.integration` marker.
- Async tests use `@pytest.mark.anyio` (or configure `pytest-asyncio` with `mode=auto`).
