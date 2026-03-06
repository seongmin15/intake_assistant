# Coding Standards — Dagster

> This skill defines coding rules for the **{{ name }}** service (Dagster / Python).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   └── {service_name}/               ← package directory (snake_case of {{ name }})
│       ├── __init__.py
│       ├── definitions.py            ← Dagster Definitions entry point
│       ├── assets/                   ← software-defined assets (one file per domain)
│       │   ├── __init__.py
│       │   └── {domain}_assets.py
│       ├── resources/                ← resource definitions (DB, API clients)
│       │   ├── __init__.py
│       │   └── {system}_resource.py
│       ├── jobs/                     ← job definitions (if not using asset jobs)
│       │   └── {job_name}.py
│       ├── schedules/                ← schedule definitions
│       │   └── {schedule_name}.py
│       ├── sensors/                  ← sensor definitions
│       │   └── {sensor_name}.py
│       ├── io_managers/              ← custom IO managers
│       │   └── {storage}_io_manager.py
│       ├── services/                 ← business/transformation logic
│       │   └── {domain}_service.py
│       ├── schemas/                  ← Pydantic models for validation
│       │   └── {domain}.py
│       ├── core/                     ← config, constants
│       │   ├── config.py
│       │   └── constants.py
│       └── utils/
├── tests/
│   ├── conftest.py
│   ├── unit/
│   └── integration/
├── dagster.yaml                      ← instance configuration
├── pyproject.toml
└── Dockerfile
```

**Rules:**
- `definitions.py` is the single entry point — it assembles all assets, resources, jobs, and schedules.
- Asset files define the data model (what data exists). Business/transformation logic lives in `services/`.
- Assets are thin wrappers: they declare dependencies and call services.
- Never put heavy computation directly in asset functions — delegate to services.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Asset files | `{domain}_assets.py` | `user_assets.py`, `analytics_assets.py` |
| Asset functions | snake_case noun | `raw_users`, `clean_users`, `user_metrics` |
| Asset keys | snake_case | `raw_users`, `daily_revenue` |
| Resource classes | PascalCase + `Resource` | `PostgresResource`, `S3Resource` |
| Job names | snake_case | `full_refresh_job`, `daily_sync_job` |
| Schedule names | snake_case + `_schedule` | `daily_etl_schedule` |
| Sensor names | snake_case + `_sensor` | `new_file_sensor` |
| IO manager classes | PascalCase + `IOManager` | `ParquetIOManager` |
| Service classes | PascalCase | `UserTransformer`, `RevenueCalculator` |
| Constants | UPPER_SNAKE | `DEFAULT_PARTITION_FORMAT` |

**Asset naming progression:**
- `raw_{domain}` — extracted data
- `clean_{domain}` or `staged_{domain}` — validated/cleaned
- `{domain}_{metric}` — transformed/aggregated

---

## 3. Type Hints & Pydantic

**Type annotations for all functions.** Asset functions return types are optional (Dagster uses IO managers) but all service/helper code must be fully typed.

```python
# ✅ Service function — fully typed
def transform_user_records(raw_records: list[dict]) -> list[UserRecord]:
    ...

# ✅ Asset function — typed where practical
@asset
def raw_users(postgres: PostgresResource) -> pd.DataFrame:
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
# 2. Dagster (from dagster import asset, Definitions, ...)
# 3. Third-party (pandas, sqlalchemy, etc.)
# 4. Local
```

**Rules:**
- Absolute imports only. No relative imports.
- Defer heavy imports inside asset functions when they slow down code location loading.

```python
# ✅ Defer heavy imports
@asset
def process_data(raw_data):
    import pandas as pd  # imported only when asset materializes
    ...
```

---

## 5. Dagster-specific Patterns

### Definitions entry point

```python
# definitions.py
from dagster import Definitions, load_assets_from_modules
from src.{service_name}.assets import user_assets, analytics_assets
from src.{service_name}.resources.postgres_resource import PostgresResource
from src.{service_name}.schedules.daily_schedule import daily_etl_schedule

defs = Definitions(
    assets=load_assets_from_modules([user_assets, analytics_assets]),
    resources={"postgres": PostgresResource(...)},
    schedules=[daily_etl_schedule],
)
```

### Resource pattern — Dagster's DI

```python
# resources/postgres_resource.py
from dagster import ConfigurableResource

class PostgresResource(ConfigurableResource):
    host: str
    port: int = 5432
    database: str
    user: str
    password: str

    def get_connection(self):
        return psycopg2.connect(...)
```

**Rules:**
- All external system access goes through resources — never instantiate clients directly in assets.
- Resources are configured in `definitions.py` and injected into assets by parameter name.
- This makes testing easy: swap real resources for mock resources.

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

**Docstrings:** Google style for all public functions, assets, and resources.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in asset functions | Delegate to `services/` |
| Direct DB/API calls without resources | Use Dagster resources for all external access |
| Large data in asset return values | Use IO managers to write to storage |
| Hardcoded connection strings | Configure via resources and env vars |
| No partitioning for time-series data | Use Dagster partitions |
| Skipping `definitions.py` assembly | Always register assets/resources/schedules in Definitions |
| `print()` for logging | Use `context.log` in assets or `logging.getLogger()` |
