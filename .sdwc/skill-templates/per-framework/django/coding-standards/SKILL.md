# Coding Standards — Django

> This skill defines coding rules for the **{{ name }}** service (Django + DRF / Python).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   └── {service_name}/               ← project directory (snake_case of {{ name }})
│       ├── __init__.py
│       ├── settings.py               ← Django settings (single file, env-based)
│       ├── urls.py                   ← root URL configuration
│       ├── wsgi.py
│       ├── asgi.py
│       └── apps/                     ← Django apps (one per domain)
│           ├── {domain}/
│           │   ├── __init__.py
│           │   ├── apps.py
│           │   ├── models.py         ← Django ORM models
│           │   ├── serializers.py    ← DRF serializers
│           │   ├── views.py          ← DRF viewsets / APIViews
│           │   ├── urls.py           ← app-level URL routing
│           │   ├── services.py       ← business logic
│           │   ├── repositories.py   ← complex query methods
│           │   ├── permissions.py    ← custom DRF permissions
│           │   ├── filters.py        ← django-filter filtersets
│           │   ├── signals.py        ← signal handlers (if needed)
│           │   ├── admin.py          ← admin registration
│           │   └── migrations/
│           └── core/                  ← app-wide config, exceptions, shared logic
│               ├── __init__.py
│               ├── exceptions.py
│               ├── pagination.py
│               ├── permissions.py
│               └── middleware.py
├── tests/
│   ├── conftest.py
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── manage.py
├── pyproject.toml
└── Dockerfile
```

**Rules:**
- One Django app per domain (e.g., `apps/users/`, `apps/posts/`).
- Views are thin — they validate input and call services. Business logic lives in `services.py`.
- Dependency flow: views → services → repositories/models. Never the reverse.
- `core/` holds cross-cutting concerns only — no business logic.
- Never put business logic in `models.py` — models define schema and simple property methods only.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files & modules | snake_case | `user_service.py` |
| Django apps | snake_case singular or plural | `users`, `payment` |
| Model classes | PascalCase singular | `User`, `Post`, `OrderItem` |
| Serializer classes | PascalCase with suffix | `UserCreateSerializer`, `UserListSerializer` |
| ViewSet / View classes | PascalCase with suffix | `UserViewSet`, `UserDetailView` |
| Service classes | PascalCase with suffix | `UserService` |
| URL path | kebab-case plural | `/api/v1/user-profiles/` |
| URL name | snake_case with namespace | `users:user-detail` |
| Constants | UPPER_SNAKE | `MAX_PAGE_SIZE` |
| Template tags/filters | snake_case | `format_currency` |
| Permissions | PascalCase with `Permission` | `IsOwnerPermission` |

**Serializer naming pattern:**
- `{Resource}CreateSerializer` — POST request
- `{Resource}UpdateSerializer` — PUT/PATCH request
- `{Resource}ListSerializer` — list response (minimal fields)
- `{Resource}DetailSerializer` — single item response (full fields)

---

## 3. Type Hints & Typing

**Rule: Every function signature must have full type annotations.** No exceptions.

```python
# ✅ correct
def get_user(self, user_id: UUID) -> User:
    ...

def create_user(self, data: UserCreateSerializer) -> User:
    ...

# ❌ wrong — missing return type
def get_user(self, user_id):
    ...
```

**Django model type hints:**
- Use `django-stubs` for typed QuerySets and Managers.
- Type QuerySet returns as `QuerySet[Model]`.

```python
from django.db.models import QuerySet

class UserRepository:
    def active_users(self) -> QuerySet[User]:
        return User.objects.filter(is_active=True)
```

---

## 4. Import Order

Group imports in this order, separated by blank lines:

```python
# 1. Standard library
import os
from datetime import datetime
from uuid import UUID

# 2. Django & DRF
from django.db import models
from django.conf import settings
from rest_framework import serializers, viewsets

# 3. Third-party
from django_filters.rest_framework import DjangoFilterBackend

# 4. Local — absolute imports from project root
from src.my_api.apps.users.models import User
from src.my_api.apps.users.services import UserService
from src.my_api.apps.core.exceptions import NotFoundError
```

**Rules:**
- Always use absolute imports from the project root. No relative imports (`from ..models`).
- Never use wildcard imports.
- Django/DRF imports form a separate group from other third-party libraries.

---

## 5. Django & DRF Patterns

### View layer — prefer ViewSets for CRUD

```python
# views.py
class UserViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for users.
    Uses service layer for business logic.
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("update", "partial_update"):
            return UserUpdateSerializer
        if self.action == "list":
            return UserListSerializer
        return UserDetailSerializer

    def perform_create(self, serializer):
        service = UserService()
        service.create_user(serializer.validated_data)
```

### Use APIView for non-CRUD endpoints

```python
class UserStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        service = UserService()
        stats = service.get_user_stats(request.user.id)
        return Response(UserStatsSerializer(stats).data)
```

### Manager pattern — custom queries on the model

```python
# models.py
class UserManager(models.Manager):
    def active(self) -> QuerySet["User"]:
        return self.filter(is_active=True)

class User(models.Model):
    objects = UserManager()
```

**Rules:**
- Simple queries (filter, get) can use Manager methods directly in services.
- Complex queries (multi-join, aggregation, raw SQL) go in `repositories.py`.
- Views never access models directly — always through services.

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ruff** | Linter + formatter | `pyproject.toml` `[tool.ruff]` |
| **mypy** + **django-stubs** | Type checking | `pyproject.toml` `[tool.mypy]` |

**Ruff configuration baseline:**

```toml
[tool.ruff]
target-version = "py312"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM", "DJ", "RUF"]
# DJ = Django-specific rules

[tool.ruff.format]
quote-style = "double"
```

**mypy with django-stubs:**

```toml
[tool.mypy]
plugins = ["mypy_django_plugin.main", "mypy_drf_plugin.main"]
strict = true

[tool.django-stubs]
django_settings_module = "src.{service_name}.settings"
```

**Commands:**

```bash
ruff check .
ruff format .
mypy src/
```

**Docstrings:** Google style for all public functions, classes, and viewsets.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in views | Move to `services.py` |
| Business logic in models | Models define schema; logic goes in services |
| Fat serializers with side effects | Serializers validate; services execute |
| Raw SQL in views or services | Use ORM or `repositories.py` |
| Global mutable state | Inject via function parameters or Django settings |
| `select_related` / `prefetch_related` missing | Always optimize queries for list endpoints |
| Hardcoded config | Use `django-environ` or env vars in `settings.py` |
| Signals for business logic | Use explicit service calls; signals for decoupled side effects only |
| Relative imports (`from ..`) | Absolute imports from project root |
| `print()` for logging | Use structured logger (→ skills/common/observability/) |
