# Framework — FastAPI

> This skill defines FastAPI-specific patterns for the **intake-assistant-api** service.
> Auth: **none** | API style: **rest**
> Read this before building or modifying any application logic.

---

## 1. Application Bootstrap

```python
# main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init DB pool, external clients, logger
    await init_db()
    logger.info("Application started")
    yield
    # Shutdown: close connections, flush buffers
    await close_db()
    logger.info("Application stopped")

app = FastAPI(
    title="intake-assistant-api",
    lifespan=lifespan,
)
```

**Middleware registration order** (first registered = outermost):

```python
# 1. CORS (outermost — must run before anything else)
app.add_middleware(CORSMiddleware, ...)

# 2. Request logging / tracing
app.add_middleware(RequestLoggingMiddleware)

# 3. Error handling (catches exceptions from inner layers)
app.add_middleware(ErrorHandlingMiddleware)
```

**Logging setup** (→ also see skills/common/observability/):

```python
# core/logging.py
import structlog

def setup_logging():
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
    )
```

Call `setup_logging()` in `lifespan` startup. Use `structlog.get_logger()` everywhere — never `print()` or `logging.getLogger()` directly.

---

## 2. Router Organization

```python
# routers/users.py
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/users", tags=["users"])

@router.get("/{user_id}")
async def get_user(user_id: UUID, ...):
    ...
```

**Registration in main.py:**

```python
from src.{service_name}.routers import users, posts

app.include_router(users.router)
app.include_router(posts.router)
```

**Layer separation:**

```
Router (thin) → Service (business logic) → Repository (data access)
```

- Routers: parse request, call service, return response. No business logic.
- Services: orchestrate operations, enforce business rules. No HTTP concepts (no `HTTPException`).
- Repositories: DB queries only. No business rules.

```python
# ✅ Service raises domain exception
class UserService:
    async def get_by_id(self, user_id: UUID) -> User:
        user = await self.repo.find_by_id(user_id)
        if not user:
            raise UserNotFoundError(user_id)
        return user

# ✅ Router converts domain exception to HTTP
@router.get("/{user_id}")
async def get_user(user_id: UUID, service: UserService = Depends()):
    try:
        return await service.get_by_id(user_id)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
```

---

## 3. Request & Response

**Schema separation** (→ also see coding-standards §3):

| Schema | Purpose | Example |
|--------|---------|---------|
| `{Resource}Create` | POST request body | `UserCreate` |
| `{Resource}Update` | PUT/PATCH request body | `UserUpdate` |
| `{Resource}Response` | Single item response | `UserResponse` |
| `{Resource}ListResponse` | Paginated list | `UserListResponse` |


**Response wrapping:** Return Pydantic schemas from endpoints. Never return ORM models directly.

```python
@router.get("/{user_id}", response_model=UserResponse)
async def get_user(...):
    user = await service.get_by_id(user_id)
    return UserResponse.model_validate(user)
```

---

## 4. Auth Pattern

**Method: none**

All authentication is injected via `Depends()`. Define auth dependencies in `dependencies/auth.py`.

```python
# dependencies/auth.py
async def get_current_user(...) -> User:
    """Validate credentials and return the authenticated user.
    Raises HTTPException(401) on failure."""
    ...

async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role. Raises HTTPException(403) if not admin."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    return current_user
```

**Applying to endpoints:**

```python
# Protected endpoint
@router.get("/me", dependencies=[Depends(get_current_user)])
async def get_profile(current_user: User = Depends(get_current_user)):
    ...

# Admin-only endpoint
@router.delete("/{user_id}", dependencies=[Depends(require_admin)])
async def delete_user(...):
    ...

# Public endpoint — no auth dependency
@router.get("/health")
async def health():
    return {"status": "ok"}
```

**Rules:**
- Every endpoint is protected by default. Explicitly document public endpoints.
- Auth logic stays in `dependencies/auth.py` — never inline in routers.
- For testing, override auth with `app.dependency_overrides[get_current_user]`.

---

## 5. Error Handling

### Domain Exceptions

```python
# core/exceptions.py
class AppError(Exception):
    """Base for all domain exceptions."""
    def __init__(self, message: str, code: str):
        self.message = message
        self.code = code

class NotFoundError(AppError):
    def __init__(self, resource: str, resource_id: str):
        super().__init__(f"{resource} '{resource_id}' not found", "NOT_FOUND")

class ConflictError(AppError):
    def __init__(self, message: str):
        super().__init__(message, "CONFLICT")

class ValidationError(AppError):
    def __init__(self, message: str):
        super().__init__(message, "VALIDATION_ERROR")
```

### Global Exception Handler

```python
# main.py
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    status_map = {
        "NOT_FOUND": 404,
        "CONFLICT": 409,
        "VALIDATION_ERROR": 422,
        "FORBIDDEN": 403,
    }
    return JSONResponse(
        status_code=status_map.get(exc.code, 500),
        content={"error": {"code": exc.code, "message": exc.message}},
    )
```


**Rules:**
- Services raise domain exceptions (`AppError` subclasses) — never `HTTPException`.
- Only routers and the global handler convert to HTTP responses.
- Log unexpected exceptions at ERROR level with full traceback.
- Never expose internal details (stack traces, DB errors) to the client.

---

## 7. Background Tasks & Async

**async/await rules:**
- All endpoint handlers are `async def`.
- All DB operations use async SQLAlchemy.
- CPU-bound work goes to `run_in_executor`.

```python
# Light background work — use FastAPI BackgroundTasks
@router.post("/users")
async def create_user(
    data: UserCreate,
    background_tasks: BackgroundTasks,
):
    user = await service.create_user(data)
    background_tasks.add_task(send_welcome_email, user.email)
    return user

# CPU-bound work — offload to thread pool
import asyncio

async def process_image(image_data: bytes) -> bytes:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_process_image, image_data)
```

**Rules:**
- Never call blocking I/O (file reads, HTTP requests) without `await` or `run_in_executor`.
- `BackgroundTasks` are for fire-and-forget work that should finish within seconds. For long-running jobs, delegate to a worker service.

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Missing `await` | Coroutine returned instead of result | Always `await` async calls |
| Session leak | DB connections exhausted | Use `async with` or `Depends(get_db)` with `yield` |
| Circular imports | `routers/` ↔ `services/` | Strict one-way dependency: routers → services → repositories |
| N+1 queries | Slow list endpoints | Use `selectinload()` / `joinedload()` for relationships |
| Mutable default args | Shared state between requests | Use `Depends()` or `Field(default_factory=...)` |
| Sync in async | Event loop blocked | Use `run_in_executor` for sync/CPU work |
| Swallowing exceptions | Silent failures | Log and re-raise, or handle explicitly |
