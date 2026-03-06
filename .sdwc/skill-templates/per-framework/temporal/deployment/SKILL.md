# Deployment — Temporal ({{ name }})

> Service: {{ name }} | Target: {{ deployment.target }}
> Registry: {{ deployment.container_registry }} | Secrets: {{ deployment.secrets_management }}

---

## §1 Build

### Multi-stage Dockerfile

```dockerfile
# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" \
    -o /app/worker ./cmd/worker

# Runtime stage
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata
RUN adduser -D -u 1000 appuser

COPY --from=builder /app/worker /usr/local/bin/worker

USER appuser

ENTRYPOINT ["worker"]
```

**Key points:**
- Static binary — no runtime dependencies
- No exposed ports — worker pulls tasks from Temporal server
- Minimal image — worker only needs CA certs for TLS

### Makefile

```makefile
APP_NAME := {{ name }}
VERSION  := $(shell git describe --tags --always --dirty)

.PHONY: build test lint docker

build:
	go build -ldflags="-X main.version=$(VERSION)" -o bin/$(APP_NAME) ./cmd/worker

test:
	go test ./internal/... -v -race -count=1

lint:
	golangci-lint run ./...

docker:
	docker build -t $(APP_NAME):$(VERSION) .
```

---

## §2 Environment Configuration

### Required environment variables

```bash
# Application
APP_ENV=production

# Temporal
TEMPORAL_HOST=temporal:7233        # Temporal server address
TEMPORAL_NAMESPACE=production      # Temporal namespace

# Database (if activities need DB)
DB_HOST=db
DB_PORT=5432
DB_NAME={{ name }}
DB_USER=app
DB_PASSWORD=<secret>
DB_SSL_MODE=require

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### Environment differences

| Variable | Development | Staging | Production |
|----------|------------|---------|------------|
| `TEMPORAL_HOST` | localhost:7233 | temporal-staging:7233 | temporal:7233 |
| `TEMPORAL_NAMESPACE` | default | staging | production |
| `DB_SSL_MODE` | disable | require | require |
| `LOG_LEVEL` | debug | info | info |

---

## §3 Deployment Target

{% if deployment.target == "docker_compose" %}
### Docker Compose

```yaml
services:
  {{ name }}:
    build: .
    environment:
      - APP_ENV=development
      - TEMPORAL_HOST=temporal:7233
      - TEMPORAL_NAMESPACE=default
      - DB_HOST=db
      - DB_PORT=5432
      - DB_NAME={{ name }}
      - DB_USER=app
      - DB_PASSWORD=secret
    depends_on:
      temporal:
        condition: service_started
      db:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      replicas: 1

  temporal:
    image: temporalio/auto-setup:1.24
    ports:
      - "7233:7233"
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=temporal
      - POSTGRES_PWD=temporal
      - POSTGRES_SEEDS=temporal-db
    depends_on:
      temporal-db:
        condition: service_healthy

  temporal-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: temporal
      POSTGRES_PASSWORD: temporal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U temporal"]
      interval: 5s
      timeout: 3s
      retries: 5

  temporal-ui:
    image: temporalio/ui:2.26
    ports:
      - "8080:8080"
    environment:
      - TEMPORAL_ADDRESS=temporal:7233

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: {{ name }}
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  temporal-db-data:
  app-db-data:
```
{% endif %}
{% if deployment.target == "kubernetes" %}
### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ name }}
spec:
  replicas: 2
  selector:
    matchLabels:
      app: {{ name }}
  template:
    metadata:
      labels:
        app: {{ name }}
    spec:
      containers:
        - name: {{ name }}
          image: {{ name }}:latest
          envFrom:
            - secretRef:
                name: {{ name }}-secrets
            - configMapRef:
                name: {{ name }}-config
          resources:
            requests:
              memory: "64Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
```

**Notes:**
- No ports exposed — worker is a pull-based consumer
- No readiness/liveness HTTP probes — use Temporal's built-in worker health
- Scale replicas based on task queue backlog
- Workers are stateless — safe to scale horizontally
{% endif %}

---

## §4 Temporal Server Requirements

### Development

Use Temporal CLI for local development:

```bash
# Install Temporal CLI
curl -sSf https://temporal.download/cli.sh | sh

# Start dev server (ephemeral, in-memory)
temporal server start-dev --namespace default

# UI available at http://localhost:8233
```

### Production

Temporal server is a separate infrastructure component. Options:
- **Temporal Cloud** — managed service (recommended for production)
- **Self-hosted** — requires PostgreSQL/MySQL + Elasticsearch

The worker connects to Temporal server via `TEMPORAL_HOST` — no server management in worker code.

---

## §5 Scaling Strategy

### Worker scaling

```
Task queue backlog → Scale worker replicas
```

- Workers are **stateless** — scale by adding replicas
- Each worker polls the task queue independently
- Temporal distributes tasks automatically

**Concurrency tuning (per worker instance):**

```go
temporalworker.Options{
    MaxConcurrentActivityExecutionSize:     10,  // parallel activities
    MaxConcurrentWorkflowTaskExecutionSize: 5,   // parallel workflow tasks
    MaxConcurrentLocalActivityExecutionSize: 5,
}
```

**Guidelines:**
- CPU-bound activities → match to CPU cores
- I/O-bound activities → higher concurrency (10-50)
- Workflow tasks are lightweight → 5-10 is usually sufficient

### Monitoring queue depth

```bash
# Check task queue backlog
temporal task-queue describe --task-queue {{ name }}-queue
```

Scale up workers when backlog grows consistently.

---

## §6 CI/CD Pipeline

{% if deployment.ci %}
### {{ deployment.ci.tool }}

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Lint
        uses: golangci/golangci-lint-action@v4

      - name: Test
        run: go test ./internal/... -v -race -coverprofile=coverage.out

      - name: Build
        run: go build -o bin/worker ./cmd/worker
```
{% endif %}

{% if deployment.cd %}
**CD Tool: {{ deployment.cd.tool }}**
{% if deployment.cd.strategy %}
**Strategy: {{ deployment.cd.strategy }}**
{% endif %}
{% endif %}

---

## §7 Graceful Shutdown

Temporal SDK handles graceful shutdown natively:

1. Worker receives SIGTERM
2. Stops polling for new tasks
3. Waits for in-progress activities to complete (respects `GracefulStopTimeout`)
4. Workflow tasks are automatically rescheduled to other workers

```go
w := temporalworker.New(c, TaskQueue, temporalworker.Options{
    // Time to wait for in-progress activities before force shutdown
    // Default: 0 (wait indefinitely)
})

// This blocks until shutdown signal
if err := w.Run(temporalworker.InterruptCh()); err != nil {
    logger.Fatal("worker stopped", zap.Error(err))
}
```

**Kubernetes:** `terminationGracePeriodSeconds` should be > longest activity timeout.

**Docker Compose:** `stop_grace_period` should match.

**Key insight:** Temporal workflows survive worker restarts. A workflow in progress will resume on any available worker after the current one shuts down.
