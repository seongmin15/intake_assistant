# Framework Patterns — Temporal ({{ name }})

> Service: {{ name }} | Framework: Temporal | Language: Go

---

## §1 Worker Bootstrap

### Worker setup

```go
// cmd/worker/main.go
func main() {
    cfg := config.Load()
    logger := initLogger(cfg.Env)
    defer logger.Sync()

    db := initDB(cfg.Database)
    defer db.Close()

    // Create Temporal client
    c, err := client.Dial(client.Options{
        HostPort:  cfg.Temporal.HostPort,
        Namespace: cfg.Temporal.Namespace,
        Logger:    newTemporalLogger(logger),
    })
    if err != nil {
        logger.Fatal("temporal client failed", zap.Error(err))
    }
    defer c.Close()

    // Create activities with dependencies
    orderActs := activity.NewOrderActivities(db, mailer, logger)

    // Create and start worker
    w := temporalworker.New(c, TaskQueue, temporalworker.Options{
        MaxConcurrentActivityExecutionSize:     10,
        MaxConcurrentWorkflowTaskExecutionSize: 5,
    })

    // Register workflows
    w.RegisterWorkflow(workflow.OrderProcessingWorkflow)

    // Register activities
    w.RegisterActivity(orderActs)

    // Graceful shutdown
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    go func() {
        quit := make(chan os.Signal, 1)
        signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
        <-quit
        cancel()
    }()

    if err := w.Run(temporalworker.InterruptCh()); err != nil {
        logger.Fatal("worker failed", zap.Error(err))
    }
}
```

### Task queue constants

```go
// internal/worker/constants.go
const (
    TaskQueue = "{{ name }}-queue"
)
```

---

## §2 Workflow Determinism Constraints

> **⚠️ CRITICAL**: Temporal replays workflow code to rebuild state. Every workflow execution
> must produce the **exact same sequence of commands** given the same input. Any
> non-deterministic operation will corrupt workflow state and cause replay failures.

### Forbidden in workflows

| ❌ Forbidden | Why | ✅ Use instead |
|-------------|-----|---------------|
| `time.Now()` | Non-deterministic | `workflow.Now(ctx)` |
| `time.Sleep()` | Non-deterministic | `workflow.Sleep(ctx, d)` |
| `rand.Int()` | Non-deterministic | `workflow.SideEffect(ctx, func)` |
| `uuid.New()` | Non-deterministic | `workflow.SideEffect(ctx, func)` |
| `http.Get()` | Side effect (I/O) | Activity |
| `db.Query()` | Side effect (I/O) | Activity |
| `os.ReadFile()` | Side effect (I/O) | Activity |
| `go func(){}()` | Untracked goroutine | `workflow.Go(ctx, func)` |
| `select {}` | Untracked channel | `workflow.NewSelector(ctx)` |
| `sync.Mutex` | Non-deterministic | `workflow.Mutex` |
| Global variables | Shared state | Workflow local variables |
| `context.Background()` | Lacks workflow context | Use `workflow.Context` |

### Side effects for one-time non-deterministic values

```go
// Generate UUID inside workflow (replay-safe)
var orderRef string
workflow.SideEffect(ctx, func(ctx workflow.Context) interface{} {
    return uuid.NewString()
}).Get(&orderRef)
```

`SideEffect` executes once, then replays the recorded result. Use for:
- Random values
- UUIDs
- Current timestamps (when `workflow.Now` is insufficient)

### Versioning for workflow code changes

```go
func OrderProcessingWorkflow(ctx workflow.Context, input model.OrderInput) (*model.OrderResult, error) {
    v := workflow.GetVersion(ctx, "add-fraud-check", workflow.DefaultVersion, 1)

    // Original path
    err := workflow.ExecuteActivity(ctx, acts.ValidateOrderActivity, input).Get(ctx, nil)

    // New path (version 1+)
    if v >= 1 {
        err = workflow.ExecuteActivity(ctx, acts.FraudCheckActivity, input).Get(ctx, nil)
        if err != nil {
            return nil, err
        }
    }

    // ... rest of workflow
}
```

**Rules:**
- NEVER change existing workflow logic for running workflows
- Use `workflow.GetVersion` to branch old vs new behavior
- Increment version number for each change
- Old versions can be removed after all workflows on that version complete

---

## §3 Workflow Patterns

### Sequential activities

```go
func OrderProcessingWorkflow(ctx workflow.Context, input model.OrderInput) (*model.OrderResult, error) {
    logger := workflow.GetLogger(ctx)
    logger.Info("starting order workflow", "orderID", input.OrderID)

    // Activity options
    actOpts := workflow.ActivityOptions{
        StartToCloseTimeout: 30 * time.Second,
        RetryPolicy: &temporal.RetryPolicy{
            InitialInterval:    time.Second,
            BackoffCoefficient: 2.0,
            MaximumInterval:    30 * time.Second,
            MaximumAttempts:    3,
        },
    }
    ctx = workflow.WithActivityOptions(ctx, actOpts)

    // Step 1: Validate
    if err := workflow.ExecuteActivity(ctx, acts.ValidateOrderActivity, input).Get(ctx, nil); err != nil {
        return nil, fmt.Errorf("validation failed: %w", err)
    }

    // Step 2: Process payment
    var payment model.PaymentResult
    if err := workflow.ExecuteActivity(ctx, acts.ProcessPaymentActivity, input).Get(ctx, &payment); err != nil {
        return nil, fmt.Errorf("payment failed: %w", err)
    }

    // Step 3: Send confirmation
    if err := workflow.ExecuteActivity(ctx, acts.SendConfirmationActivity, input).Get(ctx, nil); err != nil {
        logger.Warn("confirmation failed, order still valid", "error", err)
    }

    return &model.OrderResult{OrderID: input.OrderID, Status: "completed"}, nil
}
```

### Parallel activities

```go
// Execute multiple activities concurrently
var (
    inventoryResult model.InventoryResult
    shippingResult  model.ShippingResult
)

inventoryFuture := workflow.ExecuteActivity(ctx, acts.CheckInventoryActivity, input)
shippingFuture := workflow.ExecuteActivity(ctx, acts.CalculateShippingActivity, input)

// Wait for both
if err := inventoryFuture.Get(ctx, &inventoryResult); err != nil {
    return nil, err
}
if err := shippingFuture.Get(ctx, &shippingResult); err != nil {
    return nil, err
}
```

### Signal handling (human-in-the-loop)

```go
func ApprovalWorkflow(ctx workflow.Context, input model.OrderInput) (*model.OrderResult, error) {
    // ... validation activities ...

    // Wait for approval signal with timeout
    approvalCh := workflow.GetSignalChannel(ctx, SignalApproval)
    timerCtx, timerCancel := workflow.WithCancel(ctx)

    selector := workflow.NewSelector(ctx)

    var decision model.ApprovalDecision
    var approved bool

    selector.AddReceive(approvalCh, func(c workflow.ReceiveChannel, more bool) {
        c.Receive(ctx, &decision)
        approved = decision.Approved
        timerCancel()
    })

    selector.AddFuture(workflow.NewTimer(timerCtx, 24*time.Hour), func(f workflow.Future) {
        // Timeout — auto-reject
        approved = false
    })

    selector.Select(ctx)

    if !approved {
        return &model.OrderResult{Status: "rejected"}, nil
    }

    // ... continue processing ...
}
```

### Query handler

```go
func OrderProcessingWorkflow(ctx workflow.Context, input model.OrderInput) (*model.OrderResult, error) {
    currentStatus := "initialized"

    // Register query handler
    err := workflow.SetQueryHandler(ctx, QueryStatus, func() (string, error) {
        return currentStatus, nil
    })
    if err != nil {
        return nil, err
    }

    currentStatus = "validating"
    // ... activities ...
    currentStatus = "processing"
    // ... activities ...
    currentStatus = "completed"

    return &model.OrderResult{Status: currentStatus}, nil
}
```

---

## §4 Activity Patterns

### Activity struct with dependencies

```go
type OrderActivities struct {
    db     *sql.DB
    mailer MailerService
    logger *zap.Logger
}

func (a *OrderActivities) ValidateOrderActivity(ctx context.Context, input model.OrderInput) error {
    logger := activity.GetLogger(ctx)
    logger.Info("validating order", "orderID", input.OrderID)

    if input.Amount <= 0 {
        return temporal.NewApplicationError(
            "invalid amount",
            "VALIDATION_ERROR",
            nil,
        )
    }

    // DB access is allowed in activities
    var exists bool
    err := a.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM orders WHERE id=$1)", input.OrderID).Scan(&exists)
    if err != nil {
        return fmt.Errorf("db check: %w", err)
    }

    return nil
}
```

### Heartbeating for long activities

```go
func (a *OrderActivities) LargeFileProcessActivity(ctx context.Context, input FileInput) error {
    for i, chunk := range input.Chunks {
        // Process chunk...

        // Heartbeat progress — enables cancellation detection
        activity.RecordHeartbeat(ctx, fmt.Sprintf("chunk %d/%d", i+1, len(input.Chunks)))

        // Check for cancellation
        if ctx.Err() != nil {
            return ctx.Err()
        }
    }
    return nil
}
```

**Heartbeat rules:**
- Set `HeartbeatTimeout` in activity options (e.g., 30s)
- Call `RecordHeartbeat` at regular intervals
- Temporal detects worker crash if heartbeat stops

### Error classification

```go
// Non-retryable business error — skip retry
return temporal.NewNonRetryableApplicationError(
    "order already cancelled",
    "ORDER_CANCELLED",
    nil,
)

// Retryable transient error — retry policy applies
return fmt.Errorf("db connection timeout: %w", err)
```

| Error type | Retryable | Use case |
|-----------|-----------|----------|
| `fmt.Errorf(...)` | Yes (default) | Transient failures (network, DB timeout) |
| `NewApplicationError` | Yes | Business errors that may resolve |
| `NewNonRetryableApplicationError` | No | Permanent failures (validation, not found) |

---

## §5 Retry & Timeout Configuration

### Activity-level options

```go
actOpts := workflow.ActivityOptions{
    // How long the activity can run
    StartToCloseTimeout: 30 * time.Second,

    // How long to wait for scheduling
    ScheduleToStartTimeout: 10 * time.Second,

    // Heartbeat timeout (for long activities)
    HeartbeatTimeout: 10 * time.Second,

    RetryPolicy: &temporal.RetryPolicy{
        InitialInterval:        time.Second,
        BackoffCoefficient:     2.0,
        MaximumInterval:        30 * time.Second,
        MaximumAttempts:        3,
        NonRetryableErrorTypes: []string{"VALIDATION_ERROR", "NOT_FOUND"},
    },
}
```

### Per-activity timeout overrides

```go
// Short timeout for validation
validateCtx := workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
    StartToCloseTimeout: 5 * time.Second,
    RetryPolicy:         &temporal.RetryPolicy{MaximumAttempts: 1},
})

// Long timeout for payment processing
paymentCtx := workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
    StartToCloseTimeout: 60 * time.Second,
    RetryPolicy: &temporal.RetryPolicy{
        MaximumAttempts: 5,
        InitialInterval: 2 * time.Second,
    },
})
```

---

## §6 Workflow Client Usage

### Starting a workflow

```go
func (s *OrderService) StartOrder(ctx context.Context, input model.OrderInput) (string, error) {
    opts := client.StartWorkflowOptions{
        ID:        "order-" + input.OrderID,
        TaskQueue: worker.TaskQueue,
        // Workflow-level timeout
        WorkflowExecutionTimeout: 24 * time.Hour,
    }

    run, err := s.temporalClient.ExecuteWorkflow(ctx, opts, workflow.OrderProcessingWorkflow, input)
    if err != nil {
        return "", fmt.Errorf("start workflow: %w", err)
    }

    return run.GetRunID(), nil
}
```

### Querying workflow status

```go
func (s *OrderService) GetOrderStatus(ctx context.Context, orderID string) (string, error) {
    resp, err := s.temporalClient.QueryWorkflow(ctx, "order-"+orderID, "", QueryStatus)
    if err != nil {
        return "", fmt.Errorf("query workflow: %w", err)
    }

    var status string
    if err := resp.Get(&status); err != nil {
        return "", err
    }
    return status, nil
}
```

### Sending signals

```go
func (s *OrderService) ApproveOrder(ctx context.Context, orderID string, decision model.ApprovalDecision) error {
    return s.temporalClient.SignalWorkflow(ctx, "order-"+orderID, "", SignalApproval, decision)
}
```

---

## §7 Configuration

```go
type Config struct {
    Env      string         `env:"APP_ENV" envDefault:"development"`
    Temporal TemporalConfig
    Database DatabaseConfig
}

type TemporalConfig struct {
    HostPort  string `env:"TEMPORAL_HOST" envDefault:"localhost:7233"`
    Namespace string `env:"TEMPORAL_NAMESPACE" envDefault:"default"`
}

func Load() *Config {
    cfg := &Config{}
    if err := env.Parse(cfg); err != nil {
        log.Fatalf("config: %v", err)
    }
    return cfg
}
```
