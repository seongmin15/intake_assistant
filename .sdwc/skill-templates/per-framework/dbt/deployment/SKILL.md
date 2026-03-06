# Deployment — dbt

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

{% if build_tool == "pip" %}
```bash
pip install dbt-core dbt-postgres      # adapt adapter to your warehouse
pip install -r requirements.txt
dbt deps                                # install dbt packages
```

**Rules:**
- Always commit `requirements.txt` with pinned versions.
- Pin dbt-core and adapter versions together (compatible matrix).
- Run `dbt deps` after any `packages.yml` change.
{% endif %}
{% if build_tool == "poetry" %}
```bash
poetry install
poetry lock
dbt deps                                # install dbt packages
```

**Rules:**
- Always commit `poetry.lock`.
- Pin dbt-core and adapter versions.
- Run `dbt deps` after any `packages.yml` change.
{% endif %}

### dbt Packages

```yaml
# packages.yml
packages:
  - package: dbt-labs/dbt_utils
    version: [">=1.0.0", "<2.0.0"]
```

```bash
dbt deps    # install packages (run after clone and after changes)
```

---

## 2. Container

**Dockerfile:**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dbt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy dbt project
COPY dbt_project.yml packages.yml profiles.yml ./
COPY models/ ./models/
COPY macros/ ./macros/
COPY seeds/ ./seeds/
COPY snapshots/ ./snapshots/
COPY tests/ ./tests/
COPY analyses/ ./analyses/

# Install dbt packages
RUN dbt deps

# Default command
CMD ["dbt", "build", "--target", "prod"]
```

**.dockerignore:**

```
.git
.env
target/
logs/
dbt_packages/
*.pyc
```

**Rules:**
- Container includes all dbt project files and pre-installed packages.
- `profiles.yml` in the image uses environment variables for connection details.
- Never hardcode credentials in the image.
- `dbt deps` runs at build time so packages are cached in the image.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**

- IaC files location: `infra/` directory at project root.
- Data warehouse, service accounts, and IAM roles provisioned via IaC.
- Never hardcode environment-specific values.
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**profiles.yml (environment-based):**

```yaml
# profiles.yml
{{ name }}:
  target: "{{ env_var('DBT_TARGET', 'dev') }}"
  outputs:
    dev:
      type: postgres       # adapt to warehouse
      host: "{{ env_var('DB_HOST') }}"
      port: 5432
      user: "{{ env_var('DB_USER') }}"
      password: "{{ env_var('DB_PASSWORD') }}"
      dbname: "{{ env_var('DB_NAME') }}"
      schema: dev_{{ env_var('USER', 'default') }}
      threads: 4
    prod:
      type: postgres
      host: "{{ env_var('DB_HOST') }}"
      port: 5432
      user: "{{ env_var('DB_USER') }}"
      password: "{{ env_var('DB_PASSWORD') }}"
      dbname: "{{ env_var('DB_NAME') }}"
      schema: analytics
      threads: 8
```

**Rules:**
- All connection details via environment variables.
- Dev uses developer-specific schema (`dev_{username}`) to avoid conflicts.
- Prod uses fixed schema names (`analytics`, `staging`, etc.).
- `profiles.yml` is committed with `env_var()` references — never raw credentials.
- Threads: 4 for dev, 8+ for prod (parallel model execution).
{% if deployment.secrets_management %}
- **Secrets management: {{ deployment.secrets_management }}** — fetch warehouse credentials from this source.
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
2. Install dbt + packages (dbt deps)
3. Lint SQL (sqlfluff lint models/)
4. Compile (dbt compile — verify Jinja renders)
5. Run modified models (dbt build --select state:modified+)
6. Test modified models (included in dbt build)
7. Generate docs (dbt docs generate)
8. Deploy to production (dbt build --target prod)
```

### Slim CI (state-based builds)

```bash
# Only build and test models that changed (requires manifest.json from last prod run)
dbt build --select state:modified+ --state ./target-prod/
```

**Rules:**
- Pipeline must pass before merge.
- Use slim CI (`state:modified+`) to avoid rebuilding unchanged models.
- Store production `manifest.json` as CI artifact for state comparison.
- `dbt build` runs both models and tests in dependency order.
- Lint SQL on every PR — fail on errors.
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

## 5. Health Check & Monitoring

dbt does not serve HTTP traffic. Monitor pipeline health via:

### Run results

```bash
# After dbt run/build, check results
dbt run --target prod
# Results in target/run_results.json
```

### Source freshness monitoring

```bash
# Run on schedule (cron)
dbt source freshness --target prod
# Results in target/sources.json
```

### Key metrics to monitor

| Metric | How | Alert threshold |
|--------|-----|-----------------|
| Model build failures | `run_results.json` status | Any failure |
| Source freshness | `dbt source freshness` | `error_after` exceeded |
| Model build duration | `run_results.json` timing | >2x historical average |
| Test failures | `run_results.json` test status | Any failure |
| Row count anomalies | Custom singular tests | Sudden drop >50% |

**Rules:**
- Parse `run_results.json` after every run for alerting.
- Schedule `dbt source freshness` independently of model runs.
- Set up alerts for test failures and source staleness (→ skills/common/observability/).

---

## 6. Operational Commands

```bash
# --- Development ---
dbt debug                    # verify connection + project config
dbt deps                     # install packages
dbt compile                  # render Jinja without executing
dbt seed                     # load seed CSVs

# --- Run models ---
dbt run                      # run all models
dbt run --select staging     # run staging layer only
dbt run --select fct_orders  # run specific model
dbt run --select fct_orders+ # run model + downstream
dbt run --select +fct_orders # run model + upstream
dbt run --full-refresh       # rebuild incremental models from scratch

# --- Test ---
dbt test                     # run all tests
dbt test --select stg_stripe__payments    # test specific model
dbt source freshness         # check source freshness

# --- Build (run + test in order) ---
dbt build                    # recommended: models + tests in dependency order
dbt build --select state:modified+ --state ./prod-manifest/  # slim CI

# --- Snapshots ---
dbt snapshot                 # capture SCD Type 2 snapshots

# --- Documentation ---
dbt docs generate            # generate docs site
dbt docs serve               # serve at localhost:8080

# --- Debugging ---
dbt ls --select staging      # list models matching selector
dbt show --select fct_orders --limit 10   # preview model output
```

### Recommended execution order (production)

```bash
dbt deps                     # 1. ensure packages up to date
dbt source freshness         # 2. verify sources are fresh
dbt snapshot                 # 3. capture snapshots before transform
dbt build --target prod      # 4. run models + tests
dbt docs generate            # 5. update documentation
```
