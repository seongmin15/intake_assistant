# Coding Standards — Airflow

> This skill defines coding rules for the **{{ name }}** service (Airflow / Python).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── dags/                              ← DAG definitions (Airflow scans this)
│   └── {pipeline_name}_dag.py
├── src/
│   └── {service_name}/               ← package directory (snake_case of {{ name }})
│       ├── __init__.py
│       ├── operators/                 ← custom operators
│       │   └── {domain}_operator.py
│       ├── sensors/                   ← custom sensors
│       │   └── {domain}_sensor.py
│       ├── hooks/                     ← custom hooks (external connections)
│       │   └── {system}_hook.py
│       ├── services/                  ← business/transformation logic
│       │   └── {domain}_service.py
│       ├── sql/                       ← SQL templates
│       │   └── {query_name}.sql
│       ├── schemas/                   ← Pydantic models for validation
│       │   └── {domain}.py
│       ├── core/                      ← config, exceptions, constants
│       │   ├── config.py
│       │   └── constants.py
│       └── utils/
├── tests/
│   ├── conftest.py
│   ├── unit/
│   └── integration/
├── pyproject.toml
└── Dockerfile
```

**Rules:**
- DAG files go in `dags/` — Airflow's scheduler scans only this directory.
- DAG files define the pipeline structure (tasks, dependencies, schedule). Business logic lives in `src/`.
- Never put heavy imports or computation at DAG file top level — it runs on every scheduler heartbeat.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| DAG files | `{pipeline_name}_dag.py` | `user_sync_dag.py` |
| DAG IDs | snake_case | `user_sync`, `analytics_agg` |
| Task IDs | snake_case verb-first | `extract_users`, `transform_events`, `load_to_warehouse` |
| Custom operators | PascalCase + `Operator` | `S3ToPostgresOperator` |
| Custom sensors | PascalCase + `Sensor` | `ApiDataReadySensor` |
| Custom hooks | PascalCase + `Hook` | `PaymentApiHook` |
| SQL files | snake_case | `upsert_users.sql` |
| Airflow variables | UPPER_SNAKE | `DATA_WAREHOUSE_SCHEMA` |
| Connections | kebab-case | `postgres-main`, `s3-data-lake` |

---

## 3. Type Hints & Pydantic

**Type annotations for all functions.** DAG definitions don't need return types but all helper/service/operator code does.

```python
# ✅ Service function — fully typed
def transform_user_records(raw_records: list[dict]) -> list[UserRecord]:
    ...

# ✅ Custom operator — typed execute method
class ExtractUsersOperator(BaseOperator):
    def execute(self, context: Context) -> list[dict]:
        ...
```

**Use Pydantic for data validation between pipeline stages:**

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
# 2. Airflow (from airflow.*, from airflow.providers.*)
# 3. Third-party (pandas, sqlalchemy, etc.)
# 4. Local
```

**DAG file import rule:** Keep top-level imports minimal. Use deferred imports inside task callables for heavy libraries.

```python
# ✅ Defer heavy imports
@task
def process_data():
    import pandas as pd  # imported only when task runs
    ...

# ❌ Top-level heavy import in DAG file
import pandas as pd  # runs on EVERY scheduler parse
```

---

## 5. DAG Design Patterns

### Keep DAG files simple

```python
# ✅ DAG file = structure only
from airflow.decorators import dag, task
from src.{service_name}.services.user_service import extract, transform, load

@dag(dag_id="user_sync", schedule="@daily", ...)
def user_sync_dag():
    raw = extract()
    transformed = transform(raw)
    load(transformed)

user_sync_dag()
```

### XCom usage

- Use XComs for small metadata only (IDs, counts, file paths).
- Never push large datasets through XCom — write to storage and pass the path.

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

**Docstrings:** Google style for all public functions, operators, and DAG descriptions.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in DAG files | Move to `src/services/` |
| Heavy imports at DAG top level | Defer inside task callables |
| Large data in XCom | Write to storage, pass path |
| Hardcoded connections/variables | Use Airflow Connections and Variables |
| No idempotency | Tasks must be safe to rerun |
| Catchall `except Exception` | Catch specific, let Airflow handle retries |
| `print()` for logging | Use `self.log` in operators or `logging.getLogger()` |
