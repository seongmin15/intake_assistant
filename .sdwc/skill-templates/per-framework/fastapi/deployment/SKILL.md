# Deployment — FastAPI

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

{% if build_tool == "poetry" %}
```bash
poetry install              # install dependencies
poetry lock                 # update lock file (commit poetry.lock)
poetry export -f requirements.txt -o requirements.txt  # for Docker
```

**Rules:**
- Always commit `poetry.lock`.
- Pin major versions in `pyproject.toml` (e.g., `fastapi = "^0.110"`).
- Use `poetry add --group dev` for test/lint dependencies.
{% endif %}
{% if build_tool == "pip" %}
```bash
pip install -r requirements.txt
pip freeze > requirements.txt
```

**Rules:**
- Always commit `requirements.txt` with pinned versions.
- Use separate `requirements-dev.txt` for test/lint dependencies.
{% endif %}

---

## 2. Container

**Dockerfile (multi-stage build):**

```dockerfile
# Build stage
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Runtime stage
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /install /usr/local
COPY src/ ./src/
EXPOSE 8000
CMD ["uvicorn", "src.{service_name}.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**.dockerignore:**

```
__pycache__
*.pyc
.git
.env
tests/
.venv/
```

**Rules:**
- Always use multi-stage builds to minimize image size.
- Never copy `.env` files into the image. Inject environment variables at runtime.
- Use `--no-cache-dir` in pip install to reduce layer size.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**

- IaC files location: `infra/` directory at project root.
- Never hardcode environment-specific values — use variables/parameters.
- All infra changes go through the same PR review process as code.
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Configuration management:**

```python
# core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
```

**Rules:**
- All config via environment variables. Never hardcode secrets or URLs.
- Use `.env` for local development only. Never commit `.env` files.
- Each environment loads its own variables (via deployment platform, not files).
{% if deployment.secrets_management %}
- **Secrets management: {{ deployment.secrets_management }}** — fetch secrets from this source in production.
{% endif %}

---

## 4. CI/CD Pipeline

{% if deployment.ci %}
**Tool: {{ deployment.ci.tool }}**
{% if deployment.ci.pipeline_stages %}
**Stages: {{ deployment.ci.pipeline_stages }}**
{% endif %}

Standard pipeline steps for this service:

```
1. Checkout code
2. Install dependencies
3. Lint (ruff check .)
4. Type check (mypy src/)
5. Unit tests (pytest tests/unit/)
6. Integration tests (pytest tests/integration/)
7. Build container image
8. Push to registry
9. Deploy to target environment
```

**Rules:**
- Pipeline must pass before merge.
- Integration tests run against a disposable test database.
- Container image tag uses git commit SHA for traceability.
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

## 5. Health Check & Readiness

```python
# routers/health.py
from fastapi import APIRouter

router = APIRouter(tags=["health"])

@router.get("/health")
async def health():
    """Liveness probe — app is running."""
    return {"status": "ok"}

@router.get("/ready")
async def ready(db: AsyncSession = Depends(get_db)):
    """Readiness probe — app can serve traffic."""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        raise HTTPException(status_code=503, detail="Not ready")
```

**Rules:**
- `/health` — no dependencies, always fast. Used for liveness.
- `/ready` — checks DB and critical dependencies. Used for readiness.
- Both endpoints are public (no auth required).

---

## 6. Operational Commands

```bash
# Run locally
uvicorn src.{service_name}.main:app --reload --port 8000

# Database migration
alembic upgrade head          # apply all migrations
alembic revision --autogenerate -m "description"  # create migration

# Logs (container)
docker logs -f {container_name}

# Shell access (container)
docker exec -it {container_name} /bin/bash
```
