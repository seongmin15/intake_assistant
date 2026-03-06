# Deployment — Celery

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

{% if build_tool == "poetry" %}
```bash
poetry install
poetry lock
poetry export -f requirements.txt -o requirements.txt
```

**Rules:**
- Always commit `poetry.lock`.
- Use `poetry add --group dev` for test/lint dependencies.
{% endif %}
{% if build_tool == "pip" %}
```bash
pip install -r requirements.txt
```

**Rules:**
- Always commit `requirements.txt` with pinned versions.
- Separate `requirements-dev.txt` for test/lint tools.
{% endif %}

---

## 2. Container

**Dockerfile:**

```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /install /usr/local
COPY src/ ./src/
```

**Separate containers for worker and beat:**

```yaml
# docker-compose example
services:
  worker:
    build: .
    command: celery -A src.{service_name}.app worker --loglevel=info --concurrency=4
  beat:
    build: .
    command: celery -A src.{service_name}.app beat --loglevel=info
  flower:
    build: .
    command: celery -A src.{service_name}.app flower --port=5555
```

**Rules:**
- Worker and Beat must run as separate processes/containers.
- Never run Beat with multiple replicas (causes duplicate schedules).
- Worker concurrency is configured via `--concurrency` flag, not in code.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**

- IaC files location: `infra/` directory at project root.
- Never hardcode environment-specific values.
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

```python
# core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    BROKER_URL: str                    # redis://... or amqp://...
    RESULT_BACKEND: str
    WORKER_CONCURRENCY: int = 4
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
```

**Rules:**
- All config via environment variables.
- Broker and result backend URLs are environment-specific.
- `.env` for local development only — never commit.
{% if deployment.secrets_management %}
- **Secrets management: {{ deployment.secrets_management }}**
{% endif %}

---

## 4. CI/CD Pipeline

{% if deployment.ci %}
**Tool: {{ deployment.ci.tool }}**
{% if deployment.ci.pipeline_stages %}
**Stages: {{ deployment.ci.pipeline_stages }}**
{% endif %}

Standard pipeline steps:

```
1. Checkout code
2. Install dependencies
3. Lint (ruff check .)
4. Type check (mypy src/)
5. Unit tests (pytest tests/unit/)
6. Integration tests (pytest tests/integration/ — with broker in CI)
7. Build container image
8. Push to registry
9. Deploy worker + beat
```
{% endif %}
{% if deployment.cd %}
**CD Tool: {{ deployment.cd.tool }}**
{% if deployment.cd.strategy %}
**Strategy: {{ deployment.cd.strategy }}**
{% endif %}
{% endif %}

{% if deployment.container_registry %}
**Container registry: {{ deployment.container_registry }}**
{% endif %}

---

## 5. Health Check

Workers don't serve HTTP, so health checks use the Celery inspect API:

```python
# health_check.py (run as a script or sidecar)
from src.{service_name}.app import app

def check_worker_health() -> bool:
    inspect = app.control.inspect()
    active = inspect.active()
    return active is not None and len(active) > 0
```

**For container orchestrators:**
- Use a sidecar or exec probe that runs the health check script.
- Monitor Flower dashboard for worker availability.

---

## 6. Operational Commands

```bash
# Start worker
celery -A src.{service_name}.app worker --loglevel=info --concurrency=4

# Start beat (separate process)
celery -A src.{service_name}.app beat --loglevel=info

# Monitor with Flower
celery -A src.{service_name}.app flower --port=5555

# Inspect active tasks
celery -A src.{service_name}.app inspect active

# Purge all queued tasks (caution!)
celery -A src.{service_name}.app purge

# Scale workers
celery -A src.{service_name}.app control pool_grow 2   # add 2 processes
celery -A src.{service_name}.app control pool_shrink 2  # remove 2 processes
```
