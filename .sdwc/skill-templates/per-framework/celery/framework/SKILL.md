# Framework — Celery

> This skill defines Celery-specific patterns for the **{{ name }}** service.
> Read this before building or modifying any worker logic.

---

## 1. Application Setup

```python
# app.py
from celery import Celery
from src.{service_name}.core.config import settings

app = Celery("{{ name }}")
app.config_from_object({
    "broker_url": settings.BROKER_URL,
    "result_backend": settings.RESULT_BACKEND,
    "task_serializer": "json",
    "result_serializer": "json",
    "accept_content": ["json"],
    "timezone": "UTC",
    "enable_utc": True,
})

# Auto-discover tasks in tasks/ directory
app.autodiscover_tasks(["src.{service_name}.tasks"])
```

**Logging setup** (→ also see skills/common/observability/):

```python
from celery.signals import after_setup_logger
import structlog

@after_setup_logger.connect
def setup_celery_logging(**kwargs):
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
    )
```

---

## 2. Task Definition

### Basic task

```python
@app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    time_limit=300,          # hard kill after 5min
    soft_time_limit=240,     # SoftTimeLimitExceeded after 4min
    acks_late=True,          # ack after execution, not before
)
def process_order(self: Task, order_id: str) -> dict:
    try:
        service = OrderService()
        result = service.process(order_id)
        return result.model_dump()
    except ExternalServiceError as exc:
        raise self.retry(exc=exc)
    except SoftTimeLimitExceeded:
        logger.warning("Task timed out", order_id=order_id)
        raise
```

**Rules:**
- Always use `bind=True` to access `self` (for retries, task ID).
- Always set `time_limit` and `soft_time_limit`.
- Always set `acks_late=True` for at-least-once delivery.
- Return JSON-serializable results (dicts, not ORM objects).

### Task routing to queues

```python
app.conf.task_routes = {
    "src.{service_name}.tasks.email_tasks.*": {"queue": "email-queue"},
    "src.{service_name}.tasks.report_tasks.*": {"queue": "report-queue"},
}
```

---

## 3. Retry & Error Handling

### Retry strategy

```python
@app.task(bind=True, max_retries=3, autoretry_for=(ExternalServiceError,))
def call_external_api(self: Task, payload: dict) -> dict:
    ...

# Or manual retry with exponential backoff
@app.task(bind=True, max_retries=5)
def resilient_task(self: Task, data: dict) -> dict:
    try:
        return do_work(data)
    except TransientError as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
```

### Failure destination

When max retries exhausted, tasks go to the failure handler:

```python
@app.task(bind=True, max_retries=3)
def process_payment(self: Task, payment_id: str) -> dict:
    try:
        return charge(payment_id)
    except PaymentError as exc:
        if self.request.retries >= self.max_retries:
            handle_permanent_failure(payment_id, str(exc))  # DLQ / error table
            raise
        raise self.retry(exc=exc)
```

**Rules:**
- Transient errors (network, timeout): retry with backoff.
- Permanent errors (invalid data, business rule violation): fail immediately, no retry.
- Always log failures with context (task ID, args, exception).

---

## 4. Concurrency & Ordering

### Concurrency control

```python
# Start worker with concurrency limit
# celery -A src.{service_name}.app worker --concurrency=4

# Per-task rate limiting
@app.task(rate_limit="10/m")  # max 10 per minute
def rate_limited_task(data: dict): ...
```

### Ordering

Celery does NOT guarantee ordering by default. If ordering is required:

```python
# Use a dedicated queue with concurrency=1
app.conf.task_routes = {
    "src.{service_name}.tasks.ordered_tasks.*": {"queue": "ordered-queue"},
}
# Start a single-concurrency worker for this queue
# celery -A src.{service_name}.app worker -Q ordered-queue --concurrency=1
```

---

## 5. Scheduled Tasks (Beat)

{% for wkr in workers %}
{% if wkr.trigger_type == "cron" %}
```python
app.conf.beat_schedule = {
    "{{ wkr.name }}": {
        "task": "src.{service_name}.tasks.{domain}_tasks.{{ wkr.name }}",
        "schedule": crontab(...),  # {{ wkr.trigger_config }}
        {{ "\"options\": {\"expires\": ...},  # overlap policy: " ~ wkr.overlap_policy if wkr.overlap_policy else "" }}
    },
}
```
{% endif %}
{% endfor %}

**Rules:**
- Define all schedules in `app.py` or a dedicated `schedules.py`.
- Use `crontab()` for cron expressions, `timedelta()` for intervals.
- Set `expires` to prevent task pile-up if worker is down.
- Run Beat as a separate process: `celery -A src.{service_name}.app beat`

---

## 6. Graceful Shutdown

```python
from celery.signals import worker_shutting_down

@worker_shutting_down.connect
def handle_shutdown(**kwargs):
    logger.info("Worker shutting down, finishing current tasks...")
```

**Rules:**
- Workers finish current tasks before stopping (warm shutdown).
- Set `--soft-time-limit` lower than deployment timeout to allow cleanup.
- For long tasks, check `self.request.called_directly` and implement checkpointing.

---

## 7. Monitoring & Observability

```python
from celery.signals import task_prerun, task_postrun, task_failure

@task_prerun.connect
def on_task_start(sender, task_id, **kwargs):
    logger.info("Task started", task_id=task_id, task_name=sender.name)

@task_postrun.connect
def on_task_end(sender, task_id, retval, state, **kwargs):
    logger.info("Task completed", task_id=task_id, state=state)

@task_failure.connect
def on_task_failure(sender, task_id, exception, **kwargs):
    logger.error("Task failed", task_id=task_id, exception=str(exception))
```

**Tools:**
- **Flower** for real-time monitoring: `celery -A src.{service_name}.app flower`
- Emit task duration metrics for alerting (→ skills/common/observability/).

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Passing ORM objects as args | Serialization failure | Pass IDs, fetch inside task |
| No time limit | Zombie tasks block workers | Always set `time_limit` |
| `acks_early` (default) | Task lost on worker crash | Use `acks_late=True` |
| Ignoring `SoftTimeLimitExceeded` | Task killed without cleanup | Catch and handle gracefully |
| Shared mutable state between tasks | Race conditions | Each task creates its own dependencies |
| No idempotency | Duplicate processing on retry | Check-before-act or idempotency keys |
| Beat + worker same process | Beat misses schedules under load | Run Beat as separate process |
