# Deployment — Prefect

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
- Pin Prefect version and all integration packages (e.g., `prefect-sqlalchemy`, `prefect-aws`).
{% endif %}
{% if build_tool == "pip" %}
```bash
pip install -r requirements.txt
```

**Rules:**
- Always commit `requirements.txt` with pinned versions.
- Pin Prefect version explicitly.
{% endif %}

---

## 2. Container

**Dockerfile:**

```dockerfile
FROM prefecthq/prefect:2-python3.12

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY prefect.yaml .
```

**Docker Compose for local development:**

```yaml
services:
  server:
    image: prefecthq/prefect:2-python3.12
    command: prefect server start --host 0.0.0.0
    ports: ["4200:4200"]
  worker:
    build: .
    command: prefect worker start -p default-pool
    environment:
      PREFECT_API_URL: http://server:4200/api
    depends_on: [server]
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: prefect
```

**Rules:**
- Server (UI + API) and worker run as separate containers.
- Use Prefect Cloud or self-hosted server for production.
- Workers pull and execute flow runs from work pools.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**

- IaC files location: `infra/` directory at project root.
- Prefect server DB and worker infrastructure should be provisioned via IaC.
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Prefect configuration via environment variables:**

```bash
# Server connection
PREFECT_API_URL=https://api.prefect.cloud/api/accounts/.../workspaces/...
PREFECT_API_KEY=pnu_...

# Or self-hosted
PREFECT_API_URL=http://prefect-server:4200/api
```

**Rules:**
- All config via environment variables. Never hardcode secrets or URLs.
- Use Prefect blocks for external system credentials.
- Use Prefect variables for environment-specific parameters.
- Each environment points to its own Prefect server/workspace.
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
6. Integration tests (with test harness)
7. Build container image
8. Push to registry
9. Deploy flows (prefect deploy --all)
```

**Rules:**
- Pipeline must pass before merge.
- `prefect deploy --all` registers/updates all deployments from `prefect.yaml`.
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

## 5. Health Check

```bash
# Prefect server health
curl http://localhost:4200/api/health

# Worker status (via Prefect UI or CLI)
prefect work-pool inspect default-pool
```

**Monitoring:**
- Server `/api/health` endpoint for liveness.
- Work pool status for worker health.
- Monitor flow run duration and failure rate via Prefect UI or metrics.

---

## 6. Operational Commands

```bash
# Start server (development)
prefect server start

# Start worker
prefect worker start -p default-pool

# Deploy flows
prefect deploy --all
prefect deploy -n user-sync-daily

# Trigger flow run manually
prefect deployment run user-sync-daily --param date=2024-01-15

# List deployments
prefect deployment ls

# View flow runs
prefect flow-run ls

# Register blocks
prefect block register -m prefect_sqlalchemy

# Create work pool
prefect work-pool create default-pool --type process
```
