# Framework Patterns — Gin ({{ name }})

> Service: {{ name }} | Framework: Gin | Language: Go
> API: {{ api_style }} | Auth: {{ auth.method }}

---

## §1 Application Bootstrap

### Server setup

```go
// cmd/server/main.go
func main() {
    cfg := config.Load()
    logger := initLogger(cfg.Env)
    defer logger.Sync()

    db := initDB(cfg.Database)
    defer db.Close()

    // Wire dependencies
    userRepo := repository.NewUserRepo(db)
    userSvc := service.NewUserService(userRepo, logger)
    h := handler.NewHandler(userSvc, logger)

    r := gin.New()
    r.Use(gin.Recovery())
    r.Use(requestIDMiddleware())
    r.Use(loggerMiddleware(logger))
    r.Use(corsMiddleware(cfg.CORS))

    api := r.Group("/api/v1")
    h.RegisterRoutes(api)

    // Health check
    r.GET("/health", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "ok"})
    })

    srv := &http.Server{
        Addr:         ":" + cfg.Port,
        Handler:      r,
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 15 * time.Second,
        IdleTimeout:  60 * time.Second,
    }

    // Graceful shutdown
    go func() {
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            logger.Fatal("server failed", zap.Error(err))
        }
    }()

    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    srv.Shutdown(ctx)
}
```

### Middleware logging

```go
func loggerMiddleware(logger *zap.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        path := c.Request.URL.Path

        c.Next()

        logger.Info("request",
            zap.String("method", c.Request.Method),
            zap.String("path", path),
            zap.Int("status", c.Writer.Status()),
            zap.Duration("latency", time.Since(start)),
            zap.String("request_id", c.GetString("request_id")),
        )
    }
}
```

---

## §2 Routing & Handler Organization

### Route registration pattern

```go
func (h *Handler) RegisterRoutes(api *gin.RouterGroup) {
    // Public routes
    api.POST("/auth/login", h.Login)

    // Protected routes
    authorized := api.Group("")
    authorized.Use(h.authMiddleware())
    {
        users := authorized.Group("/users")
        users.GET("", h.ListUsers)
        users.POST("", h.CreateUser)
        users.GET("/:id", h.GetUser)
        users.PUT("/:id", h.UpdateUser)
        users.DELETE("/:id", h.DeleteUser)
    }
}
```

**Rules:**
- Group routes by resource
- Apply auth middleware at group level, not per-route
- Use curly braces `{}` for visual grouping (Go convention, no semantic effect)

### Handler method pattern

```go
func (h *Handler) CreateUser(c *gin.Context) {
    ctx := c.Request.Context()

    // 1. Bind and validate input
    var req dto.CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        h.respondError(c, apperror.NewValidation(err.Error()))
        return
    }

    // 2. Call service
    user, err := h.userSvc.Create(ctx, req)
    if err != nil {
        h.respondError(c, err)
        return
    }

    // 3. Respond
    c.JSON(http.StatusCreated, dto.ToUserResponse(user))
}
```

---

## §3 Request Binding & Validation

### Binding with struct tags

```go
type CreateUserRequest struct {
    Name  string `json:"name" binding:"required,min=2,max=100"`
    Email string `json:"email" binding:"required,email"`
    Age   int    `json:"age" binding:"omitempty,gte=0,lte=150"`
}
```

**Binding methods:**
- `ShouldBindJSON` — JSON body (returns error, does NOT abort)
- `ShouldBindQuery` — query parameters
- `ShouldBindUri` — path parameters

**Rules:**
- Always use `ShouldBind*` (not `Bind*`) — lets you control error response
- Validate at the handler layer, never in service

### Path parameters

```go
type GetUserUri struct {
    ID string `uri:"id" binding:"required,uuid"`
}

func (h *Handler) GetUser(c *gin.Context) {
    var uri GetUserUri
    if err := c.ShouldBindUri(&uri); err != nil {
        h.respondError(c, apperror.NewValidation(err.Error()))
        return
    }
    // use uri.ID
}
```

{% if pagination == "cursor" %}

### Cursor pagination

```go
type PaginationQuery struct {
    Cursor string `form:"cursor"`
    Limit  int    `form:"limit" binding:"omitempty,min=1,max=100"`
}

func (q *PaginationQuery) GetLimit() int {
    if q.Limit == 0 {
        return 20 // default
    }
    return q.Limit
}
```
{% endif %}
{% if pagination == "offset" %}

### Offset pagination

```go
type PaginationQuery struct {
    Page     int `form:"page" binding:"omitempty,min=1"`
    PageSize int `form:"page_size" binding:"omitempty,min=1,max=100"`
}

func (q *PaginationQuery) GetOffset() int {
    page := q.Page
    if page == 0 {
        page = 1
    }
    return (page - 1) * q.GetPageSize()
}

func (q *PaginationQuery) GetPageSize() int {
    if q.PageSize == 0 {
        return 20
    }
    return q.PageSize
}
```
{% endif %}

---

## §4 Error Handling

### Application error types

```go
// pkg/apperror/errors.go
type AppError struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    Status  int    `json:"-"`
}

func (e *AppError) Error() string { return e.Message }

// Constructors
func NewNotFound(msg string) *AppError {
    return &AppError{Code: "NOT_FOUND", Message: msg, Status: http.StatusNotFound}
}

func NewValidation(msg string) *AppError {
    return &AppError{Code: "VALIDATION_ERROR", Message: msg, Status: http.StatusBadRequest}
}

func NewUnauthorized(msg string) *AppError {
    return &AppError{Code: "UNAUTHORIZED", Message: msg, Status: http.StatusUnauthorized}
}

func NewForbidden(msg string) *AppError {
    return &AppError{Code: "FORBIDDEN", Message: msg, Status: http.StatusForbidden}
}

func NewInternal(msg string) *AppError {
    return &AppError{Code: "INTERNAL_ERROR", Message: msg, Status: http.StatusInternalServerError}
}

// Sentinel errors
var (
    ErrNotFound  = NewNotFound("resource not found")
    ErrDuplicate = &AppError{Code: "DUPLICATE", Message: "resource already exists", Status: http.StatusConflict}
)
```

### Centralized error response

```go
func (h *Handler) respondError(c *gin.Context, err error) {
    var appErr *apperror.AppError
    if errors.As(err, &appErr) {
        c.JSON(appErr.Status, gin.H{
            "error": gin.H{
                "code":    appErr.Code,
                "message": appErr.Message,
            },
        })
        return
    }

    // Unknown error — log and return 500
    h.logger.Error("unhandled error",
        zap.Error(err),
        zap.String("path", c.Request.URL.Path),
    )
    c.JSON(http.StatusInternalServerError, gin.H{
        "error": gin.H{
            "code":    "INTERNAL_ERROR",
            "message": "an unexpected error occurred",
        },
    })
}
```

**Rules:**
- Never expose internal error details to clients
- Service layer returns `*AppError` or wraps with `fmt.Errorf`
- Handler converts errors to HTTP responses via `respondError`

---

## §5 Auth Pattern

{% if auth.method == "jwt" %}
### JWT Authentication

```go
func (h *Handler) authMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := extractBearerToken(c.GetHeader("Authorization"))
        if token == "" {
            h.respondError(c, apperror.NewUnauthorized("missing token"))
            c.Abort()
            return
        }

        claims, err := h.authSvc.ValidateToken(token)
        if err != nil {
            h.respondError(c, apperror.NewUnauthorized("invalid token"))
            c.Abort()
            return
        }

        c.Set("user_id", claims.UserID)
        c.Set("user_role", claims.Role)
        c.Next()
    }
}

func extractBearerToken(header string) string {
    parts := strings.SplitN(header, " ", 2)
    if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
        return parts[1]
    }
    return ""
}
```
{% endif %}
{% if auth.method == "session" %}
### Session Authentication

```go
func (h *Handler) authMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        sessionID, err := c.Cookie("session_id")
        if err != nil {
            h.respondError(c, apperror.NewUnauthorized("no session"))
            c.Abort()
            return
        }

        session, err := h.sessionStore.Get(c.Request.Context(), sessionID)
        if err != nil {
            h.respondError(c, apperror.NewUnauthorized("invalid session"))
            c.Abort()
            return
        }

        c.Set("user_id", session.UserID)
        c.Next()
    }
}
```
{% endif %}
{% if auth.method == "api_key" %}
### API Key Authentication

```go
func (h *Handler) authMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        apiKey := c.GetHeader("X-API-Key")
        if apiKey == "" {
            h.respondError(c, apperror.NewUnauthorized("missing API key"))
            c.Abort()
            return
        }

        client, err := h.authSvc.ValidateAPIKey(c.Request.Context(), apiKey)
        if err != nil {
            h.respondError(c, apperror.NewUnauthorized("invalid API key"))
            c.Abort()
            return
        }

        c.Set("client_id", client.ID)
        c.Next()
    }
}
```
{% endif %}
{% if auth.method == "none" %}
### No Authentication

This service runs without authentication. Accepted risks: {{ auth.if_none_risks_accepted }}

Ensure network-level access control (VPC, firewall) is in place.
{% endif %}

---

## §6 Database Access

{% for db in databases %}
{% if db.role == "primary" %}
### {{ db.engine }} — Primary Store

```go
// internal/config/database.go
func InitDB(cfg DatabaseConfig) *sql.DB {
    db, err := sql.Open("postgres", cfg.DSN())
    if err != nil {
        log.Fatal("db connection failed", zap.Error(err))
    }

    db.SetMaxOpenConns(25)
    db.SetMaxIdleConns(10)
    db.SetConnMaxLifetime(5 * time.Minute)

    if err := db.Ping(); err != nil {
        log.Fatal("db ping failed", zap.Error(err))
    }
    return db
}
```

**Repository pattern:**

```go
type userRepo struct {
    db *sql.DB
}

func NewUserRepo(db *sql.DB) UserRepository {
    return &userRepo{db: db}
}

func (r *userRepo) FindByID(ctx context.Context, id string) (*model.User, error) {
    var user model.User
    err := r.db.QueryRowContext(ctx,
        "SELECT id, name, email FROM users WHERE id = $1", id,
    ).Scan(&user.ID, &user.Name, &user.Email)

    if errors.Is(err, sql.ErrNoRows) {
        return nil, apperror.ErrNotFound
    }
    if err != nil {
        return nil, fmt.Errorf("find user: %w", err)
    }
    return &user, nil
}
```

**Rules:**
- Always pass `context.Context` to DB operations
- Use parameterized queries — never string concatenation
- Wrap `sql.ErrNoRows` to domain `ErrNotFound`
{% endif %}
{% if db.role == "cache" %}
### {{ db.engine }} — Cache

```go
func (r *cacheRepo) Get(ctx context.Context, key string) (string, error) {
    val, err := r.rdb.Get(ctx, key).Result()
    if errors.Is(err, redis.Nil) {
        return "", nil // cache miss, not an error
    }
    return val, err
}
```
{% endif %}
{% endfor %}

---

## §7 Middleware Patterns

### Request ID

```go
func requestIDMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.GetHeader("X-Request-ID")
        if id == "" {
            id = uuid.NewString()
        }
        c.Set("request_id", id)
        c.Header("X-Request-ID", id)
        c.Next()
    }
}
```

### CORS

```go
func corsMiddleware(cfg CORSConfig) gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("Access-Control-Allow-Origin", cfg.AllowOrigin)
        c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Request-ID")
        c.Header("Access-Control-Max-Age", "86400")

        if c.Request.Method == http.MethodOptions {
            c.AbortWithStatus(http.StatusNoContent)
            return
        }
        c.Next()
    }
}
```

### Rate limiting

{% if rate_limiting.enabled %}
```go
func rateLimitMiddleware(rps int) gin.HandlerFunc {
    limiter := rate.NewLimiter(rate.Limit(rps), rps*2)
    return func(c *gin.Context) {
        if !limiter.Allow() {
            c.JSON(http.StatusTooManyRequests, gin.H{
                "error": gin.H{"code": "RATE_LIMITED", "message": "too many requests"},
            })
            c.Abort()
            return
        }
        c.Next()
    }
}
```
{% endif %}

---

## §8 Configuration

```go
// internal/config/config.go
type Config struct {
    Env      string         `env:"APP_ENV" envDefault:"development"`
    Port     string         `env:"PORT" envDefault:"8080"`
    Database DatabaseConfig
    CORS     CORSConfig
}

type DatabaseConfig struct {
    Host     string `env:"DB_HOST" envDefault:"localhost"`
    Port     string `env:"DB_PORT" envDefault:"5432"`
    Name     string `env:"DB_NAME,required"`
    User     string `env:"DB_USER,required"`
    Password string `env:"DB_PASSWORD,required"`
    SSLMode  string `env:"DB_SSL_MODE" envDefault:"disable"`
}

func (c DatabaseConfig) DSN() string {
    return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
        c.Host, c.Port, c.User, c.Password, c.Name, c.SSLMode)
}

func Load() *Config {
    cfg := &Config{}
    if err := env.Parse(cfg); err != nil {
        log.Fatalf("config parse: %v", err)
    }
    return cfg
}
```

**Rules:**
- All config from environment variables — no config files in production
- Use `envDefault` for development defaults
- Mark secrets as `required` — fail fast on missing
