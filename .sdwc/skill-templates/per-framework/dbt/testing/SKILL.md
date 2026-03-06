# Testing — dbt

> This skill defines testing rules for the **{{ name }}** service (dbt / SQL).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **schema tests** for all models.
- Every model has `unique` and `not_null` on its primary key.
- Foreign keys have `relationships` tests.
- Enum columns have `accepted_values` tests.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **schema tests + singular tests for business rules**.
- Schema tests: `unique`, `not_null`, `relationships`, `accepted_values` on all models.
- Singular tests: validate business logic invariants (e.g., order total > 0, end_date > start_date).
- Row count tests: marts models produce expected minimum rows.
- Freshness tests: sources are not stale.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **schema tests + singular tests + data quality checks**.
- Schema tests: `unique`, `not_null`, `relationships`, `accepted_values` on all models.
- Singular tests: business logic invariants.
- Row count tests: marts produce expected row counts.
- Freshness tests: sources are not stale.
- Distribution tests: column values within expected ranges, no sudden cardinality shifts.
- Cross-model consistency: fact tables reconcile with dimension tables.
{% endif %}

---

## 2. Test Structure

dbt tests live in two locations:

```
{{ name }}/
├── models/
│   └── {layer}/
│       └── _{layer}_{scope}_models.yml   ← schema tests (inline)
├── tests/                                 ← singular tests (ad-hoc SQL)
│   ├── assert_{business_rule}.sql
│   └── assert_{data_quality}.sql
└── macros/
    └── tests/                             ← generic custom test macros
        └── test_{name}.sql
```

| Test type | Location | When to use |
|-----------|----------|-------------|
| **Schema tests** | `_models.yml` | Primary key, foreign key, enum, not null |
| **Singular tests** | `tests/` | Business logic assertions, cross-model checks |
| **Generic custom tests** | `macros/tests/` | Reusable test logic across models |

---

## 3. Schema Tests

### Model YAML definition

```yaml
# models/staging/_stg_stripe_models.yml
version: 2

models:
  - name: stg_stripe__payments
    description: "Staging model for Stripe payments — 1:1 with source."
    columns:
      - name: payment_id
        description: "Primary key"
        data_tests:
          - unique
          - not_null

      - name: customer_id
        description: "FK to customers"
        data_tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id

      - name: payment_status
        description: "Payment status"
        data_tests:
          - accepted_values:
              values: ['succeeded', 'pending', 'failed', 'refunded']

      - name: payment_amount
        description: "Payment amount in base currency"
        data_tests:
          - not_null
```

### Marts model testing

```yaml
# models/marts/_marts_finance_models.yml
version: 2

models:
  - name: fct_orders__completed
    description: "Completed orders fact table."
    columns:
      - name: order_id
        data_tests:
          - unique
          - not_null
      - name: net_amount
        data_tests:
          - not_null
```

**Rules:**
- Every model must have a `_models.yml` entry with description and column tests.
- Every primary key has `unique` + `not_null`.
- Every foreign key has `relationships` test.
- Every enum/status column has `accepted_values`.

---

## 4. Singular Tests

SQL queries that return rows that **fail** the test (0 rows = pass).

```sql
-- tests/assert_orders_have_positive_amount.sql
-- Orders must have a positive net amount
select
    order_id,
    net_amount

from {{ ref('fct_orders__completed') }}

where net_amount <= 0
```

```sql
-- tests/assert_no_orphan_order_items.sql
-- Every order item must belong to an existing order
select
    oi.order_item_id

from {{ ref('int_orders__items') }} as oi
left join {{ ref('fct_orders__completed') }} as o
    on oi.order_id = o.order_id

where o.order_id is null
```

**Rules:**
- Singular tests return **failing rows** — 0 rows means test passes.
- Name: `assert_{what_should_be_true}.sql`.
- Use singular tests for business invariants that schema tests can't express.
- Include relevant columns in the select for debugging when tests fail.

---

## 5. Source Freshness Tests

```yaml
# models/staging/_stg_stripe_sources.yml
version: 2

sources:
  - name: stripe
    database: "{{ env_var('RAW_DATABASE') }}"
    schema: stripe_raw
    freshness:
      warn_after: { count: 12, period: hour }
      error_after: { count: 24, period: hour }
    loaded_at_field: _etl_loaded_at

    tables:
      - name: payments
        description: "Raw Stripe payments"
      - name: customers
        description: "Raw Stripe customers"
```

```bash
# Check source freshness
dbt source freshness
```

**Rules:**
- Define freshness checks for all sources with time-sensitive data.
- `warn_after`: alert but don't fail the pipeline.
- `error_after`: fail the pipeline if source is stale.
- `loaded_at_field` must point to a reliable ETL timestamp column.

---

## 6. Generic Custom Tests

Reusable test macros for project-specific patterns:

```sql
-- macros/tests/test_positive_value.sql
{% test positive_value(model, column_name) %}

select
    {{ column_name }}

from {{ model }}

where {{ column_name }} < 0

{% endtest %}
```

**Usage in YAML:**

```yaml
columns:
  - name: total_amount
    data_tests:
      - positive_value
```

**When to create a generic test:**
- When the same assertion applies to 3+ columns across different models.
- Singular tests should be converted to generics if reused.

---

## 7. Test Execution

```bash
# Run all tests
dbt test

# Run tests for specific model
dbt test --select stg_stripe__payments

# Run only schema tests
dbt test --select test_type:generic

# Run only singular tests
dbt test --select test_type:singular

# Run tests for a layer
dbt test --select models/staging/

# Run tests for a model and its downstream dependencies
dbt test --select stg_stripe__payments+

# Source freshness check
dbt source freshness

# Full build + test pipeline
dbt build    # runs models + tests in dependency order
```

**Rules:**
- Run `dbt test` after every `dbt run` — never deploy without testing.
- Use `dbt build` in CI/CD to run models and tests in correct dependency order.
- Source freshness runs on a schedule (cron) independent of model builds.
- Failed tests block deployment — fix before merging.
