# Deployment — Airflow

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
{% endif %}
{% if build_tool == "pip" %}
```bash
pip install -r requirements.txt
```
{% endif %}

**Rules:**
- Always commit the lock file.
- Pin Airflow version and all provider packages.
- Use constraint files for Airflow dependency resolution: `pip install "apache-airflow==2.x.x" --constraint constraints.txt`

---

## 2. Container

**Dockerfile (extending official Airflow image):**

```dockerfile
FROM apache/airflow:2.9-python3.12

# Install additional Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy DAGs and source code
COPY dags/ /opt/airflow/dags/
COPY src/ /opt/airflow/src/
```

**Docker Compose for local development:**

```yaml
services:
  webserver:
    build: .
    command: airflow webserver
    ports: ["8080:8080"]
    environment:
      AIRFLOW__CORE__EXECUTOR: LocalExecutor
      AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://...
  scheduler:
    build: .
    command: airflow scheduler
  postgres:
    image: postgres:16
```

**Rules:**
- Extend the official `apache/airflow` image — don't build from scratch.
- Webserver and scheduler must run as separate containers.
- Use `LocalExecutor` for dev, `CeleryExecutor` or `KubernetesExecutor` for production.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**

- IaC files location: `infra/` directory at project root.
- Airflow metadata DB and broker should be provisioned via IaC.
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Airflow configuration via environment variables:**

```bash
# Core
AIRFLOW__CORE__EXECUTOR=CeleryExecutor
AIRFLOW__CORE__DAGS_FOLDER=/opt/airflow/dags
AIRFLOW__CORE__LOAD_EXAMPLES=False

# Database
AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql+psycopg2://...

# Connections (external systems)
AIRFLOW_CONN_POSTGRES_MAIN=postgresql://...
AIRFLOW_CONN_S3_DATA_LAKE=aws://...
```

**Rules:**
- All Airflow config via `AIRFLOW__SECTION__KEY` env vars.
- External connections via `AIRFLOW_CONN_{ID}` env vars or secrets backend.
- Never commit credentials. Use secrets management in production.
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
5. DAG integrity tests (pytest tests/unit/test_dag_integrity.py)
6. Unit tests (pytest tests/unit/)
7. Integration tests (with test DB)
8. Build container image
9. Push to registry
10. Deploy (update DAGs)
```

**Critical:** DAG integrity tests must always run — they catch import errors before deployment.
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
# Airflow has built-in health endpoint
curl http://localhost:8080/health

# Check scheduler heartbeat
airflow jobs check --job-type SchedulerJob --hostname $(hostname)
```

**Monitoring:**
- Webserver `/health` endpoint for liveness.
- Scheduler heartbeat for scheduler health.
- Monitor DAG run duration and failure rate via Airflow metrics.

---

## 6. Operational Commands

```bash
# Initialize metadata database
airflow db init

# Apply migrations
airflow db upgrade

# Create admin user
airflow users create --username admin --role Admin ...

# List DAGs
airflow dags list

# Trigger a DAG manually
airflow dags trigger user_sync --conf '{"full_refresh": true}'

# Backfill
airflow dags backfill user_sync -s 2024-01-01 -e 2024-01-31

# Clear task for rerun
airflow tasks clear user_sync -t extract -s 2024-01-15

# Check task logs
airflow tasks logs user_sync extract 2024-01-15
```
