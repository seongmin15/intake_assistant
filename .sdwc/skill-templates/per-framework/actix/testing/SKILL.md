# Testing — Actix Web ({{ name }})

> Service: {{ name }} | Framework: Actix Web | Test: cargo test
> Coverage mode: {{ test_case_coverage }}

---

## §1 Test Organization

```
src/
├── services/
│   ├── user_service.rs
│   └── user_service.rs           ← #[cfg(test)] mod tests at bottom
├── repositories/
│   └── user_repo.rs              ← #[cfg(test)] mod tests at bottom
tests/                             ← integration tests (separate crate)
├── common/
│   └── mod.rs                    ← shared test helpers
├── api_test.rs                   ← HTTP integration tests
└── db_test.rs                    ← DB integration tests
```

**Rules:**
- Unit tests: `#[cfg(test)] mod tests` at bottom of each source file
- Integration tests: `tests/` directory (compiled as separate crate)
- Shared helpers: `tests/common/mod.rs`
- Use `#[tokio::test]` for async test functions

---

## §2 Test Case Coverage

{% if test_case_coverage == "basic" %}
**Level: basic** — Happy path only.

For each handler/service function, write:
- 1 test for successful operation with valid input
{% endif %}
{% if test_case_coverage == "standard" %}
**Level: standard** — Happy path + edge cases + failure cases.

For each handler/service function, write:
- Happy path: valid input → expected response
- Edge cases: empty strings, boundary values, optional fields missing
- Failure cases: not found, validation error, DB error
{% endif %}
{% if test_case_coverage == "thorough" %}
**Level: thorough** — Happy path + edge cases + failure cases + security cases.

For each handler/service function, write:
- Happy path: valid input → expected response
- Edge cases: empty strings, boundary values, optional fields missing
- Failure cases: not found, validation error, DB error
- Security cases: unauthorized access, injection attempts, oversized payloads
{% endif %}

---

## §3 Unit Testing Patterns

### Service tests with mock repository

```rust
// src/services/user_service.rs

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;

    // Define mock trait
    #[automock]
    #[async_trait]
    pub trait UserRepo {
        async fn find_by_id(&self, id: &str) -> Result<Option<User>, AppError>;
        async fn create(&self, user: &NewUser) -> Result<User, AppError>;
    }

    #[tokio::test]
    async fn test_create_user_success() {
        let mut mock_repo = MockUserRepo::new();
        mock_repo
            .expect_create()
            .with(always())
            .returning(|input| {
                Ok(User {
                    id: "user-1".into(),
                    name: input.name.clone(),
                    email: input.email.clone(),
                })
            });

        let svc = UserService::new(Box::new(mock_repo));
        let result = svc
            .create(NewUser {
                name: "Alice".into(),
                email: "alice@example.com".into(),
            })
            .await;

        assert!(result.is_ok());
        let user = result.unwrap();
        assert_eq!(user.name, "Alice");
    }

    #[tokio::test]
    async fn test_find_user_not_found() {
        let mut mock_repo = MockUserRepo::new();
        mock_repo
            .expect_find_by_id()
            .with(eq("nonexistent"))
            .returning(|_| Ok(None));

        let svc = UserService::new(Box::new(mock_repo));
        let result = svc.find_by_id("nonexistent").await;

        assert!(matches!(result, Err(AppError::NotFound(_))));
    }
}
```

### Using `mockall` for trait mocking

```toml
# Cargo.toml
[dev-dependencies]
mockall = "0.12"
tokio = { version = "1", features = ["test-util", "macros"] }
```

**Rules:**
- Define repository traits — enables mockall auto-mocking
- Use `#[automock]` attribute on traits
- Use `mockall::predicate::*` for argument matching

---

## §4 Handler (Integration) Testing

### Using actix_web::test

```rust
// tests/api_test.rs

use actix_web::{test, web, App};
use sqlx::PgPool;

mod common;

#[tokio::test]
async fn test_create_user_endpoint() {
    let pool = common::setup_test_db().await;
    let state = web::Data::new(AppState { db: pool.clone(), config: common::test_config() });

    let app = test::init_service(
        App::new()
            .app_data(state.clone())
            .configure(routes::configure),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/api/v1/users")
        .set_json(serde_json::json!({
            "name": "Alice",
            "email": "alice@example.com"
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);

    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["name"], "Alice");
}

#[tokio::test]
async fn test_get_user_not_found() {
    let pool = common::setup_test_db().await;
    let state = web::Data::new(AppState { db: pool.clone(), config: common::test_config() });

    let app = test::init_service(
        App::new()
            .app_data(state.clone())
            .configure(routes::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri("/api/v1/users/nonexistent-id")
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}
```

### Test helper module

```rust
// tests/common/mod.rs

use sqlx::PgPool;

pub async fn setup_test_db() -> PgPool {
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://test:test@localhost:5432/test".into());

    let pool = PgPool::connect(&database_url).await.expect("DB connection");
    sqlx::migrate!("./migrations").run(&pool).await.expect("migrations");
    pool
}

pub fn test_config() -> Config {
    Config {
        env: "test".into(),
        ..Default::default()
    }
}
```

**Rules:**
- Use `actix_web::test` — no real HTTP server needed
- `test::init_service` creates a testable app instance
- Run migrations in test setup — ensures schema consistency

---

## §5 Database Testing

### Using sqlx test transactions

```rust
#[tokio::test]
async fn test_user_repo_create() {
    let pool = common::setup_test_db().await;

    // Start transaction — auto-rollback on drop
    let mut tx = pool.begin().await.unwrap();

    let repo = UserRepo::new();
    let user = repo
        .create_with_tx(
            &mut tx,
            &NewUser {
                name: "Alice".into(),
                email: "alice@test.com".into(),
            },
        )
        .await
        .unwrap();

    assert_eq!(user.name, "Alice");

    // Transaction rolls back automatically — no test data pollution
}
```

{% if test_case_coverage == "thorough" %}

---

## §6 Security Testing

```rust
#[tokio::test]
async fn test_unauthorized_access() {
    let app = setup_test_app().await;

    let req = test::TestRequest::get()
        .uri("/api/v1/users/me")
        // No Authorization header
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn test_sql_injection_attempt() {
    let app = setup_test_app().await;

    let req = test::TestRequest::get()
        .uri("/api/v1/users/'; DROP TABLE users; --")
        .to_request();

    let resp = test::call_service(&app, req).await;
    // Should return 400 or 404, never 500
    assert_ne!(resp.status(), 500);
}

#[tokio::test]
async fn test_oversized_payload() {
    let app = setup_test_app().await;

    let large_body = "x".repeat(10_000_000); // 10MB
    let req = test::TestRequest::post()
        .uri("/api/v1/users")
        .set_payload(large_body)
        .insert_header(("Content-Type", "application/json"))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 413); // Payload Too Large
}
```
{% endif %}

---

## §7 Test Commands

```bash
# Unit tests
cargo test --lib

# Integration tests
cargo test --test '*'

# All tests with output
cargo test -- --nocapture

# Specific test
cargo test test_create_user

# Coverage (requires cargo-tarpaulin)
cargo tarpaulin --out Html --output-dir coverage/

# Watch mode (requires cargo-watch)
cargo watch -x test
```

**Cargo.toml test configuration:**
```toml
[dev-dependencies]
actix-web = { version = "4", features = ["test"] }
mockall = "0.12"
tokio = { version = "1", features = ["test-util", "macros", "rt-multi-thread"] }
serde_json = "1"
```
