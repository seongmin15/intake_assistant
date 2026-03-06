# Deployment — Django

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
- Pin major versions in `pyproject.toml` (e.g., `django = "^5.0"`).
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
COPY manage.py .

# Collect static files at build time
RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["gunicorn", "src.{service_name}.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4"]
```

**.dockerignore:**

```
__pycache__
*.pyc
.git
.env
tests/
.venv/
staticfiles/
media/
```

**Rules:**
- Always use multi-stage builds to minimize image size.
- Never copy `.env` files into the image. Inject environment variables at runtime.
- Run `collectstatic` during build — not at container startup.
- Use Gunicorn for production (WSGI). Use Uvicorn + Gunicorn for ASGI if async views are used.

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
# settings.py
import os

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
DATABASE_URL = os.environ["DATABASE_URL"]

DATABASES = {
    "default": dj_database_url.parse(DATABASE_URL),
}
```

**Rules:**
- All config via environment variables. Never hardcode secrets or URLs.
- Use `.env` for local development only. Never commit `.env` files.
- Each environment loads its own variables (via deployment platform, not files).
- `DEBUG = False` in all non-local environments.
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
7. collectstatic (verify no errors)
8. Build container image
9. Push to registry
10. Run migrations (on deploy target)
11. Deploy application
```

**Rules:**
- Pipeline must pass before merge.
- Integration tests run against a disposable test database.
- Migrations run as a pre-deploy step — separate from app startup.
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
# apps/core/views.py
from django.http import JsonResponse
from django.db import connection

def health(request):
    """Liveness probe — app is running."""
    return JsonResponse({"status": "ok"})

def ready(request):
    """Readiness probe — app can serve traffic."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "ready"})
    except Exception:
        return JsonResponse({"status": "not ready"}, status=503)
```

**URL registration (public, no auth):**

```python
# urls.py (root)
urlpatterns = [
    path("health/", core_views.health),
    path("ready/", core_views.ready),
    ...
]
```

**Rules:**
- `/health` — no dependencies, always fast. Used for liveness.
- `/ready` — checks DB and critical dependencies. Used for readiness.
- Both endpoints skip authentication middleware.

---

## 6. Operational Commands

```bash
# Run locally (development)
python manage.py runserver 0.0.0.0:8000

# Run in production (Gunicorn)
gunicorn src.{service_name}.wsgi:application --bind 0.0.0.0:8000 --workers 4

# Database
python manage.py migrate                    # apply migrations
python manage.py makemigrations             # create migration files
python manage.py showmigrations             # check status
python manage.py dbshell                    # open DB shell

# Static files
python manage.py collectstatic --noinput

# Django shell
python manage.py shell

# Create superuser
python manage.py createsuperuser

# Logs (container)
docker logs -f {container_name}
```
