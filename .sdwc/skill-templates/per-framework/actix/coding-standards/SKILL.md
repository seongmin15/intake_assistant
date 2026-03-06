# Coding Standards — Actix Web ({{ name }})

> Service: {{ name }} | Framework: Actix Web | Language: Rust
> Build: {{ build_tool }}

---

## §1 Project Structure

```
{{ name }}/
├── src/
│   ├── main.rs                  ← entry point + server bootstrap
│   ├── config.rs                ← configuration
│   ├── routes/                  ← route definitions + handlers
│   │   ├── mod.rs
│   │   └── {{ name }}.rs
│   ├── services/                ← business logic
│   │   ├── mod.rs
│   │   └── {{ name }}_service.rs
│   ├── repositories/            ← data access
│   │   ├── mod.rs
│   │   └── {{ name }}_repo.rs
│   ├── models/                  ← domain types + DB models
│   │   ├── mod.rs
│   │   └── {{ name }}.rs
│   ├── dto/                     ← request/response types
│   │   ├── mod.rs
│   │   └── {{ name }}_dto.rs
│   ├── errors/                  ← error types + ResponseError impl
│   │   └── mod.rs
│   └── middleware/               ← custom middleware
│       └── mod.rs
├── migrations/
├── tests/                       ← integration tests
│   └── api_test.rs
├── Cargo.toml
├── Cargo.lock
├── .rustfmt.toml
└── clippy.toml
```

**Rules:**
- `src/` for all application code — Rust convention
- One module file per domain resource
- `tests/` for integration tests (separate binary)
- `mod.rs` re-exports public items for each module

---

## §2 Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Crate | snake_case | `my_api` |
| Module | snake_case | `user_service`, `auth_middleware` |
| Struct | PascalCase | `UserService`, `CreateUserRequest` |
| Enum | PascalCase + PascalCase variants | `AppError::NotFound` |
| Function | snake_case | `find_by_id`, `create_user` |
| Constant | SCREAMING_SNAKE_CASE | `MAX_PAGE_SIZE`, `DEFAULT_TIMEOUT` |
| Trait | PascalCase, `-able`/`-er` when fitting | `Repository`, `Cacheable` |
| Type alias | PascalCase | `AppResult<T> = Result<T, AppError>` |
| Lifetime | short, lowercase | `'a`, `'ctx` |

**Acronyms:** follow Rust convention — `HttpClient`, `ApiUrl` (not `HTTPClient`).

---

## §3 Ownership & Type System

**Borrowing rules:**
- Prefer `&T` (borrow) over cloning — especially for request handlers
- Use `&str` in function parameters when possible, `String` for owned fields
- Clone only when ownership transfer is required

**Shared state:**
- `Arc<T>` for immutable shared state across handlers (config, DB pool)
- `Arc<Mutex<T>>` or `Arc<RwLock<T>>` only when mutable shared state is unavoidable
- Actix `web::Data<T>` wraps `Arc` automatically

**Error types:**
- `thiserror` for defining error enums (library-style, structured)
- `anyhow` for ad-hoc error propagation in scripts/tests
- In application code, prefer `thiserror` with explicit variants

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("not found: {0}")]
    NotFound(String),

    #[error("validation error: {0}")]
    Validation(String),

    #[error("unauthorized")]
    Unauthorized,

    #[error(transparent)]
    Internal(#[from] anyhow::Error),
}
```

**Generics:** use for utility functions and trait bounds. Avoid overly complex trait bounds in domain code — prefer concrete types.

---

## §4 Import Order

```rust
// 1. Standard library
use std::sync::Arc;
use std::time::Duration;

// 2. Third-party crates
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

// 3. Internal modules
use crate::config::Config;
use crate::errors::AppError;
use crate::services::UserService;
```

Three groups separated by blank lines. `rustfmt` can enforce grouping with `group_imports = "StdExternalCrate"` (nightly).

---

## §5 Actix-Specific Patterns

### App state injection

```rust
// Shared state via web::Data (Arc-wrapped automatically)
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
}

// In main.rs
let state = web::Data::new(AppState { db: pool, config });

HttpServer::new(move || {
    App::new()
        .app_data(state.clone())
        .configure(routes::configure)
})
```

### Handler signatures

```rust
// Extractors as function parameters — Actix injects automatically
pub async fn create_user(
    state: web::Data<AppState>,
    body: web::Json<CreateUserRequest>,
) -> Result<HttpResponse, AppError> {
    let user = UserService::create(&state.db, body.into_inner()).await?;
    Ok(HttpResponse::Created().json(UserResponse::from(user)))
}
```

**Rules:**
- Handlers are `async fn` returning `Result<HttpResponse, AppError>`
- Use extractors (`web::Data`, `web::Json`, `web::Path`, `web::Query`)
- Never use `.unwrap()` in handlers — always propagate errors with `?`

---

## §6 Linting & Formatting

| Tool | Purpose | Config |
|------|---------|--------|
| `rustfmt` | Formatting | `.rustfmt.toml` |
| `clippy` | Linting | `clippy.toml` or `Cargo.toml [lints]` |
| `cargo check` | Type checking (fast) | — |
| `cargo audit` | Dependency vulnerabilities | — |

**rustfmt.toml:**
```toml
edition = "2021"
max_width = 100
use_field_init_shorthand = true
```

**Clippy in Cargo.toml:**
```toml
[lints.clippy]
unwrap_used = "deny"
expect_used = "warn"
pedantic = { level = "warn", priority = -1 }
```

```bash
cargo fmt --check          # CI format check
cargo clippy -- -D warnings   # CI lint (deny warnings)
```

---

## §7 Anti-patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| `.unwrap()` in handlers/services | Use `?` operator with proper error types |
| `.clone()` on large structs | Borrow with `&T` or use `Arc<T>` |
| `Box<dyn Trait>` in hot paths | Use enum dispatch or generics |
| Global mutable state | `web::Data<AppState>` with `Arc` |
| Blocking I/O in async handlers | Use `web::block()` for CPU-bound work |
| String concatenation for SQL | `sqlx::query!` with compile-time checked queries |
| Ignoring `Result` with `let _ =` | Handle or log errors explicitly |
| Over-generic function signatures | Concrete types in domain, generics in utilities |
| `unsafe` without documentation | Comment every `unsafe` block with safety invariant |
