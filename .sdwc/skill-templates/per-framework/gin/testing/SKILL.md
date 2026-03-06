# Testing — Gin ({{ name }})

> Service: {{ name }} | Framework: Gin | Test: go test
> Coverage mode: {{ test_case_coverage }}

---

## §1 Test Organization

```
internal/
├── handler/
│   ├── user_handler.go
│   └── user_handler_test.go      ← same package (white-box)
├── service/
│   ├── user_service.go
│   └── user_service_test.go
├── repository/
│   ├── user_repo.go
│   └── user_repo_test.go
└── integration_test/              ← separate package for integration tests
    └── api_test.go
```

**Rules:**
- Unit tests in the same package as the code (`_test.go` suffix)
- Integration tests in separate `integration_test/` package
- Use build tags to separate: `//go:build integration`

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
- Happy path: valid input → expected output
- Edge cases: empty input, boundary values, zero values
- Failure cases: not found, validation error, service error, DB error
{% endif %}
{% if test_case_coverage == "thorough" %}
**Level: thorough** — Happy path + edge cases + failure cases + security cases.

For each handler/service function, write:
- Happy path: valid input → expected output
- Edge cases: empty input, boundary values, zero values
- Failure cases: not found, validation error, service error, DB error
- Security cases: unauthorized access, injection attempts, rate limit bypass
{% endif %}

---

## §3 Unit Testing Patterns

### Table-driven tests (standard Go pattern)

```go
func TestUserService_Create(t *testing.T) {
    tests := []struct {
        name    string
        input   dto.CreateUserRequest
        mock    func(*mocks.MockUserRepo)
        want    *model.User
        wantErr bool
    }{
        {
            name:  "valid user",
            input: dto.CreateUserRequest{Name: "Alice", Email: "alice@example.com"},
            mock: func(m *mocks.MockUserRepo) {
                m.EXPECT().Create(gomock.Any(), gomock.Any()).Return(nil)
            },
            want:    &model.User{Name: "Alice"},
            wantErr: false,
        },
        {
            name:  "duplicate email",
            input: dto.CreateUserRequest{Email: "dup@example.com"},
            mock: func(m *mocks.MockUserRepo) {
                m.EXPECT().Create(gomock.Any(), gomock.Any()).Return(apperror.ErrDuplicate)
            },
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            ctrl := gomock.NewController(t)
            defer ctrl.Finish()

            repo := mocks.NewMockUserRepo(ctrl)
            tt.mock(repo)

            svc := service.NewUserService(repo)
            got, err := svc.Create(context.Background(), tt.input)

            if tt.wantErr {
                assert.Error(t, err)
                return
            }
            assert.NoError(t, err)
            assert.Equal(t, tt.want.Name, got.Name)
        })
    }
}
```

### Mocking with gomock

```go
//go:generate mockgen -source=interfaces.go -destination=mocks/mock_repo.go -package=mocks
type UserRepository interface {
    FindByID(ctx context.Context, id string) (*model.User, error)
    Create(ctx context.Context, user *model.User) error
}
```

Generate mocks: `go generate ./...`

---

## §4 Handler Testing

Test gin handlers using `httptest`:

```go
func TestHandler_GetUser(t *testing.T) {
    ctrl := gomock.NewController(t)
    defer ctrl.Finish()

    mockSvc := mocks.NewMockUserService(ctrl)
    mockSvc.EXPECT().FindByID(gomock.Any(), "123").Return(&model.User{ID: "123", Name: "Alice"}, nil)

    h := handler.NewHandler(mockSvc, zap.NewNop())

    gin.SetMode(gin.TestMode)
    r := gin.New()
    h.RegisterRoutes(r.Group("/api/v1"))

    req := httptest.NewRequest(http.MethodGet, "/api/v1/users/123", nil)
    w := httptest.NewRecorder()
    r.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    var resp dto.UserResponse
    err := json.Unmarshal(w.Body.Bytes(), &resp)
    assert.NoError(t, err)
    assert.Equal(t, "Alice", resp.Name)
}
```

**Rules:**
- Always set `gin.SetMode(gin.TestMode)` — suppresses debug output
- Use `httptest.NewRecorder` — never start a real server in unit tests
- Test response status code AND body structure

---

## §5 Integration Testing

```go
//go:build integration

package integration_test

func TestCreateUserFlow(t *testing.T) {
    db := setupTestDB(t)    // real DB via testcontainers
    defer db.Close()

    app := setupApp(db)     // wire real dependencies

    // Create user
    body := `{"name":"Alice","email":"alice@example.com"}`
    req := httptest.NewRequest(http.MethodPost, "/api/v1/users", strings.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    w := httptest.NewRecorder()
    app.ServeHTTP(w, req)
    assert.Equal(t, http.StatusCreated, w.Code)

    // Verify in DB
    var count int
    db.QueryRow("SELECT COUNT(*) FROM users WHERE email=$1", "alice@example.com").Scan(&count)
    assert.Equal(t, 1, count)
}
```

{% if test_case_coverage == "thorough" %}

---

## §6 Security Testing

```go
func TestAuth_InvalidToken(t *testing.T) {
    r := setupRouterWithAuth()

    req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
    req.Header.Set("Authorization", "Bearer invalid-token")
    w := httptest.NewRecorder()
    r.ServeHTTP(w, req)

    assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestInput_SQLInjection(t *testing.T) {
    r := setupRouter()

    req := httptest.NewRequest(http.MethodGet, "/api/v1/users/'; DROP TABLE users;--", nil)
    w := httptest.NewRecorder()
    r.ServeHTTP(w, req)

    // Should return 400 or 404, never 500
    assert.NotEqual(t, http.StatusInternalServerError, w.Code)
}
```
{% endif %}

---

## §7 Test Commands

```makefile
# Unit tests
test:
	go test ./internal/... -v -race -count=1

# With coverage
test-cover:
	go test ./internal/... -coverprofile=coverage.out -covermode=atomic
	go tool cover -html=coverage.out -o coverage.html

# Integration tests only
test-integration:
	go test ./internal/integration_test/... -tags=integration -v

# Generate mocks
generate:
	go generate ./...
```

**Flags:**
- `-race`: detect data races (always use in CI)
- `-count=1`: disable test caching
- `-covermode=atomic`: accurate coverage with goroutines
