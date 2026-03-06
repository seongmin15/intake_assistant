# Coding Standards — Celery

> This skill defines coding rules for the **{{ name }}** service (Celery / Python).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   └── {service_name}/               ← package directory (snake_case of {{ name }})
│       ├── __init__.py
│       ├── app.py                     ← Celery app instance + config
│       ├── tasks/                     ← task definitions (one file per domain)
│       │   ├── __init__.py
│       │   └── {domain}_tasks.py
│       ├── services/                  ← business logic (shared with tasks)
│       │   └── {domain}_service.py
│       ├── repositories/              ← data access
│       │   └── {domain}_repo.py
│       ├── models/                    ← ORM models (if using DB)
│       │   └── {domain}.py
│       ├── schemas/                   ← Pydantic models for task input/output
│       │   └── {domain}.py
│       ├── core/                      ← config, exceptions, constants
│       │   ├── config.py
│       │   ├── exceptions.py
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
- One task file per domain (e.g., `email_tasks.py`, `report_tasks.py`).
- Tasks are thin wrappers — they call services, not implement business logic.
- Dependency flow: tasks → services → repositories. Never the reverse.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Task files | `{domain}_tasks.py` | `email_tasks.py` |
| Task functions | `snake_case` verb-first | `send_welcome_email`, `generate_report` |
| Task names | dotted path (auto) | `src.my_worker.tasks.email_tasks.send_welcome_email` |
| Service classes | PascalCase | `EmailService` |
| Constants | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Queue names | kebab-case | `email-queue`, `report-queue` |

---

## 3. Type Hints & Pydantic

**All task function signatures must have full type annotations.**

```python
# ✅
@app.task(bind=True)
def send_welcome_email(self: Task, user_id: str, template: str = "default") -> dict:
    ...

# ❌ untyped
@app.task
def send_welcome_email(user_id, template="default"):
    ...
```

**Use Pydantic for complex task inputs:**

```python
class ReportRequest(BaseModel):
    user_id: str
    date_range: tuple[date, date]
    format: str = "pdf"

@app.task
def generate_report(request_data: dict) -> dict:
    request = ReportRequest.model_validate(request_data)
    ...
```

**Rule:** Task arguments must be JSON-serializable. Pass Pydantic models as dicts, validate inside the task.

---

## 4. Import Order

Same as FastAPI — see standard Python import order:

```python
# 1. Standard library
# 2. Third-party (celery, sqlalchemy, pydantic)
# 3. Local (absolute imports from package root)
```

**Rules:**
- Absolute imports only. No relative imports.
- Never import the Celery app instance at module top level in service/repo files — it creates circular dependencies.

---

## 5. Task Design Patterns

### Task as thin wrapper

```python
# ✅ Task delegates to service
@app.task(bind=True)
def process_order(self: Task, order_id: str) -> dict:
    service = OrderService()
    result = service.process(order_id)
    return result.model_dump()

# ❌ Task contains business logic
@app.task
def process_order(order_id: str):
    order = db.query(Order).get(order_id)
    order.status = "processing"
    # ... 50 lines of business logic ...
```

### Idempotency

Every task must be safe to retry. Use idempotency keys or check-before-act patterns.

```python
@app.task(bind=True)
def charge_payment(self: Task, payment_id: str) -> dict:
    payment = repo.get(payment_id)
    if payment.status == "charged":
        return {"status": "already_charged"}  # idempotent
    # ... proceed with charge
```

---

## 6. Linting & Formatting

Same tooling as FastAPI Python projects:

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ruff** | Linter + formatter | `pyproject.toml` `[tool.ruff]` |
| **mypy** | Type checking | `pyproject.toml` `[tool.mypy]` |

```bash
ruff check .
ruff format .
mypy src/
```

**Docstrings:** Google style for all public functions and task definitions.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in tasks | Delegate to service layer |
| Non-serializable task args | Pass IDs or dicts, not ORM objects |
| Ignoring task failures silently | Use error handlers, DLQ, or alerts |
| Unbounded task execution time | Set `time_limit` and `soft_time_limit` |
| Global mutable state in workers | Each task invocation is independent |
| `print()` for logging | Use structured logger (→ skills/common/observability/) |
| Blocking calls without timeout | Always set timeouts on external calls |
