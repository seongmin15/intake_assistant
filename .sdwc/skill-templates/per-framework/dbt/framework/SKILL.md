# Framework — dbt

> This skill defines dbt-specific patterns for the **{{ name }}** service.
> Read this before building or modifying any data pipeline logic.

---

## 1. Project Configuration

### dbt_project.yml

```yaml
# dbt_project.yml
name: "{{ name }}"
version: "1.0.0"
config-version: 2

profile: "{{ name }}"

model-paths: ["models"]
seed-paths: ["seeds"]
test-paths: ["tests"]
macro-paths: ["macros"]
snapshot-paths: ["snapshots"]
analysis-paths: ["analyses"]

models:
  {{ name }}:
    staging:
      +materialized: view
      +schema: staging
    intermediate:
      +materialized: ephemeral
      +schema: intermediate
    marts:
      +materialized: table
      +schema: marts

seeds:
  {{ name }}:
    +schema: seeds

snapshots:
  {{ name }}:
    +schema: snapshots
```

**Materialization strategy:**

| Layer | Materialization | Rationale |
|-------|----------------|-----------|
| **staging** | `view` | Lightweight, always reflects source |
| **intermediate** | `ephemeral` | Inline CTE, not stored. Use `view` if debugging needed |
| **marts** | `table` | Performant reads for BI/consumers |
| **incremental** | `incremental` | Large fact tables that append over time |

### Packages

```yaml
# packages.yml
packages:
  - package: dbt-labs/dbt_utils
    version: [">=1.0.0", "<2.0.0"]
  - package: dbt-labs/codegen
    version: [">=0.12.0", "<1.0.0"]
```

```bash
dbt deps    # install packages
```

---

## 2. Model Layering

### Three-layer architecture

```
Sources (raw) → Staging (stg_) → Intermediate (int_) → Marts (fct_, dim_)
```

**Layer responsibilities:**

| Layer | Purpose | Input | Output |
|-------|---------|-------|--------|
| **Staging** | Clean, rename, cast | `source()` only | 1:1 with source tables |
| **Intermediate** | Join, filter, transform | `ref()` to staging/intermediate | Business logic building blocks |
| **Marts** | Final consumption | `ref()` to intermediate | Fact & dimension tables |

**Dependency rules:**
- Staging → references sources only (`source()`)
- Intermediate → references staging or other intermediate (`ref()`)
- Marts → references intermediate or staging (`ref()`)
- **Never** reference raw tables directly from intermediate or marts.

### Source declarations

```yaml
# models/staging/_stg_stripe_sources.yml
version: 2

sources:
  - name: stripe
    database: "{{ env_var('RAW_DATABASE') }}"
    schema: stripe_raw
    tables:
      - name: payments
        description: "Raw payment events from Stripe"
      - name: customers
        description: "Raw customer records from Stripe"
```

---

## 3. Incremental Models

For large fact tables that grow over time:

```sql
-- models/marts/fct_events__page_views.sql
{{
    config(
        materialized='incremental',
        unique_key='event_id',
        incremental_strategy='merge',
        on_schema_change='append_new_columns'
    )
}}

with

source_events as (
    select * from {{ ref('stg_analytics__events') }}

    {% if is_incremental() %}
    where event_timestamp > (select max(event_timestamp) from {{ this }})
    {% endif %}
),

final as (
    select
        event_id,
        user_id,
        page_url,
        event_timestamp,
        session_id

    from source_events
)

select * from final
```

**Incremental strategies:**

| Strategy | When to use | Supported warehouses |
|----------|-------------|---------------------|
| `append` | No duplicates possible | All |
| `merge` | Upsert by unique key | Snowflake, BigQuery, Databricks |
| `delete+insert` | Replace by partition/key | Snowflake, Postgres, Redshift |

**Rules:**
- Always define `unique_key` for merge/delete+insert.
- Use `is_incremental()` block to filter new rows.
- Reference `{{ this }}` to compare against existing data.
- Set `on_schema_change` to handle column evolution.
- Run `dbt run --full-refresh` when the model logic changes.

---

## 4. Snapshots (SCD Type 2)

```sql
-- snapshots/snap_stripe__subscriptions.sql
{% snapshot snap_stripe__subscriptions %}

{{
    config(
        target_schema='snapshots',
        unique_key='subscription_id',
        strategy='timestamp',
        updated_at='updated_at'
    )
}}

select * from {{ source('stripe', 'subscriptions') }}

{% endsnapshot %}
```

**Snapshot strategies:**

| Strategy | Config | When to use |
|----------|--------|-------------|
| `timestamp` | `updated_at` column | Source has reliable update timestamp |
| `check` | `check_cols` list | Compare specific columns for changes |

**Rules:**
- Snapshots reference `source()` — they capture raw data changes.
- Run snapshots on a schedule before model runs.
- Never modify snapshot SQL after initial deployment — it invalidates history.
- Snapshot output columns: `dbt_valid_from`, `dbt_valid_to`, `dbt_scd_id`.

---

## 5. Jinja & Macros

### Variable usage

```sql
-- Environment-specific configuration
select * from {{ ref('stg_events') }}
where event_date >= '{{ var("start_date", "2024-01-01") }}'
```

```bash
# Override at runtime
dbt run --vars '{"start_date": "2025-01-01"}'
```

### Environment variables

```sql
-- Access environment variables
{% set target_schema = env_var('DBT_TARGET_SCHEMA', 'analytics') %}
```

### Reusable macros

```sql
-- macros/cents_to_dollars.sql
{% macro cents_to_dollars(column_name) %}
    cast({{ column_name }} as numeric(12, 2)) / 100.0
{% endmacro %}

-- Usage in model:
select
    payment_id,
    {{ cents_to_dollars('amount_cents') }} as amount_dollars
from {{ ref('stg_stripe__payments') }}
```

```sql
-- macros/generate_schema_name.sql (override default schema generation)
{% macro generate_schema_name(custom_schema_name, node) %}
    {% if custom_schema_name %}
        {{ custom_schema_name }}
    {% else %}
        {{ target.schema }}
    {% endif %}
{% endmacro %}
```

**Rules:**
- Use macros for logic repeated across 3+ models.
- Keep macros simple — complex logic should be in intermediate models, not Jinja.
- Use `var()` with defaults for configurable parameters.
- Use `env_var()` for environment-specific values (database names, schemas).
- Never use Jinja for business logic that belongs in SQL.

---

## 6. Seeds

Static reference data stored as CSV:

```csv
-- seeds/country_codes.csv
country_code,country_name,region
US,United States,North America
GB,United Kingdom,Europe
JP,Japan,Asia Pacific
```

```yaml
# dbt_project.yml
seeds:
  {{ name }}:
    country_codes:
      +column_types:
        country_code: varchar(2)
```

```bash
dbt seed    # load seeds to warehouse
```

**Rules:**
- Seeds are for small, static reference data (country codes, status mappings).
- Never use seeds for large datasets — use sources instead.
- Define `column_types` in `dbt_project.yml` for type safety.
- Reference seeds with `ref()` like any other model.

---

## 7. Documentation & Lineage

### Model documentation

```yaml
# models/marts/_marts_finance_models.yml
version: 2

models:
  - name: fct_orders__completed
    description: |
      Completed orders fact table.
      Grain: one row per order.
      Updated: daily via incremental.
    columns:
      - name: order_id
        description: "Surrogate key for the order"
      - name: net_amount
        description: "Order total minus discounts, in USD"
```

### Generate and serve docs

```bash
dbt docs generate    # build documentation site
dbt docs serve       # serve at localhost:8080
```

**Rules:**
- Every model must have a description in its `_models.yml`.
- Every column in marts models must have a description.
- Staging column descriptions can be inherited from source definitions.
- Use `dbt docs generate` in CI to verify docs build successfully.

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| `select *` in marts | Schema changes break downstream | List columns explicitly |
| Skipping staging layer | No single place to rename/cast | Always create staging models |
| Hardcoded table names | Breaks lineage, no environment portability | Use `ref()` and `source()` |
| Complex Jinja logic | Unreadable, hard to debug | Keep Jinja simple; logic in SQL/intermediate models |
| No `unique_key` on incremental | Duplicate rows | Always define `unique_key` |
| Missing schema tests | Data quality issues undetected | Minimum: `unique` + `not_null` on every PK |
| Seeds for large data | Slow loads, version control bloat | Use sources for anything over 1,000 rows |
| `{{ this }}` outside incremental | Reference to non-existent table | Only use inside `{% if is_incremental() %}` |
| No source freshness | Stale data silently served | Define freshness for all time-sensitive sources |
| Modifying applied snapshots | Corrupts SCD history | Never change snapshot SQL after initial run |
