# Coding Standards — Temporal ({{ name }})

> Service: {{ name }} | Framework: Temporal | Language: Go
> Build: {{ build_tool }}

---

## §1 Project Structure

```
{{ name }}/
├── cmd/
│   └── worker/
│       └── main.go              ← worker entry point
├── internal/
│   ├── workflow/                 ← workflow definitions (deterministic)
│   │   ├── {{ name }}_workflow.go
│   │   └── {{ name }}_workflow_test.go
│   ├── activity/                ← activity implementations (side effects)
│   │   ├── {{ name }}_activity.go
│   │   └── {{ name }}_activity_test.go
│   ├── worker/                  ← worker setup + registration
│   │   └── worker.go
│   ├── model/                   ← shared types
│   │   └── types.go
│   └── config/
│       └── config.go
├── pkg/                         ← shared utilities
│   └── temporal/                ← Temporal client helpers
│       └── client.go
├── go.mod
├── go.sum
├── Makefile
└── .golangci.yml
```

**Critical separation:**
- `workflow/` — **deterministic only** — no I/O, no time, no random
- `activity/` — all side effects live here (DB, HTTP, file I/O)
- `worker/` — registers workflows + activities, starts the worker

---

## §2 Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Package | lowercase, single word | `workflow`, `activity`, `worker` |
| File | snake_case | `order_workflow.go`, `email_activity.go` |
| Workflow func | PascalCase + `Workflow` suffix | `OrderProcessingWorkflow` |
| Activity func | PascalCase + `Activity` suffix | `SendEmailActivity` |
| Activity struct | PascalCase + `Activities` suffix | `EmailActivities` |
| Signal name | PascalCase constant | `SignalApproval` |
| Query name | PascalCase constant | `QueryStatus` |
| Task queue | kebab-case constant | `order-processing-queue` |
| Workflow ID | domain-prefix + entity ID | `order-{orderID}` |

**Workflow/Activity naming is critical** — Temporal uses function names for routing. Renaming breaks running workflows.

---

## §3 Type System & Interfaces

**Interface rules:**
- Accept interfaces, return concrete structs
- Define interfaces at consumer site
- Keep interfaces small (1-3 methods)

**Workflow input/output types:**
- Always define explicit structs for workflow/activity params and results
- Never use `interface{}` or `any` — breaks serialization

```go
// model/types.go
type OrderInput struct {
    OrderID    string  `json:"order_id"`
    CustomerID string  `json:"customer_id"`
    Amount     float64 `json:"amount"`
}

type OrderResult struct {
    OrderID string `json:"order_id"`
    Status  string `json:"status"`
}
```

**Error handling:**
- Always return `error` as last return value
- Use `temporal.NewApplicationError` for business errors
- Wrap errors with `fmt.Errorf("context: %w", err)`

---

## §4 Import Order

```go
import (
    // 1. Standard library
    "context"
    "fmt"
    "time"

    // 2. Temporal SDK
    "go.temporal.io/sdk/activity"
    "go.temporal.io/sdk/workflow"

    // 3. Third-party
    "go.uber.org/zap"

    // 4. Internal packages
    "{{ name }}/internal/model"
)
```

Four groups separated by blank lines.

---

## §5 Temporal-Specific Patterns

### Activity struct pattern — inject dependencies, not globals

```go
type OrderActivities struct {
    db     *sql.DB
    mailer MailerService
    logger *zap.Logger
}

func NewOrderActivities(db *sql.DB, mailer MailerService, logger *zap.Logger) *OrderActivities {
    return &OrderActivities{db: db, mailer: mailer, logger: logger}
}

func (a *OrderActivities) ValidateOrderActivity(ctx context.Context, input model.OrderInput) error {
    // Has full access to I/O, time, random, etc.
    return a.db.QueryRowContext(ctx, "SELECT ...").Scan(...)
}
```

### Workflow ID design

```go
const (
    TaskQueue        = "order-processing"
    WorkflowIDPrefix = "order-"
)

// Start workflow with deterministic ID (enables deduplication)
opts := client.StartWorkflowOptions{
    ID:        WorkflowIDPrefix + orderID,
    TaskQueue: TaskQueue,
}
```

### Signal and query constants

```go
const (
    SignalApproval = "approval-signal"
    QueryStatus   = "status-query"
)
```

---

## §6 Linting & Formatting

| Tool | Purpose | Config |
|------|---------|--------|
| `gofmt` | Formatting | Built-in |
| `goimports` | Import ordering | Run on save |
| `golangci-lint` | Linting | `.golangci.yml` |
| `go vet` | Static analysis | Built-in |

**Additional lint rules for Temporal:**
- Flag any direct `time.Now()` or `time.Sleep()` in `workflow/` package
- Flag any `net/http` or `database/sql` import in `workflow/` package

```makefile
lint:
	golangci-lint run ./...

# Custom check: no I/O imports in workflow package
lint-workflows:
	@grep -rn '"net/http"\|"database/sql"\|"os"\|"io"' internal/workflow/ && \
	echo "ERROR: I/O imports found in workflow package" && exit 1 || true
```

---

## §7 Anti-patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| I/O in workflow functions | All I/O in activities |
| `time.Now()` in workflows | `workflow.Now(ctx)` |
| `time.Sleep()` in workflows | `workflow.Sleep(ctx, duration)` |
| Random values in workflows | Activities or `workflow.SideEffect` |
| Global state in workflows | Pass state as workflow params |
| `interface{}` for params/results | Explicit typed structs |
| Rename workflow/activity functions | Versioning with `workflow.GetVersion` |
| Goroutines in workflows | `workflow.Go(ctx, func)` |
| `context.Background()` in activities | Use the provided `context.Context` |
| Panic in activity code | Return errors, let retry policy handle |
