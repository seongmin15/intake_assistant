# Coding Standards — Prefect

> This skill defines coding rules for the **{{ name }}** service (Prefect / Python).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   └── {service_name}/               ← package directory (snake_case of {{ name }})
│       ├── __init__.py
│       ├── flows/                     ← flow definitions (one file per pipeline)
│       │   ├── __init__.py
│       │   └── {pipeline_name}_flow.py
│       ├── tasks/                     ← reusable task definitions
│       │   ├── __init__.py
│       │   └── {domain}_tasks.py
│       ├── blocks/                    ← Prefect block configurations
│       │   └── {system}_block.py
│       ├── deployments/               ← deployment definitions
│       │   └── {deployment_name}.py
│       ├── services/                  ← business/transformation logic
│       │   └── {domain}_service.py
│       ├── schemas/                   ← Pydantic models for validation
│       │   └── {domain}.py
│       ├── core/                      ← config, constants
│       │   ├── config.py
│       │   └── constants.py
│       └── utils/
├── tests/
│   ├── conftest.py
│   ├── unit/
│   └── integration/
├── prefect.yaml                       ← deployment configuration
├── pyproject.toml
└── Dockerfile
```

**Rules:**
- One flow file per pipeline (e.g., `user_sync_flow.py`, `analytics_flow.py`).
- Flows define orchestration. Business/transformation logic lives in `services/`.
- Tasks are reusable units that can be shared across flows.
- Flows and tasks are thin wrappers — they call services, not implement logic.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Flow files | `{pipeline_name}_flow.py` | `user_sync_flow.py` |
| Flow functions | snake_case verb-noun | `sync_users`, `aggregate_analytics` |
| Task functions | snake_case verb-first | `extract_users`, `transform_records`, `load_to_warehouse` |
| Block classes | PascalCase | `PostgresBlock`, `S3Block` |
| Deployment names | kebab-case | `user-sync-daily`, `analytics-hourly` |
| Service classes | PascalCase | `UserExtractor`, `RevenueCalculator` |
| Constants | UPPER_SNAKE | `DEFAULT_BATCH_SIZE` |

---

## 3. Type Hints & Pydantic

**Type annotations for all functions.** Flow and task functions must have typed parameters and return types.

```python
# ✅ Fully typed task
@task
def extract_users(connection_string: str, date: str) -> list[dict]:
    ...

# ✅ Fully typed flow
@flow
def sync_users(date: str = "today") -> int:
    ...
```

**Use Pydantic for data validation between stages:**

```python
class UserRecord(BaseModel):
    id: str
    email: str
    created_at: datetime

def validate_records(records: list[dict]) -> list[UserRecord]:
    return [UserRecord.model_validate(r) for r in records]
```

---

## 4. Import Order

Standard Python import order:

```python
# 1. Standard library
# 2. Prefect (from prefect import flow, task, ...)
# 3. Third-party (pandas, sqlalchemy, etc.)
# 4. Local
```

**Rules:**
- Absolute imports only. No relative imports.
- Keep flow file top-level imports lightweight — Prefect loads these at registration time.

---

## 5. Prefect-specific Patterns

### Flow calling tasks

```python
# flows/user_sync_flow.py
from prefect import flow
from src.{service_name}.tasks.user_tasks import extract_users, transform_users, load_users

@flow(name="user-sync", log_prints=True)
def sync_users(date: str) -> int:
    raw = extract_users(date)
    clean = transform_users(raw)
    count = load_users(clean)
    return count
```

### Subflows

```python
@flow
def daily_etl():
    sync_users("today")
    aggregate_analytics("today")  # another flow, runs as subflow
```

**Rules:**
- Flows orchestrate tasks and other flows. Logic stays in tasks and services.
- Set `log_prints=True` on flows to capture print output in Prefect logs.
- Return meaningful results from flows for observability.

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ruff** | Linter + formatter | `pyproject.toml` `[tool.ruff]` |
| **mypy** | Type checking | `pyproject.toml` `[tool.mypy]` |

```bash
ruff check .
ruff format .
mypy src/
```

**Docstrings:** Google style for all public functions, flows, and tasks.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in flow/task functions | Delegate to `services/` |
| Direct DB/API calls without blocks | Use Prefect blocks for external access |
| Large data passed between tasks | Write to storage, pass reference |
| Hardcoded connection strings | Use Prefect blocks and env vars |
| No retries on external calls | Set `retries` on tasks |
| Skipping type hints | Prefect uses types for UI/validation |
| `print()` without `log_prints=True` | Set `log_prints=True` or use `get_run_logger()` |
