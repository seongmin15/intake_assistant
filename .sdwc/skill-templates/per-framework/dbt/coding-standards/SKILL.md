# Coding Standards — dbt

> This skill defines coding rules for the **{{ name }}** service (dbt / SQL).
> Read this before writing or reviewing any dbt model or SQL code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── models/
│   ├── staging/                       ← 1:1 source mirrors (stg_)
│   │   └── {source_system}/
│   │       ├── _stg_{source}_models.yml
│   │       └── stg_{source}__{entity}.sql
│   ├── intermediate/                  ← business logic joins & transforms (int_)
│   │   └── {domain}/
│   │       ├── _int_{domain}_models.yml
│   │       └── int_{domain}__{description}.sql
│   └── marts/                         ← final consumption layer (fct_, dim_)
│       └── {domain}/
│           ├── _marts_{domain}_models.yml
│           ├── fct_{domain}__{event}.sql
│           └── dim_{entity}.sql
├── seeds/                             ← static reference data (CSV)
│   └── {name}.csv
├── snapshots/                         ← SCD Type 2 captures
│   └── snap_{source}__{entity}.sql
├── macros/                            ← reusable SQL/Jinja functions
│   ├── {domain}/
│   │   └── {macro_name}.sql
│   └── tests/
│       └── {custom_test}.sql
├── tests/                             ← singular (ad-hoc) data tests
│   └── assert_{description}.sql
├── analyses/                          ← exploratory queries (not materialized)
│   └── {analysis_name}.sql
├── dbt_project.yml                    ← project config
├── packages.yml                       ← dbt package dependencies
├── profiles.yml                       ← connection profiles (local only)
└── README.md
```

**Rules:**
- Follow the **staging → intermediate → marts** layering strictly.
- Staging models are 1:1 with source tables — rename, cast, but no joins.
- Intermediate models contain business logic joins and transformations.
- Marts are the final output — optimized for consumption by BI tools or downstream services.
- Never skip layers: source → staging → (intermediate) → marts. Direct source-to-mart is forbidden.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Staging models | `stg_{source}__{entity}` | `stg_stripe__payments` |
| Intermediate models | `int_{domain}__{description}` | `int_finance__payments_joined` |
| Fact tables | `fct_{domain}__{event}` | `fct_orders__completed` |
| Dimension tables | `dim_{entity}` | `dim_customers` |
| Snapshots | `snap_{source}__{entity}` | `snap_stripe__subscriptions` |
| Seeds | descriptive snake_case | `country_codes`, `currency_rates` |
| Macros | snake_case verb-first | `generate_surrogate_key`, `pivot_values` |
| Custom tests | `assert_{description}` | `assert_orders_have_customer` |
| Sources | snake_case matching origin | `stripe`, `postgres_main` |
| YAML schema files | `_{layer}_{scope}_models.yml` | `_stg_stripe_models.yml` |
| Columns | snake_case | `customer_id`, `created_at`, `total_amount` |

**Column naming rules:**
- Primary keys: `{entity}_id` (e.g., `customer_id`, `order_id`).
- Foreign keys: `{referenced_entity}_id` — same name as the referenced PK.
- Timestamps: `{event}_at` (e.g., `created_at`, `updated_at`, `deleted_at`).
- Booleans: `is_{adjective}` or `has_{noun}` (e.g., `is_active`, `has_subscription`).
- Dates: `{event}_date` (e.g., `order_date`).
- Amounts: `{description}_amount` (e.g., `total_amount`, `discount_amount`).

---

## 3. SQL Style Guide

### Formatting

```sql
-- ✅ Preferred style
select
    orders.order_id,
    orders.customer_id,
    customers.customer_name,
    orders.order_date,
    orders.total_amount

from {{ ref('stg_shopify__orders') }} as orders
left join {{ ref('dim_customers') }} as customers
    on orders.customer_id = customers.customer_id

where orders.order_date >= '2024-01-01'
    and orders.status != 'cancelled'

group by 1, 2, 3, 4
order by orders.order_date desc
```

**Rules:**
- **Lowercase** all SQL keywords (`select`, `from`, `where`, `join`).
- **Leading commas** — place commas at the start of each column line for easy commenting.
- **One column per line** in `select` — never comma-separated on a single line.
- **Explicit column references** — always qualify with table alias (e.g., `orders.order_id`).
- **Table aliases** — use meaningful short names, not single letters.
- **Indentation** — 4 spaces, no tabs.
- **Join conditions** — `on` indented under the `join`, conditions on separate lines if multiple.
- **No `select *`** — always list columns explicitly in staging and above.

### CTEs over subqueries

```sql
-- ✅ CTE-based (readable, debuggable)
with

orders as (
    select * from {{ ref('stg_shopify__orders') }}
),

customers as (
    select * from {{ ref('dim_customers') }}
),

final as (
    select
        orders.order_id,
        customers.customer_name,
        orders.total_amount
    from orders
    left join customers
        on orders.customer_id = customers.customer_id
)

select * from final
```

**Rules:**
- Use CTEs for all multi-step queries. Never nest subqueries.
- Name the last CTE `final` — this is a dbt community convention.
- `select * from final` at the end makes the output obvious.
- Each CTE should do one logical thing (one join, one filter, one aggregation).

---

## 4. Ref & Source Usage

### `ref()` — for dbt models

```sql
-- Always use ref() to reference other dbt models
select * from {{ ref('stg_stripe__payments') }}
```

### `source()` — for raw tables

```sql
-- Only in staging models — reference raw source tables
select * from {{ source('stripe', 'payments') }}
```

**Rules:**
- Staging models are the **only** layer that uses `source()`.
- Intermediate and marts models use `ref()` exclusively.
- Never use hardcoded table names — always `ref()` or `source()`.
- This ensures dbt tracks the full lineage graph.

---

## 5. Model Patterns

### Staging model template

```sql
-- stg_stripe__payments.sql
with

source as (
    select * from {{ source('stripe', 'payments') }}
),

renamed as (
    select
        id as payment_id,
        customer as customer_id,
        cast(amount as numeric(12, 2)) as payment_amount,
        currency,
        status as payment_status,
        cast(created as timestamp) as created_at

    from source
)

select * from renamed
```

**Staging rules:**
- 1:1 with source — one staging model per source table.
- Rename columns to project conventions.
- Cast types explicitly.
- No joins, no filters (except deduplication if source has duplicates).

### Intermediate model template

```sql
-- int_finance__payments_with_customers.sql
with

payments as (
    select * from {{ ref('stg_stripe__payments') }}
),

customers as (
    select * from {{ ref('stg_postgres__customers') }}
),

final as (
    select
        payments.payment_id,
        payments.payment_amount,
        payments.created_at,
        customers.customer_name,
        customers.customer_segment

    from payments
    left join customers
        on payments.customer_id = customers.customer_id
)

select * from final
```

### Marts model template

```sql
-- fct_orders__completed.sql
with

orders as (
    select * from {{ ref('int_orders__enriched') }}
),

final as (
    select
        order_id,
        customer_id,
        order_date,
        total_amount,
        discount_amount,
        total_amount - discount_amount as net_amount

    from orders
    where status = 'completed'
)

select * from final
```

---

## 6. Linting & Formatting

| Tool | Purpose | Config file |
|------|---------|-------------|
| **sqlfluff** | SQL linter + formatter | `.sqlfluff` |
| **dbt-checkpoint** | dbt-specific pre-commit hooks | `.pre-commit-config.yaml` |
| **yamllint** | YAML schema file linting | `.yamllint.yml` |

**sqlfluff configuration:**

```ini
# .sqlfluff
[sqlfluff]
dialect = postgres
templater = dbt
max_line_length = 120

[sqlfluff:indentation]
indent_unit = space
tab_space_size = 4

[sqlfluff:rules:capitalisation.keywords]
capitalisation_policy = lower

[sqlfluff:rules:aliasing.table]
aliasing = explicit

[sqlfluff:rules:aliasing.column]
aliasing = explicit
```

**Commands:**

```bash
sqlfluff lint models/                   # lint
sqlfluff fix models/                    # auto-fix
dbt compile                             # verify Jinja renders
```

**Rules:**
- Run `sqlfluff lint` before every commit.
- Run `dbt compile` to verify all Jinja/ref/source resolves correctly.
- YAML schema files follow consistent formatting (yamllint).

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| `select *` in non-CTE final output | List columns explicitly |
| Hardcoded table names | Use `ref()` and `source()` |
| Business logic in staging | Staging = rename + cast only; logic → intermediate |
| Source-to-mart (skipping layers) | Always go staging → intermediate → marts |
| Subqueries instead of CTEs | Use CTEs for readability |
| Uppercase SQL keywords | Lowercase (`select`, `from`, `where`) |
| Single-letter table aliases | Use meaningful aliases (`orders`, `customers`) |
| No schema YAML for models | Every model must be documented in `_models.yml` |
| Hardcoded date filters | Use `{{ var('start_date') }}` or incremental logic |
| Missing `ref()` dependencies | Breaks lineage graph and run order |
