# Deployment — Actix Web ({{ name }})

> Service: {{ name }} | Target: {{ deployment.target }}
> Registry: {{ deployment.container_registry }} | Secrets: {{ deployment.secrets_management }}

---

## §1 Build

### Multi-stage Dockerfile

```dockerfile
# Build stage — use full Rust image for compilation
FROM rust:1.77-bookworm AS builder

WORKDIR /app

# Cache dependencies — copy manifests first
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src

# Build actual application
COPY . .
RUN touch src/main.rs  # force recompile of src
RUN cargo build --release

# Runtime stage — minimal image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 appuser

COPY --from=builder /app/target/release/{{ name }} /usr/local/bin/server
COPY --from=builder /app/migrations /app/migrations

USER appuser
EXPOSE 8080

ENTRYPOINT ["server"]
```

**Key points:**
- Dependency caching trick: dummy `main.rs` → `cargo build` → then copy real source
- `bookworm-slim` runtime (not Alpine) — Rust binaries often need glibc
- `libssl3` for TLS connections (DB, external APIs)
- Build time ~3-5min for first build, ~30s for cached rebuilds

### Cargo build optimization

```toml
# Cargo.toml
[profile.release]
opt-level = 3
lto = "thin"          # link-time optimization (smaller binary)
strip = true          # strip debug symbols
codegen-units = 1     # slower build, better optimization
```

### Build commands

```bash
# Local build
cargo build --release

# Docker build
docker build -t {{ name }}:latest .

# Cross-compile (if needed)
cargo install cross
cross build --target x86_64-unknown-linux-musl --release
```

---

## §2 Environment Configuration

### Required environment variables

```bash
# Application
APP_ENV=production
PORT=8080

# Database
DATABASE_URL=postgres://app:secret@db:5432/{{ name }}?sslmode=require
DB_MAX_CONNECTIONS=25

# Auth
JWT_SECRET=<secret>

# Logging
LOG_LEVEL=info
RUST_LOG=info,actix_web=warn,sqlx=warn

# CORS
CORS_ORIGIN=https://example.com
```

### Environment differences

| Variable | Development | Staging | Production |
|----------|------------|---------|------------|
| `APP_ENV` | development | staging | production |
| `DATABASE_URL` sslmode | disable | require | require |
| `LOG_LEVEL` | debug | info | info |
| `RUST_LOG` | debug | info | info,actix_web=warn |
| `CORS_ORIGIN` | http://localhost:3000 | https://staging.example.com | https://example.com |

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
      - PORT=8080
      - DATABASE_URL=postgres://app:secret@db:5432/{{ name }}
      - DB_MAX_CONNECTIONS=10
      - LOG_LEVEL=debug
      - RUST_LOG=debug
      - CORS_ORIGIN=http://localhost:3000
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
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
            initialDelaySeconds: 3
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 20
          resources:
            requests:
              memory: "32Mi"
              cpu: "50m"
            limits:
              memory: "128Mi"
              cpu: "500m"
```

**Notes:**
- Rust binaries have very low memory footprint — 32Mi request is realistic
- Fast startup (<500ms) — low `initialDelaySeconds`
- Actix is multi-threaded by default — CPU limits matter more than memory
{% endif %}

---

## §4 Database Migrations

### Using sqlx-cli

```bash
# Install
cargo install sqlx-cli --features postgres

# Create migration
sqlx migrate add create_users

# Run migrations
sqlx migrate run --database-url "$DATABASE_URL"

# Revert last migration
sqlx migrate revert --database-url "$DATABASE_URL"

# Check migration status
sqlx migrate info --database-url "$DATABASE_URL"
```

**Migration file structure:**
```
migrations/
├── 20240101000000_create_users.sql
├── 20240102000000_add_user_roles.sql
└── 20240103000000_create_posts.sql
```

**Rules:**
- Migrations run automatically in `main.rs` via `sqlx::migrate!`
- Use reversible migrations where possible
- Never modify a deployed migration — always add a new one

### Compile-time query checking

```bash
# Prepare offline query cache (for CI without DB)
cargo sqlx prepare --database-url "$DATABASE_URL"

# Check queries against cached schema
cargo sqlx prepare --check
```

This generates `.sqlx/` directory with query metadata for offline compilation.

---

## §5 Health Check

Built into the bootstrap (see framework/SKILL.md §1):

```rust
async fn health_check(state: web::Data<AppState>) -> HttpResponse {
    match sqlx::query("SELECT 1").execute(&state.db).await {
        Ok(_) => HttpResponse::Ok().json(json!({"status": "ok"})),
        Err(_) => HttpResponse::ServiceUnavailable()
            .json(json!({"status": "unhealthy", "db": "disconnected"})),
    }
}
```

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

env:
  CARGO_TERM_COLOR: always

jobs:
  check:
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
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy

      - uses: Swatinem/rust-cache@v2

      - name: Format check
        run: cargo fmt --check

      - name: Clippy
        run: cargo clippy -- -D warnings

      - name: Run migrations
        run: cargo sqlx migrate run
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test

      - name: Test
        run: cargo test
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test

      - name: Build
        run: cargo build --release
```

**Caching:**
- `Swatinem/rust-cache@v2` caches `target/` directory — critical for Rust CI speed
- First CI run ~5min, cached runs ~1-2min
{% endif %}

{% if deployment.cd %}
**CD Tool: {{ deployment.cd.tool }}**
{% if deployment.cd.strategy %}
**Strategy: {{ deployment.cd.strategy }}**
{% endif %}
{% endif %}

---

## §7 Graceful Shutdown

Actix Web handles graceful shutdown natively:

```rust
HttpServer::new(|| { ... })
    .shutdown_timeout(30)    // seconds to wait for in-flight requests
    .bind("0.0.0.0:8080")?
    .run()
    .await
```

1. Receive SIGTERM
2. Stop accepting new connections
3. Wait up to `shutdown_timeout` for in-flight requests
4. Force close remaining connections
5. Drop all resources (DB pool closes via Drop)

**Kubernetes:** set `terminationGracePeriodSeconds: 45` (> shutdown_timeout)
