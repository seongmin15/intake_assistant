# Deployment — Dagster

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
- Pin Dagster version and all integration packages (e.g., `dagster-postgres`, `dagster-aws`).
{% endif %}
{% if build_tool == "pip" %}
```bash
pip install -r requirements.txt
```

**Rules:**
- Always commit `requirements.txt` with pinned versions.
- Pin Dagster version explicitly to avoid breaking changes.
{% endif %}

---

## 2. Container

**Dockerfile:**

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY dagster.yaml .

# Dagster webserver (UI)
EXPOSE 3000
CMD ["dagster-webserver", "-h", "0.0.0.0", "-p", "3000"]
```

**Docker Compose for local development:**

```yaml
services:
  webserver:
    build: .
    command: dagster-webserver -h 0.0.0.0 -p 3000
    ports: ["3000:3000"]
    environment:
      DAGSTER_HOME: /app
    volumes:
      - ./src:/app/src
  daemon:
    build: .
    command: dagster-daemon run
    environment:
      DAGSTER_HOME: /app
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: dagster
      POSTGRES_USER: dagster
      POSTGRES_PASSWORD: dagster
```

**Rules:**
- Webserver (UI) and daemon (schedules/sensors) run as separate containers.
- `DAGSTER_HOME` must point to the directory containing `dagster.yaml`.
- Use PostgreSQL for the Dagster instance storage in production (not SQLite).

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**

- IaC files location: `infra/` directory at project root.
- Dagster instance DB and run storage should be provisioned via IaC.
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**dagster.yaml (instance configuration):**

```yaml
# dagster.yaml
storage:
  postgres:
    postgres_url:
      env: DAGSTER_PG_URL

run_launcher:
  module: dagster.core.launcher
  class: DefaultRunLauncher

compute_logs:
  module: dagster.core.storage.local_compute_log_manager
  class: LocalComputeLogManager
  config:
    base_dir: /tmp/dagster-logs
```

**Rules:**
- All config via environment variables. Never hardcode secrets or URLs.
- Use `EnvVar("KEY")` in resource definitions for runtime configuration.
- Each environment uses its own `dagster.yaml` or env var overrides.
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
5. Definitions validation (python -c "from src.{service_name}.definitions import defs")
6. Unit tests (pytest tests/unit/)
7. Integration tests (with test DB)
8. Build container image
9. Push to registry
10. Deploy (update code location)
```

**Critical:** Definitions validation must always run — catches import errors and configuration issues before deployment.
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

```bash
# Dagster webserver health
curl http://localhost:3000/server_info

# Dagster daemon health
dagster-daemon health
```

**Monitoring:**
- Webserver `/server_info` endpoint for liveness.
- Daemon health check for schedule/sensor processing.
- Monitor asset materialization duration and failure rate via Dagster UI or metrics export.

---

## 6. Operational Commands

```bash
# Start webserver (development)
dagster dev -m src.{service_name}.definitions

# Start webserver (production)
dagster-webserver -h 0.0.0.0 -p 3000

# Start daemon (schedules + sensors)
dagster-daemon run

# Materialize assets
dagster asset materialize --select raw_users
dagster asset materialize --select raw_users --partition 2024-01-15

# List assets
dagster asset list

# Wipe asset materializations (development only)
dagster asset wipe --all

# Check instance status
dagster instance info
```
