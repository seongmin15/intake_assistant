# Framework — Airflow

> This skill defines Airflow-specific patterns for the **{{ name }}** service.
> Read this before building or modifying any pipeline logic.

---

## 1. DAG Structure

### Standard DAG definition

```python
from datetime import datetime, timedelta
from airflow.decorators import dag, task

default_args = {
    "owner": "{{ name }}",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(hours=1),
}

@dag(
    dag_id="user_sync",
    description="Sync users from source to warehouse",
    schedule="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["{{ name }}", "etl"],
)
def user_sync_dag():
    @task
    def extract() -> list[dict]:
        from src.{service_name}.services.user_service import UserExtractor
        return UserExtractor().run()

    @task
    def transform(raw_data: list[dict]) -> list[dict]:
        from src.{service_name}.services.user_service import UserTransformer
        return UserTransformer().run(raw_data)

    @task
    def load(data: list[dict]) -> None:
        from src.{service_name}.services.user_service import UserLoader
        UserLoader().run(data)

    raw = extract()
    transformed = transform(raw)
    load(transformed)

user_sync_dag()
```

**Rules:**
- Use TaskFlow API (`@task` decorator) for Python tasks — cleaner than classic operators.
- Use classic operators when using provider integrations (S3, GCS, database operators).
- Always set `catchup=False` unless backfill is explicitly needed.
- Always set `execution_timeout` to prevent runaway tasks.
- DAG ID must match the pipeline name in intake.

---

## 2. Task Dependencies

### Linear chain

```python
extract >> transform >> load
```

### Fan-out / fan-in

```python
raw = extract()
users = transform_users(raw)
events = transform_events(raw)
load([users, events])  # waits for both
```

### Conditional branching

```python
from airflow.operators.python import BranchPythonOperator

def choose_branch(**context):
    if has_new_data():
        return "process_data"
    return "skip"
```

**Rules:**
- Keep DAG topology simple and readable — avoid deeply nested branches.
- Use task groups for visual organization of related tasks.
- Document non-obvious dependencies with comments.

---

## 3. Data Passing

### XCom rules

- **Small metadata only:** IDs, file paths, row counts, status flags.
- **Never pass large datasets** through XCom — write to storage.

```python
# ✅ Pass file path
@task
def extract() -> str:
    path = f"s3://bucket/data/{ds}/users.parquet"
    write_to_s3(data, path)
    return path  # XCom: just the path

@task
def transform(file_path: str) -> str:
    data = read_from_s3(file_path)
    ...
```

### Between operators

```python
# TaskFlow handles XCom automatically via return values
result = extract_task()
transform_task(result)  # receives XCom value
```

---

## 4. Error Handling & Retry

### Task-level retries

```python
@task(retries=3, retry_delay=timedelta(minutes=5))
def fragile_extract():
    ...
```

### Callbacks

```python
def on_failure(context):
    task_instance = context["task_instance"]
    logger.error("Task failed", dag_id=context["dag"].dag_id, task_id=task_instance.task_id)
    send_alert(f"Pipeline failure: {task_instance.task_id}")

@dag(..., default_args={"on_failure_callback": on_failure})
```

### SLA monitoring

```python
@dag(
    ...,
    sla_miss_callback=sla_alert,
)
def pipeline():
    @task(sla=timedelta(hours=2))  # must complete within 2h of schedule
    def critical_task():
        ...
```

**Rules:**
- Set retries for tasks that call external systems.
- Use `on_failure_callback` for alerting.
- Use SLAs for pipelines with time commitments.
- Idempotency: every task must produce the same result when rerun for the same date.

---

## 5. Connections & Variables

```python
# Use Airflow Connections for external system credentials
from airflow.hooks.base import BaseHook

conn = BaseHook.get_connection("postgres-main")
connection_string = conn.get_uri()

# Use Airflow Variables for configuration
from airflow.models import Variable

schema = Variable.get("DATA_WAREHOUSE_SCHEMA")
```

**Rules:**
- Never hardcode credentials or connection strings.
- Set Connections via Airflow UI, CLI, or environment variables.
- For environment variables: `AIRFLOW_CONN_{ID}` for connections, `AIRFLOW_VAR_{KEY}` for variables.
- Sensitive values: use Airflow's secrets backend integration.

---

## 6. Quality Checks

```python
from airflow.decorators import task

@task
def validate_output(table: str, min_rows: int = 1):
    count = db.execute(f"SELECT COUNT(*) FROM {table}").scalar()
    if count < min_rows:
        raise ValueError(f"Quality check failed: {table} has {count} rows, expected >= {min_rows}")

# In DAG:
load_result = load(data)
validate_output("users", min_rows=100).set_upstream(load_result)
```

**Common quality checks:**
- Row count: not empty, within expected range.
- Null check: critical columns have no nulls.
- Freshness: data timestamp within expected window.
- Uniqueness: no duplicate keys.

---

## 7. Backfill & Reprocessing

```bash
# Backfill specific date range
airflow dags backfill user_sync --start-date 2024-01-01 --end-date 2024-01-31

# Clear and rerun specific task
airflow tasks clear user_sync -t load_to_warehouse -s 2024-01-15 -e 2024-01-15
```

**Rules:**
- All tasks must be idempotent — safe to rerun for any date.
- Use `{{ ds }}` (execution date) as partition key, not `datetime.now()`.
- Backfill strategy: clear downstream tasks when rerunning upstream.

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Heavy imports at DAG top level | Slow scheduler parsing | Defer imports inside `@task` |
| `datetime.now()` in tasks | Not idempotent, breaks backfill | Use `{{ ds }}` / `context["ds"]` |
| Large data in XCom | DB bloat, OOM | Write to storage, pass path |
| No `catchup=False` | Hundreds of backfill runs on deploy | Set `catchup=False` by default |
| Hardcoded connections | Breaks across environments | Use Airflow Connections |
| No SLA / timeout | Stuck tasks block pipeline | Set `execution_timeout` and SLAs |
| Mutable default args dict | Shared state across DAGs | Define `default_args` per DAG |
