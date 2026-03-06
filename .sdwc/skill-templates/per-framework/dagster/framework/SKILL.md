# Framework — Dagster

> This skill defines Dagster-specific patterns for the **{{ name }}** service.
> Read this before building or modifying any pipeline logic.

---

## 1. Software-Defined Assets

### Core concept

Dagster is **asset-centric**: you define the data assets that should exist, and Dagster figures out how to compute them. This is different from task-centric orchestrators (Airflow) where you define the execution steps.

### Standard asset definition

```python
# assets/user_assets.py
from dagster import asset, AssetExecutionContext

@asset(
    description="Raw user records from source database",
    group_name="{{ name }}",
    kinds={"python", "postgres"},
)
def raw_users(context: AssetExecutionContext, postgres: PostgresResource) -> pd.DataFrame:
    context.log.info("Extracting users from source")
    service = UserExtractor(postgres)
    return service.extract()

@asset(
    description="Cleaned and validated user records",
    group_name="{{ name }}",
)
def clean_users(context: AssetExecutionContext, raw_users: pd.DataFrame) -> pd.DataFrame:
    context.log.info("Transforming user records")
    service = UserTransformer()
    return service.transform(raw_users)

@asset(
    description="User metrics aggregated daily",
    group_name="{{ name }}",
)
def user_metrics(clean_users: pd.DataFrame) -> pd.DataFrame:
    service = MetricsCalculator()
    return service.compute(clean_users)
```

**Rules:**
- Assets declare their dependencies via function parameters — Dagster builds the graph automatically.
- Always add `description` and `group_name` for discoverability.
- Asset functions are thin wrappers: extract logic lives in services.
- Return values are passed to downstream assets or persisted by IO managers.

---

## 2. Resources — Dependency Injection

### Defining resources

```python
# resources/postgres_resource.py
from dagster import ConfigurableResource
import psycopg2

class PostgresResource(ConfigurableResource):
    host: str
    port: int = 5432
    database: str
    user: str
    password: str

    def get_connection(self):
        return psycopg2.connect(
            host=self.host, port=self.port,
            database=self.database, user=self.user, password=self.password,
        )

    def execute_query(self, query: str, params: dict | None = None) -> list[dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params)
                return cur.fetchall()
```

### Registering resources

```python
# definitions.py
defs = Definitions(
    assets=...,
    resources={
        "postgres": PostgresResource(
            host=EnvVar("PG_HOST"),
            database=EnvVar("PG_DATABASE"),
            user=EnvVar("PG_USER"),
            password=EnvVar("PG_PASSWORD"),
        ),
    },
)
```

**Rules:**
- All external access (DB, API, storage) goes through resources.
- Use `EnvVar` for sensitive configuration — never hardcode credentials.
- Resources are injected by matching the parameter name in asset functions.
- For testing, swap resources in `materialize(resources={...})`.

---

## 3. IO Managers

### When to use IO managers

- **Small data (< 100MB)**: return from asset, let default IO manager handle.
- **Large data**: use custom IO manager to write to storage (S3, GCS, database).

```python
# io_managers/parquet_io_manager.py
from dagster import IOManager, OutputContext, InputContext

class ParquetIOManager(IOManager):
    def __init__(self, base_path: str):
        self.base_path = base_path

    def handle_output(self, context: OutputContext, obj: pd.DataFrame):
        path = f"{self.base_path}/{context.asset_key.to_python_identifier()}.parquet"
        obj.to_parquet(path, index=False)
        context.log.info(f"Wrote {len(obj)} rows to {path}")

    def load_input(self, context: InputContext) -> pd.DataFrame:
        path = f"{self.base_path}/{context.asset_key.to_python_identifier()}.parquet"
        return pd.read_parquet(path)
```

**Register in definitions:**

```python
defs = Definitions(
    assets=...,
    resources={
        "io_manager": ParquetIOManager(base_path="/data/warehouse"),
    },
)
```

---

## 4. Partitions

### Time-based partitions

```python
from dagster import DailyPartitionsDefinition, asset

daily_partitions = DailyPartitionsDefinition(start_date="2024-01-01")

@asset(partitions_def=daily_partitions)
def daily_events(context: AssetExecutionContext, postgres: PostgresResource) -> pd.DataFrame:
    partition_date = context.partition_key  # "2024-01-15"
    return postgres.execute_query(
        "SELECT * FROM events WHERE date = %(date)s",
        {"date": partition_date},
    )
```

**Rules:**
- Use partitions for any time-series or incrementally processed data.
- Partition key determines which slice to process — makes backfill natural.
- All partitioned assets must be idempotent — safe to re-materialize any partition.

---

## 5. Schedules & Sensors

### Schedule

```python
# schedules/daily_schedule.py
from dagster import ScheduleDefinition, build_schedule_from_partitioned_job, define_asset_job

daily_etl_job = define_asset_job(
    name="daily_etl_job",
    selection=["raw_users", "clean_users", "user_metrics"],
)

daily_etl_schedule = ScheduleDefinition(
    job=daily_etl_job,
    cron_schedule="0 6 * * *",  # 6 AM daily
)
```

### Sensor

```python
# sensors/new_file_sensor.py
from dagster import sensor, RunRequest, SensorEvaluationContext

@sensor(job=daily_etl_job, minimum_interval_seconds=60)
def new_file_sensor(context: SensorEvaluationContext, s3: S3Resource):
    new_files = s3.list_new_files(since=context.cursor)
    if new_files:
        context.update_cursor(new_files[-1].timestamp)
        yield RunRequest(run_key=new_files[-1].key)
```

---

## 6. Error Handling & Retry

### Asset retry

```python
from dagster import RetryPolicy

@asset(retry_policy=RetryPolicy(max_retries=3, delay=60))
def fragile_extract(external_api: ApiResource) -> list[dict]:
    return external_api.fetch_data()
```

### Freshness policies

```python
from dagster import FreshnessPolicy

@asset(freshness_policy=FreshnessPolicy(maximum_lag_minutes=120))
def critical_metrics(clean_users: pd.DataFrame) -> pd.DataFrame:
    ...
```

**Rules:**
- Set retry policies for assets that call external systems.
- Use freshness policies for assets with SLA requirements.
- All assets must be idempotent — safe to re-materialize.
- Use `context.log` for structured logging within assets.

---

## 7. Quality Checks

```python
from dagster import asset_check, AssetCheckResult

@asset_check(asset=clean_users)
def check_no_null_emails(clean_users: pd.DataFrame) -> AssetCheckResult:
    null_count = clean_users["email"].isnull().sum()
    return AssetCheckResult(
        passed=null_count == 0,
        metadata={"null_email_count": int(null_count)},
    )

@asset_check(asset=clean_users)
def check_row_count(clean_users: pd.DataFrame) -> AssetCheckResult:
    count = len(clean_users)
    return AssetCheckResult(
        passed=count > 0,
        metadata={"row_count": count},
    )
```

**Common quality checks:**
- Row count: not empty, within expected range.
- Null check: critical columns have no nulls.
- Freshness: data timestamp within expected window.
- Uniqueness: no duplicate keys.
- Schema: column names and types match expectations.

---

## 8. Backfill & Reprocessing

Dagster's asset-based model makes backfill natural:

```
# Via Dagster UI:
# Select asset → Materialize → Choose partitions

# Via CLI:
dagster asset materialize --select raw_users --partition 2024-01-01
```

**Rules:**
- All partitioned assets must be idempotent — safe to re-materialize any partition.
- Use partition keys (date strings) for data slicing — never `datetime.now()`.
- Backfilling an upstream asset automatically marks downstream as stale.

---

## 9. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Business logic in asset functions | Hard to test, long assets | Delegate to `services/` |
| Direct DB calls without resources | Untestable, no DI | Use Dagster resources for all external access |
| Large data in asset return values | Memory issues | Use IO managers to persist to storage |
| Hardcoded connections | Breaks across environments | Use `EnvVar` and resources |
| No partitioning for time-series | Can't backfill, reprocess | Use `DailyPartitionsDefinition` etc. |
| Skipping asset checks | Data quality regressions | Add `@asset_check` for critical assets |
| `print()` for logging | Unstructured, lost | Use `context.log` in assets |
| Heavy imports at module top level | Slow code location loading | Defer heavy imports inside asset functions |
