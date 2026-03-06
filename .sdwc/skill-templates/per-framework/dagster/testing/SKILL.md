# Testing — Dagster

> This skill defines testing rules for the **{{ name }}** service (Dagster / Python).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify assets materialize without errors.
- Verify each transformation produces expected output shape.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: assets materialize, transformations produce correct output.
- Edge cases: empty source data, schema drift, null values, partition boundaries.
- Failure cases: source unavailable, transformation errors, invalid data types.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: assets materialize, transformations produce correct output.
- Edge cases: empty source data, schema drift, null values, partition boundaries.
- Failure cases: source unavailable, transformation errors, invalid data types.
- Security cases: SQL injection via parameters, credential exposure in logs, unauthorized data access.
{% endif %}

---

## 2. Test Structure

```
tests/
├── conftest.py                ← shared fixtures (mock resources, test data)
├── unit/
│   ├── test_definitions.py    ← Definitions load validation
│   └── test_{domain}_service.py
├── integration/
│   └── test_{domain}_assets.py
└── data/                      ← test fixtures (sample CSV, JSON)
    └── {fixture_name}.json
```

**Naming:** `test_{component}_{condition}_{expected_result}`

---

## 3. Definitions Validation Test

Every project must have a definitions load test — catches import errors and configuration issues.

```python
def test_definitions_load():
    from src.{service_name}.definitions import defs
    assert defs is not None
    assert len(defs.get_all_asset_specs()) > 0
```

---

## 4. Asset & Service Testing

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

### Asset testing with mock resources

```python
from dagster import materialize, build_asset_context

def test_raw_users_asset():
    # Create mock resource
    mock_postgres = MockPostgresResource(
        test_data=[{"id": "1", "email": "a@test.com"}]
    )

    # Materialize asset with mock resource
    result = materialize(
        [raw_users],
        resources={"postgres": mock_postgres},
    )
    assert result.success

def test_asset_with_context():
    context = build_asset_context(
        resources={"postgres": mock_postgres},
    )
    result = raw_users(context)
    assert len(result) > 0
```

---

## 5. Mocking Rules

**What to mock:**
- External data sources and sinks (databases, APIs, S3) — use mock resources.
- Time/date for partition testing.
- IO managers for unit tests.

**What NOT to mock:**
- Definitions loading — always load the real `definitions.py`.
- Transformation logic — test with real sample data.
- Pydantic validation — let it run.

```python
# Mock resource class
class MockPostgresResource(ConfigurableResource):
    test_data: list[dict] = []

    def get_connection(self):
        return MockConnection(self.test_data)
```

**Dagster testing utilities:**
- `materialize()` — run assets in-process.
- `build_asset_context()` — create context for direct asset function calls.
- `build_op_context()` — create context for op testing.

---

## 6. Test Execution

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src/{service_name} --cov-report=term-missing

# Definitions validation only
pytest tests/unit/test_definitions.py

# Integration tests
pytest tests/integration/ -m integration
```

**Rules:**
- Definitions validation test runs on every commit — fast and critical.
- Integration tests require Docker services (Postgres, S3 mock, etc.).
- Test with sample data fixtures in `tests/data/`.
