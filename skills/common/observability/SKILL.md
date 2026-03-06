# Observability — Project Rules

> This skill defines logging, metrics, and alerting principles for the entire project.
> Per-framework implementation details are in each service's `framework/SKILL.md`.

---

## 1. Logging Principles

**Framework:** structlog**Structured logging:** enabled — all logs must be JSON-formatted.**Sensitive data masking:** enabled — mask PII and secrets before logging.**Retention:** 30 days
### Log Levels

| Level | When to use | Example |
|-------|-------------|---------|
| **ERROR** | Operation failed, needs attention | DB connection lost, external API 5xx |
| **WARNING** | Degraded but functional, or unusual condition | Retry succeeded, rate limit approaching |
| **INFO** | Normal business events | Request handled, task completed, deploy started |
| **DEBUG** | Development diagnostics | Query parameters, intermediate values |

**Rules:**
- Use INFO as the default production level.
- Every log entry must include: timestamp, level, service name, message.
- Request logs must include: method, path, status code, duration.
- Never log: passwords, tokens, API keys, credit card numbers, PII.
- Mask fields: email (show first 3 chars), phone (last 4 digits), names (first char + ***).

### What to Log

| Event | Level | Required fields |
|-------|-------|----------------|
| Incoming request | INFO | method, path, request_id |
| Request completed | INFO | method, path, status, duration_ms |
| External API call | INFO | target, method, status, duration_ms |
| DB query (slow) | WARNING | query_summary, duration_ms (threshold: 1s) |
| Authentication failure | WARNING | attempt_type, source_ip |
| Unhandled exception | ERROR | exception_type, message, stack_trace |
| Background task start/end | INFO | task_name, status, duration_ms |

---

## 2. Metrics


### Standard Metrics (all services should emit)

| Metric | Type | Description |
|--------|------|-------------|
| `request_count` | Counter | Total requests by method, path, status |
| `request_duration_seconds` | Histogram | Response time distribution |
| `error_count` | Counter | Errors by type |
| `active_connections` | Gauge | Current open connections |
| `dependency_call_duration` | Histogram | External dependency latency |

---

## 3. Alerting


### Alert Design Rules

- Alert on symptoms (error rate, latency), not causes (CPU, memory) when possible.
- Every alert must have a runbook link (→ docs/common/12-runbook).
- Severity levels: **critical** (page immediately), **warning** (review within hours).
- Avoid alert fatigue — if an alert fires more than 5 times/week without action, tune it or remove it.

---

## 5. Health Checks


**Rules:**
- Every service exposes `/health` (liveness) and `/ready` (readiness).
- Liveness: returns 200 if the process is alive. No dependency checks.
- Readiness: checks critical dependencies (DB, cache). Returns 503 if not ready.
- Health endpoints are public — no auth required.
