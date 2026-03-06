# Deployment — Gin ({{ name }})

> Service: {{ name }} | Target: {{ deployment.target }}
> Registry: {{ deployment.container_registry }} | Secrets: {{ deployment.secrets_management }}

---

## §1 Build

### Multi-stage Dockerfile

```dockerfile
# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w -X main.version=${VERSION}" \
    -o /app/server ./cmd/server

# Runtime stage
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata
RUN adduser -D -u 1000 appuser

COPY --from=builder /app/server /usr/local/bin/server
COPY --from=builder /app/migrations /app/migrations

USER appuser
EXPOSE 8080

ENTRYPOINT ["server"]
```

**Key points:**
- `CGO_ENABLED=0` — static binary, no libc dependency
- `-ldflags="-s -w"` — strip debug info, reduce binary size (~30%)
- Alpine runtime image — minimal attack surface (~5MB base)
- Non-root user — security best practice

### Makefile

```makefile
APP_NAME := {{ name }}
VERSION  := $(shell git describe --tags --always --dirty)

.PHONY: build run test lint docker

build:
	go build -ldflags="-X main.version=$(VERSION)" -o bin/$(APP_NAME) ./cmd/server

run:
	go run ./cmd/server

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
APP_ENV=production          # development | staging | production
PORT=8080

# Database
DB_HOST=db
DB_PORT=5432
DB_NAME={{ name }}
DB_USER=app
DB_PASSWORD=<secret>
DB_SSL_MODE=require         # disable for dev, require for prod

# Logging
LOG_LEVEL=info              # debug | info | warn | error
LOG_FORMAT=json             # json | console
```

### Environment differences

| Variable | Development | Staging | Production |
|----------|------------|---------|------------|
| `APP_ENV` | development | staging | production |
| `DB_SSL_MODE` | disable | require | require |
| `LOG_LEVEL` | debug | info | info |
| `LOG_FORMAT` | console | json | json |

---

## §3 Deployment Target

{% if deployment.target == "docker_compose" %}
### Docker Compose

```yaml
services:
  {{ name }}:
    build: .
    ports:
      - "8080:8080"
    environment:
      - APP_ENV=development
      - DB_HOST=db
      - DB_PORT=5432
      - DB_NAME={{ name }}
      - DB_USER=app
      - DB_PASSWORD=secret
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: {{ name }}
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
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
          ports:
            - containerPort: 8080
          envFrom:
            - secretRef:
                name: {{ name }}-secrets
            - configMapRef:
                name: {{ name }}-config
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20
          resources:
            requests:
              memory: "64Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
```

**Notes:**
- Go binaries have low memory footprint — start with 64Mi request
- CPU is the main resource — set limits based on load testing
- Fast startup (<1s) — `initialDelaySeconds` can be low
{% endif %}

---

## §4 Database Migrations

### Using golang-migrate

```bash
# Install
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Create migration
migrate create -ext sql -dir migrations -seq create_users

# Run migrations
migrate -path migrations -database "${DB_DSN}" up

# Rollback last migration
migrate -path migrations -database "${DB_DSN}" down 1
```

**Migration file naming:**
```
migrations/
├── 000001_create_users.up.sql
├── 000001_create_users.down.sql
├── 000002_add_user_roles.up.sql
└── 000002_add_user_roles.down.sql
```

**Rules:**
- Every `up` migration must have a corresponding `down`
- Migrations run automatically on deploy (before app starts)
- Never modify an existing migration — always create a new one

---

## §5 Health Check

```go
func healthHandler(db *sql.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
        defer cancel()

        if err := db.PingContext(ctx); err != nil {
            c.JSON(http.StatusServiceUnavailable, gin.H{
                "status": "unhealthy",
                "db":     "disconnected",
            })
            return
        }

        c.JSON(http.StatusOK, gin.H{
            "status":  "ok",
            "version": version,
        })
    }
}
```

---

## §6 CI/CD Pipeline

{% if deployment.ci %}
### {{ deployment.ci.tool }}

```yaml
# .github/workflows/ci.yml (example for GitHub Actions)
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Lint
        uses: golangci/golangci-lint-action@v4

      - name: Test
        run: go test ./internal/... -v -race -coverprofile=coverage.out
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: test
          DB_USER: test
          DB_PASSWORD: test

      - name: Build
        run: go build -o bin/server ./cmd/server
{% endif %}

{% if deployment.cd %}
**CD Tool: {{ deployment.cd.tool }}**
{% if deployment.cd.strategy %}
**Strategy: {{ deployment.cd.strategy }}**
{% endif %}
{% endif %}

---

## §7 Graceful Shutdown

Built into the bootstrap (see framework/SKILL.md §1):

1. Receive SIGTERM/SIGINT
2. Stop accepting new connections
3. Wait for in-flight requests (30s timeout)
4. Close DB connections
5. Exit

**Kubernetes:** set `terminationGracePeriodSeconds: 45` (> shutdown timeout)

**Docker Compose:** `stop_grace_period: 45s`
