# Testing — Temporal ({{ name }})

> Service: {{ name }} | Framework: Temporal | Test: go test + Temporal test framework
> Coverage mode: {{ test_case_coverage }}

---

## §1 Test Organization

```
internal/
├── workflow/
│   ├── order_workflow.go
│   └── order_workflow_test.go     ← workflow replay tests
├── activity/
│   ├── order_activity.go
│   └── order_activity_test.go     ← unit tests with mocks
├── worker/
│   └── worker_test.go
└── integration_test/
    └── workflow_integration_test.go  ← end-to-end with test server
```

**Rules:**
- Workflow tests use Temporal's test environment (replay-safe)
- Activity tests are standard Go unit tests
- Integration tests use `testsuite.WorkflowTestSuite` or real Temporal server
- Build tags for integration: `//go:build integration`

---

## §2 Test Case Coverage

{% if test_case_coverage == "basic" %}
**Level: basic** — Happy path only.

For each workflow/activity, write:
- 1 test for successful execution with valid input
{% endif %}
{% if test_case_coverage == "standard" %}
**Level: standard** — Happy path + edge cases + failure cases.

For each workflow/activity, write:
- Happy path: valid input → expected result
- Edge cases: empty input, boundary values, timeouts
- Failure cases: activity failures, retry exhaustion, workflow cancellation
{% endif %}
{% if test_case_coverage == "thorough" %}
**Level: thorough** — Happy path + edge cases + failure cases + security cases.

For each workflow/activity, write:
- Happy path: valid input → expected result
- Edge cases: empty input, boundary values, timeouts
- Failure cases: activity failures, retry exhaustion, workflow cancellation
- Security cases: unauthorized signals, payload validation, injection in activity inputs
{% endif %}

---

## §3 Workflow Testing

### Using Temporal test environment

```go
func TestOrderWorkflow_HappyPath(t *testing.T) {
    testSuite := &testsuite.WorkflowTestSuite{}
    env := testSuite.NewTestWorkflowEnvironment()

    // Mock activities
    env.OnActivity((*OrderActivities).ValidateOrderActivity, mock.Anything, mock.Anything).
        Return(nil)
    env.OnActivity((*OrderActivities).ProcessPaymentActivity, mock.Anything, mock.Anything).
        Return(&model.PaymentResult{TransactionID: "tx-123"}, nil)
    env.OnActivity((*OrderActivities).SendConfirmationActivity, mock.Anything, mock.Anything).
        Return(nil)

    // Execute workflow
    env.ExecuteWorkflow(OrderProcessingWorkflow, model.OrderInput{
        OrderID:    "order-1",
        CustomerID: "cust-1",
        Amount:     99.99,
    })

    assert.True(t, env.IsWorkflowCompleted())
    assert.NoError(t, env.GetWorkflowError())

    var result model.OrderResult
    assert.NoError(t, env.GetWorkflowResult(&result))
    assert.Equal(t, "completed", result.Status)
}
```

### Testing workflow with signals

```go
func TestOrderWorkflow_ApprovalSignal(t *testing.T) {
    env := (&testsuite.WorkflowTestSuite{}).NewTestWorkflowEnvironment()

    // Mock activities
    env.OnActivity((*OrderActivities).ValidateOrderActivity, mock.Anything, mock.Anything).
        Return(nil)

    // Register delayed signal callback
    env.RegisterDelayedCallback(func() {
        env.SignalWorkflow(SignalApproval, model.ApprovalDecision{
            Approved:   true,
            ApproverID: "admin-1",
        })
    }, 5*time.Second)

    env.OnActivity((*OrderActivities).ProcessPaymentActivity, mock.Anything, mock.Anything).
        Return(&model.PaymentResult{}, nil)

    env.ExecuteWorkflow(OrderProcessingWorkflow, model.OrderInput{OrderID: "order-1"})

    assert.True(t, env.IsWorkflowCompleted())
    assert.NoError(t, env.GetWorkflowError())
}
```

### Testing workflow with timer

```go
func TestOrderWorkflow_Timeout(t *testing.T) {
    env := (&testsuite.WorkflowTestSuite{}).NewTestWorkflowEnvironment()

    env.OnActivity((*OrderActivities).ValidateOrderActivity, mock.Anything, mock.Anything).
        Return(nil)

    // Don't send signal — let timer expire
    env.ExecuteWorkflow(OrderProcessingWorkflow, model.OrderInput{OrderID: "order-1"})

    assert.True(t, env.IsWorkflowCompleted())

    var result model.OrderResult
    env.GetWorkflowResult(&result)
    assert.Equal(t, "timed_out", result.Status)
}
```

**Rules:**
- Temporal test env automatically advances timers — no real waiting
- Mock ALL activities in workflow tests — workflows must be pure
- Test signals, timers, and cancellation as separate test cases

---

## §4 Activity Testing

Activities are standard Go functions — test like any other code:

```go
func TestValidateOrderActivity(t *testing.T) {
    tests := []struct {
        name    string
        input   model.OrderInput
        setup   func(*sql.DB)
        wantErr bool
    }{
        {
            name:  "valid order",
            input: model.OrderInput{OrderID: "order-1", Amount: 50.00},
            setup: func(db *sql.DB) {
                db.Exec("INSERT INTO orders (id, amount) VALUES ($1, $2)", "order-1", 50.00)
            },
            wantErr: false,
        },
        {
            name:  "negative amount",
            input: model.OrderInput{OrderID: "order-2", Amount: -10.00},
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            db := setupTestDB(t)
            if tt.setup != nil {
                tt.setup(db)
            }

            acts := NewOrderActivities(db, nil, zap.NewNop())
            err := acts.ValidateOrderActivity(context.Background(), tt.input)

            if tt.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

**Rules:**
- Activity tests do NOT use Temporal test environment
- Use real or in-memory DB for data access activities
- Mock external HTTP services with `httptest.Server`

---

## §5 Integration Testing

```go
//go:build integration

func TestOrderWorkflow_Integration(t *testing.T) {
    // Connect to real Temporal server (dev server or testcontainers)
    c, err := client.Dial(client.Options{
        HostPort: "localhost:7233",
    })
    require.NoError(t, err)
    defer c.Close()

    // Start workflow
    run, err := c.ExecuteWorkflow(context.Background(),
        client.StartWorkflowOptions{
            ID:        "test-order-" + uuid.NewString(),
            TaskQueue: TaskQueue,
        },
        OrderProcessingWorkflow,
        model.OrderInput{OrderID: "int-test-1", Amount: 25.00},
    )
    require.NoError(t, err)

    // Wait for result
    var result model.OrderResult
    err = run.Get(context.Background(), &result)
    assert.NoError(t, err)
    assert.Equal(t, "completed", result.Status)
}
```

{% if test_case_coverage == "thorough" %}

---

## §6 Security Testing

```go
func TestWorkflow_InvalidPayload(t *testing.T) {
    env := (&testsuite.WorkflowTestSuite{}).NewTestWorkflowEnvironment()

    // Test with malicious input
    env.ExecuteWorkflow(OrderProcessingWorkflow, model.OrderInput{
        OrderID:    "'; DROP TABLE orders; --",
        CustomerID: "<script>alert('xss')</script>",
        Amount:     -999999,
    })

    assert.True(t, env.IsWorkflowCompleted())
    // Should fail gracefully, not panic
    assert.Error(t, env.GetWorkflowError())
}

func TestSignal_UnauthorizedApproval(t *testing.T) {
    env := (&testsuite.WorkflowTestSuite{}).NewTestWorkflowEnvironment()

    env.OnActivity((*OrderActivities).ValidateOrderActivity, mock.Anything, mock.Anything).
        Return(nil)

    env.RegisterDelayedCallback(func() {
        env.SignalWorkflow(SignalApproval, model.ApprovalDecision{
            Approved:   true,
            ApproverID: "", // empty approver
        })
    }, 1*time.Second)

    env.ExecuteWorkflow(OrderProcessingWorkflow, model.OrderInput{OrderID: "order-1"})

    // Should reject empty approver
    assert.Error(t, env.GetWorkflowError())
}
```
{% endif %}

---

## §7 Test Commands

```makefile
# Unit tests (workflow + activity)
test:
	go test ./internal/... -v -race -count=1

# Coverage
test-cover:
	go test ./internal/... -coverprofile=coverage.out -covermode=atomic
	go tool cover -html=coverage.out -o coverage.html

# Integration (requires running Temporal server)
test-integration:
	go test ./internal/integration_test/... -tags=integration -v -timeout=120s

# Generate mocks
generate:
	go generate ./...
```

**Flags:**
- `-race`: detect data races
- `-count=1`: disable test caching
- `-timeout=120s`: longer timeout for integration tests (workflow execution time)
