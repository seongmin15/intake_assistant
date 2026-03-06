# Coding Standards — Gin ({{ name }})

> Service: {{ name }} | Framework: Gin | Language: Go
> Build: {{ build_tool }}

---

## §1 Project Structure

```
{{ name }}/
├── cmd/
│   └── server/
│       └── main.go              ← entry point
├── internal/
│   ├── handler/                 ← HTTP handlers (controller layer)
│   │   ├── handler.go           ← handler struct + constructor
│   │   ├── {{ name }}_handler.go
│   │   └── middleware.go
│   ├── service/                 ← business logic
│   │   └── {{ name }}_service.go
│   ├── repository/              ← data access
│   │   └── {{ name }}_repo.go
│   ├── model/                   ← domain types + DB models
│   │   └── {{ name }}.go
│   ├── dto/                     ← request/response structs
│   │   └── {{ name }}_dto.go
│   └── config/                  ← configuration
│       └── config.go
├── pkg/                         ← shared utilities (importable by other projects)
│   ├── apperror/
│   └── response/
├── migrations/
├── go.mod
├── go.sum
├── Makefile
└── .golangci.yml
```

**Rules:**
- `internal/` for private packages — not importable outside this module
- `pkg/` only for truly reusable utilities
- One handler file per resource/domain
- `cmd/server/main.go` wires dependencies and starts the server

---

## §2 Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Package | lowercase, single word | `handler`, `service`, `model` |
| File | snake_case | `user_handler.go`, `auth_middleware.go` |
| Exported type | PascalCase | `UserService`, `CreateUserRequest` |
| Unexported type | camelCase | `userRepo`, `dbConn` |
| Interface | PascalCase, `-er` suffix when single-method | `Reader`, `UserRepository` |
| Constant | PascalCase (exported), camelCase (unexported) | `MaxRetries`, `defaultTimeout` |
| Acronyms | ALL CAPS in names | `HTTPClient`, `userID`, `apiURL` |
| Test file | `*_test.go` in same package | `user_handler_test.go` |

**Receiver naming:**
- Short, 1-2 letter, consistent within type: `func (s *UserService) Create(...)`
- Never `this` or `self`

---

## §3 Type System & Interfaces

**Interface rules:**
- Accept interfaces, return concrete structs
- Define interfaces at the **consumer** site, not the implementor
- Keep interfaces small — prefer 1-3 methods

```go
// repository/interfaces.go — defined where consumed
type UserRepository interface {
    FindByID(ctx context.Context, id string) (*model.User, error)
    Create(ctx context.Context, user *model.User) error
}
```

**Generics:** use for utility functions (slices, maps). Avoid for domain types.

**Error handling:**
- Always return `error` as the last return value
- Use custom error types in `pkg/apperror/` with sentinel errors
- Wrap errors with `fmt.Errorf("context: %w", err)` for stack context

**Struct rules:**
- Use pointer receivers for methods that modify state
- Use value receivers for small, immutable structs
- Always validate with struct tags or explicit validation

---

## §4 Import Order

```go
import (
    // 1. Standard library
    "context"
    "fmt"
    "net/http"

    // 2. Third-party packages
    "github.com/gin-gonic/gin"
    "go.uber.org/zap"

    // 3. Internal packages
    "{{ name }}/internal/model"
    "{{ name }}/internal/service"
)
```

Three groups separated by blank lines. `goimports` enforces this automatically.

---

## §5 Gin-Specific Patterns

**Handler struct pattern** — inject dependencies via struct, not globals:

```go
type Handler struct {
    userSvc  service.UserService
    logger   *zap.Logger
}

func NewHandler(userSvc service.UserService, logger *zap.Logger) *Handler {
    return &Handler{userSvc: userSvc, logger: logger}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
    users := r.Group("/users")
    users.POST("", h.CreateUser)
    users.GET("/:id", h.GetUser)
}
```

**Context propagation:** always extract `context.Context` from gin:

```go
func (h *Handler) GetUser(c *gin.Context) {
    ctx := c.Request.Context()
    user, err := h.userSvc.FindByID(ctx, c.Param("id"))
    // ...
}
```

**Middleware values:** use typed keys, never raw strings:

```go
type contextKey string
const userIDKey contextKey = "userID"
```

---

## §6 Linting & Formatting

| Tool | Purpose | Config |
|------|---------|--------|
| `gofmt` | Formatting (standard) | Built-in, no config |
| `goimports` | Import ordering | Run on save |
| `golangci-lint` | Linting (meta-linter) | `.golangci.yml` |
| `go vet` | Static analysis | Built-in |

**golangci-lint enabled linters** (minimum):
`errcheck`, `govet`, `staticcheck`, `unused`, `gosimple`, `ineffassign`, `misspell`

```makefile
lint:
	golangci-lint run ./...

fmt:
	goimports -w .
```

---

## §7 Anti-patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Global variables for DB/config | Inject via handler/service structs |
| `init()` for complex setup | Explicit initialization in `main()` |
| Bare `interface{}` / `any` | Use concrete types or constrained generics |
| Ignore errors with `_` | Handle or explicitly document why ignored |
| `panic()` in library code | Return errors; `panic` only in `main` for unrecoverable |
| Nested if-else chains | Early returns (guard clauses) |
| `context.Background()` in handlers | `c.Request.Context()` from gin |
| String-typed context keys | Typed `contextKey` constants |
