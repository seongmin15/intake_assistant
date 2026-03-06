# Framework — Prefect

> This skill defines Prefect-specific patterns for the **{{ name }}** service.
> Read this before building or modifying any pipeline logic.

---

## 1. Flow & Task Basics

### Flow definition

```python
# flows/user_sync_flow.py
from prefect import flow, get_run_logger
from src.{service_name}.tasks.user_tasks import extract_users, transform_users, load_users

@flow(
    name="user-sync",
    description="Sync users from source to warehouse",
    log_prints=True,
    retries=1,
    retry_delay_seconds=300,
)
def sync_users(date: str) -> int:
    logger = get_run_logger()
    logger.info(f"Starting user sync for {date}")

    raw = extract_users(date)
    clean = transform_users(raw)
    count = load_users(clean)

    logger.info(f"Completed: {count} users synced")
    return count
```

### Task definition

```python
# tasks/user_tasks.py
from prefect import task

@task(
    name="extract-users",
    retries=3,
    retry_delay_seconds=60,
    timeout_seconds=300,
    log_prints=True,
)
def extract_users(date: str) -> list[dict]:
    from src.{service_name}.services.user_service import UserExtractor
    return UserExtractor().extract(date)

@task(name="transform-users")
def transform_users(raw_data: list[dict]) -> list[dict]:
    from src.{service_name}.services.user_service import UserTransformer
    return UserTransformer().transform(raw_data)

@task(name="load-users")
def load_users(data: list[dict]) -> int:
    from src.{service_name}.services.user_service import UserLoader
    return UserLoader().load(data)
```

**Rules:**
- Always set `name` on flows and tasks for UI discoverability.
- Always set `retries` and `timeout_seconds` on tasks that call external systems.
- Flows orchestrate tasks. Business logic lives in services.
- Tasks are reusable across flows — keep them focused on a single operation.
- Use `log_prints=True` to capture print output in Prefect logs.

---

## 2. Task Dependencies

### Sequential

```python
@flow
def pipeline():
    raw = extract()
    transformed = transform(raw)   # waits for extract
    load(transformed)              # waits for transform
```

### Parallel (fan-out / fan-in)

```python
@flow
def pipeline():
    raw = extract()
    users = transform_users(raw)    # these run in parallel
    events = transform_events(raw)  # these run in parallel
    load(users, events)             # waits for both
```

### Conditional

```python
@flow
def pipeline():
    has_data = check_source()
    if has_data:
        process_data()
    else:
        logger.info("No new data, skipping")
```

**Rules:**
- Prefect infers dependencies from data passing — no explicit DAG syntax needed.
- Use `submit()` with task runners for true parallel execution.
- Keep flow logic simple and readable.

---

## 3. Data Passing

### Between tasks

Tasks pass data via return values. Prefect handles serialization.

```python
# ✅ Small data — pass directly
@task
def extract() -> list[dict]:
    return [{"id": 1}, {"id": 2}]

@task
def transform(data: list[dict]) -> list[dict]:
    return [clean(d) for d in data]
```

### Large data — write to storage, pass reference

```python
# ✅ Large data — pass path
@task
def extract() -> str:
    data = fetch_large_dataset()
    path = f"s3://bucket/data/{date}/users.parquet"
    write_parquet(data, path)
    return path  # only the path is passed

@task
def transform(file_path: str) -> str:
    data = read_parquet(file_path)
    ...
```

**Rules:**
- Pass data directly for small results (< 100MB).
- For large datasets, write to storage and pass the path/reference.
- Never pass non-serializable objects between tasks.

---

## 4. Blocks — External System Configuration

### Defining and using blocks

```python
# Using built-in blocks
from prefect_sqlalchemy import SqlAlchemyConnector

# Register block via Prefect UI or code:
connector = SqlAlchemyConnector(
    connection_info=ConnectionComponents(
        driver=SyncDriver.POSTGRESQL_PSYCOPG2,
        database="mydb",
        host="localhost",
        port=5432,
        username="user",
        password="pass",
    )
)
connector.save("postgres-main", overwrite=True)

# Use in task
@task
def extract_users(date: str) -> list[dict]:
    connector = SqlAlchemyConnector.load("postgres-main")
    with connector.get_connection() as conn:
        return conn.execute(text("SELECT * FROM users WHERE date = :d"), {"d": date}).mappings().all()
```

**Rules:**
- Use Prefect blocks for all external system credentials and configuration.
- Never hardcode connection strings or credentials.
- Register blocks via Prefect UI or `prefect block register` for discoverability.
- Blocks are Prefect's equivalent of Airflow Connections.

---

## 5. Deployments

### prefect.yaml

```yaml
# prefect.yaml
deployments:
  - name: user-sync-daily
    entrypoint: src/{service_name}/flows/user_sync_flow.py:sync_users
    work_pool:
      name: default-pool
    schedule:
      cron: "0 6 * * *"
    parameters:
      date: "\{{ prefect.variables.run_date }}"

  - name: analytics-hourly
    entrypoint: src/{service_name}/flows/analytics_flow.py:aggregate_analytics
    work_pool:
      name: default-pool
    schedule:
      cron: "0 * * * *"
```

### Deploy

```bash
prefect deploy --all                    # deploy all from prefect.yaml
prefect deploy -n user-sync-daily       # deploy specific
```

**Rules:**
- Define all deployments in `prefect.yaml`.
- Use work pools for execution infrastructure management.
- Use Prefect variables for environment-specific parameters.

---

## 6. Error Handling & Retry

### Task-level retry

```python
@task(retries=3, retry_delay_seconds=60)
def fragile_extract(date: str) -> list[dict]:
    return external_api.fetch(date)

# Exponential backoff
@task(retries=5, retry_delay_seconds=[10, 30, 60, 120, 300])
def resilient_task(data: dict) -> dict:
    ...
```

### Flow-level error handling

```python
from prefect import flow
from prefect.states import Failed

@flow
def pipeline():
    try:
        raw = extract()
        load(transform(raw))
    except Exception as e:
        send_alert(f"Pipeline failed: {e}")
        raise
```

**Rules:**
- Transient errors (network, timeout): use task `retries`.
- Permanent errors (invalid data): fail immediately, no retry.
- Use `on_failure` hooks for alerting.
- All tasks must be idempotent — safe to retry.

---

## 7. Quality Checks

```python
@task
def validate_output(data: list[dict], min_rows: int = 1) -> bool:
    if len(data) < min_rows:
        raise ValueError(f"Quality check failed: {len(data)} rows, expected >= {min_rows}")
    null_emails = sum(1 for d in data if not d.get("email"))
    if null_emails > 0:
        raise ValueError(f"Quality check failed: {null_emails} null emails")
    return True

@flow
def pipeline():
    raw = extract()
    clean = transform(raw)
    validate_output(clean, min_rows=100)
    load(clean)
```

**Common quality checks:**
- Row count: not empty, within expected range.
- Null check: critical columns have no nulls.
- Freshness: data timestamp within expected window.
- Uniqueness: no duplicate keys.

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Business logic in flow/task functions | Hard to test, long functions | Delegate to `services/` |
| Direct DB calls without blocks | Credentials scattered | Use Prefect blocks for all external access |
| Large data between tasks | Serialization failures, memory | Write to storage, pass paths |
| No retries on external calls | Transient failures cascade | Set `retries` on tasks |
| `datetime.now()` for partitioning | Not idempotent | Pass date as parameter |
| No timeout on tasks | Stuck tasks block workers | Set `timeout_seconds` |
| Hardcoded credentials | Breaks across environments | Use blocks and env vars |
| `print()` without `log_prints=True` | Output lost | Set `log_prints=True` or use `get_run_logger()` |
