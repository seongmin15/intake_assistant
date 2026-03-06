# Framework Patterns — Actix Web ({{ name }})

> Service: {{ name }} | Framework: Actix Web | Language: Rust
> API: {{ api_style }} | Auth: {{ auth.method }}

---

## §1 Application Bootstrap

### Server setup

```rust
// src/main.rs
use actix_web::{web, App, HttpServer, middleware as actix_mw};
use sqlx::postgres::PgPoolOptions;
use tracing_actix_web::TracingLogger;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize config
    let config = config::Config::from_env().expect("config load failed");

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(&config.log_level)
        .json()
        .init();

    // Database pool
    let pool = PgPoolOptions::new()
        .max_connections(config.db_max_connections)
        .connect(&config.database_url)
        .await
        .expect("DB connection failed");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migration failed");

    let state = web::Data::new(AppState {
        db: pool,
        config: config.clone(),
    });

    tracing::info!("starting server on {}", config.port);

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .app_data(web::JsonConfig::default()
                .limit(1_048_576)  // 1MB max JSON payload
                .error_handler(|err, _req| {
                    let detail = err.to_string();
                    actix_web::error::InternalError::from_response(
                        err,
                        HttpResponse::BadRequest().json(ErrorResponse::validation(&detail)),
                    ).into()
                }))
            .wrap(TracingLogger::default())
            .wrap(actix_mw::Compress::default())
            .wrap(middleware::cors(&config))
            .wrap(middleware::request_id())
            .configure(routes::configure)
            .route("/health", web::get().to(health_check))
    })
    .bind(format!("0.0.0.0:{}", config.port))?
    .run()
    .await
}

async fn health_check(state: web::Data<AppState>) -> HttpResponse {
    match sqlx::query("SELECT 1").execute(&state.db).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"status": "ok"})),
        Err(_) => HttpResponse::ServiceUnavailable()
            .json(serde_json::json!({"status": "unhealthy"})),
    }
}
```

### App state

```rust
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
}
```

---

## §2 Routing & Handler Organization

### Route configuration

```rust
// src/routes/mod.rs
pub mod users;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            .configure(users::configure),
    );
}

// src/routes/users.rs
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/users")
            .route("", web::post().to(create_user))
            .route("", web::get().to(list_users))
            .route("/{id}", web::get().to(get_user))
            .route("/{id}", web::put().to(update_user))
            .route("/{id}", web::delete().to(delete_user)),
    );
}
```

### Handler pattern

```rust
pub async fn create_user(
    state: web::Data<AppState>,
    body: web::Json<CreateUserRequest>,
) -> Result<HttpResponse, AppError> {
    // Validate
    body.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    // Business logic
    let user = UserService::create(&state.db, body.into_inner()).await?;

    // Response
    Ok(HttpResponse::Created().json(UserResponse::from(user)))
}

pub async fn get_user(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();
    let user = UserService::find_by_id(&state.db, &id).await?;
    Ok(HttpResponse::Ok().json(UserResponse::from(user)))
}
```

---

## §3 Request Validation

### Using validator crate

```rust
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateUserRequest {
    #[validate(length(min = 2, max = 100))]
    pub name: String,

    #[validate(email)]
    pub email: String,

    #[validate(range(min = 0, max = 150))]
    pub age: Option<i32>,
}
```

### Path parameter extraction

```rust
#[derive(Deserialize)]
pub struct UserPath {
    pub id: String,
}

pub async fn get_user(
    state: web::Data<AppState>,
    path: web::Path<UserPath>,
) -> Result<HttpResponse, AppError> {
    let user = UserService::find_by_id(&state.db, &path.id).await?;
    Ok(HttpResponse::Ok().json(UserResponse::from(user)))
}
```

{% if pagination == "cursor" %}

### Cursor pagination

```rust
#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    pub cursor: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 { 20 }
```
{% endif %}
{% if pagination == "offset" %}

### Offset pagination

```rust
#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_page_size")]
    pub page_size: i64,
}

fn default_page() -> i64 { 1 }
fn default_page_size() -> i64 { 20 }

impl PaginationQuery {
    pub fn offset(&self) -> i64 { (self.page - 1) * self.page_size }
}
```
{% endif %}

---

## §4 Error Handling

### Error type with ResponseError

```rust
use actix_web::{HttpResponse, ResponseError};
use std::fmt;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("not found: {0}")]
    NotFound(String),

    #[error("validation: {0}")]
    Validation(String),

    #[error("unauthorized")]
    Unauthorized,

    #[error("forbidden")]
    Forbidden,

    #[error("conflict: {0}")]
    Conflict(String),

    #[error(transparent)]
    Internal(#[from] anyhow::Error),

    #[error(transparent)]
    Database(#[from] sqlx::Error),
}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        let (status, code) = match self {
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "NOT_FOUND"),
            AppError::Validation(_) => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR"),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED"),
            AppError::Forbidden => (StatusCode::FORBIDDEN, "FORBIDDEN"),
            AppError::Conflict(_) => (StatusCode::CONFLICT, "CONFLICT"),
            AppError::Internal(_) | AppError::Database(_) => {
                tracing::error!("internal error: {:?}", self);
                (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR")
            }
        };

        HttpResponse::build(status).json(ErrorResponse {
            error: ErrorDetail {
                code: code.to_string(),
                message: self.safe_message(),
            },
        })
    }
}

impl AppError {
    /// Return message safe for client. Hide internal details.
    fn safe_message(&self) -> String {
        match self {
            AppError::Internal(_) | AppError::Database(_) => {
                "an unexpected error occurred".to_string()
            }
            other => other.to_string(),
        }
    }
}

#[derive(Serialize)]
struct ErrorResponse {
    error: ErrorDetail,
}

#[derive(Serialize)]
struct ErrorDetail {
    code: String,
    message: String,
}
```

**Rules:**
- Implement `ResponseError` — Actix converts errors to HTTP responses automatically
- Never expose internal/database error details to clients
- Log internal errors at error level before returning generic message
- Use `?` operator everywhere — errors propagate through the handler chain

### Converting sqlx errors

```rust
impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => AppError::NotFound("resource not found".into()),
            sqlx::Error::Database(ref e) if e.code() == Some("23505".into()) => {
                AppError::Conflict("resource already exists".into())
            }
            _ => AppError::Database(err),
        }
    }
}
```

---

## §5 Auth Pattern

{% if auth.method == "jwt" %}
### JWT Authentication

```rust
use actix_web::FromRequest;

pub struct AuthUser {
    pub user_id: String,
    pub role: String,
}

impl FromRequest for AuthUser {
    type Error = AppError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let result = extract_auth_user(req);
        ready(result)
    }
}

fn extract_auth_user(req: &HttpRequest) -> Result<AuthUser, AppError> {
    let header = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    let token = header
        .strip_prefix("Bearer ")
        .ok_or(AppError::Unauthorized)?;

    let state = req.app_data::<web::Data<AppState>>()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("missing app state")))?;

    let claims = validate_jwt(token, &state.config.jwt_secret)
        .map_err(|_| AppError::Unauthorized)?;

    Ok(AuthUser {
        user_id: claims.sub,
        role: claims.role,
    })
}

// Usage in handler — Actix extracts automatically
pub async fn get_me(
    auth: AuthUser,
    state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    let user = UserService::find_by_id(&state.db, &auth.user_id).await?;
    Ok(HttpResponse::Ok().json(UserResponse::from(user)))
}
```
{% endif %}
{% if auth.method == "session" %}
### Session Authentication

```rust
pub struct AuthUser {
    pub user_id: String,
}

impl FromRequest for AuthUser {
    type Error = AppError;
    type Future = Pin<Box<dyn Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let req = req.clone();
        Box::pin(async move {
            let session_id = req
                .cookie("session_id")
                .map(|c| c.value().to_string())
                .ok_or(AppError::Unauthorized)?;

            let state = req.app_data::<web::Data<AppState>>()
                .ok_or_else(|| AppError::Internal(anyhow::anyhow!("missing state")))?;

            let session = SessionStore::get(&state.db, &session_id)
                .await
                .map_err(|_| AppError::Unauthorized)?;

            Ok(AuthUser { user_id: session.user_id })
        })
    }
}
```
{% endif %}
{% if auth.method == "api_key" %}
### API Key Authentication

```rust
pub struct AuthClient {
    pub client_id: String,
}

impl FromRequest for AuthClient {
    type Error = AppError;
    type Future = Pin<Box<dyn Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let req = req.clone();
        Box::pin(async move {
            let api_key = req
                .headers()
                .get("X-API-Key")
                .and_then(|v| v.to_str().ok())
                .ok_or(AppError::Unauthorized)?;

            let state = req.app_data::<web::Data<AppState>>()
                .ok_or_else(|| AppError::Internal(anyhow::anyhow!("missing state")))?;

            let client = ApiKeyService::validate(&state.db, api_key)
                .await
                .map_err(|_| AppError::Unauthorized)?;

            Ok(AuthClient { client_id: client.id })
        })
    }
}
```
{% endif %}
{% if auth.method == "none" %}
### No Authentication

This service runs without authentication. Accepted risks: {{ auth.if_none_risks_accepted }}

Ensure network-level access control is in place.
{% endif %}

---

## §6 Database Access

{% for db in databases %}
{% if db.role == "primary" %}
### {{ db.engine }} with sqlx

```rust
// Compile-time checked queries
pub async fn find_by_id(pool: &PgPool, id: &str) -> Result<User, AppError> {
    sqlx::query_as!(
        User,
        "SELECT id, name, email, created_at FROM users WHERE id = $1",
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("user {id}")))
}

pub async fn create(pool: &PgPool, input: &NewUser) -> Result<User, AppError> {
    sqlx::query_as!(
        User,
        r#"INSERT INTO users (id, name, email)
           VALUES ($1, $2, $3)
           RETURNING id, name, email, created_at"#,
        Uuid::new_v4().to_string(),
        input.name,
        input.email,
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}
```

**Rules:**
- Use `sqlx::query_as!` — compile-time SQL validation
- Pass `&PgPool` to functions (not owned Pool)
- Use `fetch_optional` + `ok_or_else` for single-row queries
- `sqlx::Error` automatically converts to `AppError` via `From` impl
{% endif %}
{% if db.role == "cache" %}
### {{ db.engine }} — Cache

```rust
pub async fn get_cached(redis: &redis::Client, key: &str) -> Option<String> {
    let mut conn = redis.get_async_connection().await.ok()?;
    redis::cmd("GET").arg(key).query_async(&mut conn).await.ok()
}
```
{% endif %}
{% endfor %}

---

## §7 Middleware

### Request ID

```rust
pub fn request_id() -> actix_web::middleware::DefaultHeaders {
    // For production, use a proper middleware that generates UUIDs
    actix_web::middleware::DefaultHeaders::new()
        .add(("X-Request-ID", uuid::Uuid::new_v4().to_string()))
}
```

### CORS

```rust
use actix_cors::Cors;

pub fn cors(config: &Config) -> Cors {
    Cors::default()
        .allowed_origin(&config.cors_origin)
        .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
        .allowed_headers(vec!["Authorization", "Content-Type", "X-Request-ID"])
        .max_age(86400)
}
```

{% if rate_limiting.enabled %}
### Rate limiting

```rust
use actix_governor::{Governor, GovernorConfigBuilder};

pub fn rate_limiter() -> Governor<actix_governor::PeerIpKeyExtractor> {
    let config = GovernorConfigBuilder::default()
        .per_second(10)
        .burst_size(20)
        .finish()
        .unwrap();

    Governor::new(&config)
}
```
{% endif %}

---

## §8 Configuration

```rust
// src/config.rs
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    #[serde(default = "default_env")]
    pub env: String,

    #[serde(default = "default_port")]
    pub port: u16,

    pub database_url: String,

    #[serde(default = "default_max_conn")]
    pub db_max_connections: u32,

    pub log_level: String,

    pub cors_origin: String,

    #[serde(default)]
    pub jwt_secret: String,
}

fn default_env() -> String { "development".into() }
fn default_port() -> u16 { 8080 }
fn default_max_conn() -> u32 { 10 }

impl Config {
    pub fn from_env() -> Result<Self, envy::Error> {
        envy::from_env()
    }
}
```

**Rules:**
- All config from environment variables via `envy` crate
- Provide defaults for non-sensitive values
- No default for secrets (`database_url`, `jwt_secret`) — fail on missing
