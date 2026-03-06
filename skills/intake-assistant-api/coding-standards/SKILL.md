# Coding Standards — FastAPI

> This skill defines coding rules for the **intake-assistant-api** service (FastAPI / Python).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
intake-assistant-api/
├── src/
│   └── {service_name}/               ← package directory (snake_case of intake-assistant-api)
│       ├── __init__.py
│       ├── main.py                   ← FastAPI app instance + lifespan
│       ├── routers/                  ← route definitions (thin layer)
│       │   ├── __init__.py
│       │   └── {resource}.py
│       ├── schemas/                  ← Pydantic request/response models
│       │   └── {resource}.py
│       ├── services/                 ← business logic
│       │   └── {resource}_service.py
│       ├── repositories/             ← data access (DB queries)
│       │   └── {resource}_repo.py
│       ├── models/                   ← SQLAlchemy / ORM models
│       │   └── {resource}.py
│       ├── dependencies/             ← Depends() callables
│       │   ├── auth.py
│       │   └── database.py
│       ├── core/                     ← app-wide config, exceptions, constants
│       │   ├── config.py
│       │   ├── exceptions.py
│       │   └── constants.py
│       └── utils/                    ← pure utility functions
├── tests/
│   ├── conftest.py
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── alembic/                          ← if using DB migrations
├── pyproject.toml
└── Dockerfile
```

**Rules:**
- One router file per resource (e.g., `routers/users.py`, `routers/posts.py`).
- Never import from `routers/` into `services/`. Dependency flows one way: routers → services → repositories.
- `core/` holds zero business logic — only configuration, exception classes, and constants.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files & modules | snake_case | `user_service.py` |
| Classes | PascalCase | `UserService`, `CreateUserRequest` |
| Functions & methods | snake_case | `get_user_by_id()` |
| Constants | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Router path | kebab-case plural | `/api/v1/user-profiles` |
| Path parameter | snake_case | `/users/{user_id}` |
| Pydantic schema | PascalCase with suffix | `UserCreate`, `UserUpdate`, `UserResponse` |
| Enum values | UPPER_SNAKE | `class Status(str, Enum): ACTIVE = "active"` |

**Schema naming pattern:**
- `{Resource}Create` — request body for POST
- `{Resource}Update` — request body for PUT/PATCH
- `{Resource}Response` — single item response
- `{Resource}ListResponse` — paginated list response

---

## 3. Type Hints & Pydantic

**Rule: Every function signature must have full type annotations.** No exceptions.

```python
# ✅ correct
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)) -> UserResponse:
    ...

# ❌ wrong — missing return type, untyped parameter
async def get_user(user_id, db=Depends(get_db)):
    ...
```

**Pydantic rules:**
- Use Pydantic v2 `BaseModel` for all request/response schemas.
- Separate create, update, and response schemas — never reuse one model for multiple purposes.
- Use `Field()` for validation constraints, not raw type tricks.
- Mark optional fields explicitly with `| None = None`.

```python
from pydantic import BaseModel, Field

class UserCreate(BaseModel):
    email: str = Field(..., max_length=255)
    name: str = Field(..., min_length=1, max_length=100)
    bio: str | None = None

class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    bio: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

---

## 4. Import Order

Group imports in this order, separated by blank lines:

```python
# 1. Standard library
import os
from datetime import datetime
from uuid import UUID

# 2. Third-party
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

# 3. Local — absolute imports from package root
from src.my_api.dependencies.auth import get_current_user
from src.my_api.schemas.user import UserCreate, UserResponse
from src.my_api.services.user_service import UserService
```

**Rules:**
- Always use absolute imports from the package root. No relative imports (`from ..services`).
- Never use wildcard imports (`from module import *`).

---

## 5. Dependency Injection

All shared resources (DB sessions, auth, external clients) are injected via `Depends()`.

```python
# dependencies/database.py
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session

# routers/users.py
@router.get("/{user_id}")
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    service = UserService(db)
    return await service.get_by_id(user_id)
```

**Rules:**
- Define all dependency callables in `dependencies/`.
- Routers receive dependencies via function parameters — never instantiate services or open DB sessions directly.
- Compose dependencies: `get_current_user` can itself depend on `get_db`.
- For testing, override dependencies with `app.dependency_overrides` — never patch internals.

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ruff** | Linter + formatter | `pyproject.toml` `[tool.ruff]` |
| **mypy** | Type checking | `pyproject.toml` `[tool.mypy]` |

**Ruff configuration baseline:**

```toml
[tool.ruff]
target-version = "py312"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM", "RUF"]

[tool.ruff.format]
quote-style = "double"
```

**Commands:**

```bash
ruff check .              # lint
ruff format .             # format
mypy src/                 # type check
```

**Rules:**
- Run `ruff check` and `ruff format` before every commit.
- All new code must pass `mypy --strict` for the changed files.
- Docstrings: Google style for all public functions and classes.

```python
def calculate_total(items: list[Item], tax_rate: float) -> Decimal:
    """Calculate total price including tax.

    Args:
        items: List of items to sum.
        tax_rate: Tax rate as decimal (e.g., 0.1 for 10%).

    Returns:
        Total price with tax applied.

    Raises:
        ValueError: If tax_rate is negative.
    """
```

---

## 7. Anti-patterns

**Never do these:**

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in routers | Move to `services/` layer |
| Raw SQL strings in services | Use repository layer with ORM |
| Global mutable state (`global db`) | Inject via `Depends()` |
| Catching bare `except Exception` | Catch specific exceptions, let unexpected ones propagate |
| Hardcoded config values | Use `core/config.py` with pydantic-settings |
| Returning ORM models from endpoints | Convert to Pydantic response schema |
| Relative imports (`from ..`) | Absolute imports from package root |
| `print()` for logging | Use structured logger (→ skills/common/observability/) |
