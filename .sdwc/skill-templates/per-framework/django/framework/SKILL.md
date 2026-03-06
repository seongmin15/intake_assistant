# Framework — Django

> This skill defines Django + DRF-specific patterns for the **{{ name }}** service.
> Auth: **{{ auth.method }}** | API style: **{{ api_style }}**
> Read this before building or modifying any application logic.

---

## 1. Application Bootstrap

### Settings

```python
# settings.py
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "").split(",")

INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    # Third-party
    "rest_framework",
    "django_filters",
    "corsheaders",
    # Local apps
    "src.{service_name}.apps.core",
    "src.{service_name}.apps.users",
]

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_PAGINATION_CLASS": "src.{service_name}.apps.core.pagination.StandardPagination",
    "EXCEPTION_HANDLER": "src.{service_name}.apps.core.exceptions.custom_exception_handler",
}
```

### ASGI entry point

```python
# asgi.py
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "src.{service_name}.settings")
application = get_asgi_application()
```

**Middleware order** (in settings.py `MIDDLEWARE` list):

```python
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",          # 1. CORS (outermost)
    "django.middleware.security.SecurityMiddleware",   # 2. Security headers
    "src.{service_name}.apps.core.middleware.RequestLoggingMiddleware",  # 3. Logging
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
]
```

**Logging setup** (→ also see skills/common/observability/):

```python
# settings.py
import structlog

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": structlog.stdlib.ProcessorFormatter, ...},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "json"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}
```

Use `structlog.get_logger()` everywhere — never `print()`.

---

## 2. URL & View Organization

### URL routing

```python
# urls.py (root)
from django.urls import path, include

urlpatterns = [
    path("api/v1/", include("src.{service_name}.apps.users.urls")),
    path("api/v1/", include("src.{service_name}.apps.posts.urls")),
    path("admin/", admin.site.urls),
]

# apps/users/urls.py
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("users", views.UserViewSet, basename="user")

urlpatterns = router.urls
```

### Layer separation

```
View (thin) → Service (business logic) → Repository / ORM (data access)
```

- **Views**: parse request, validate via serializer, call service, return response. No business logic.
- **Services**: orchestrate operations, enforce business rules. No HTTP concepts (no `Response`, no status codes).
- **Models/Repositories**: data access only. No business rules.

```python
# ✅ Service raises domain exception
class UserService:
    def get_by_id(self, user_id: UUID) -> User:
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise UserNotFoundError(user_id)

# ✅ View converts domain exception to DRF response (via exception handler)
class UserViewSet(viewsets.ModelViewSet):
    def retrieve(self, request, pk=None):
        service = UserService()
        user = service.get_by_id(pk)
        return Response(UserDetailSerializer(user).data)
```

---

## 3. Serializers

**Separate serializers per action:**

| Serializer | Purpose | Example |
|------------|---------|---------|
| `{Resource}CreateSerializer` | POST request body | `UserCreateSerializer` |
| `{Resource}UpdateSerializer` | PUT/PATCH request body | `UserUpdateSerializer` |
| `{Resource}ListSerializer` | List response (minimal) | `UserListSerializer` |
| `{Resource}DetailSerializer` | Detail response (full) | `UserDetailSerializer` |

```python
# serializers.py
class UserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=255)
    name = serializers.CharField(min_length=1, max_length=100)
    bio = serializers.CharField(required=False, allow_blank=True)

class UserDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "name", "bio", "created_at"]
        read_only_fields = ["id", "created_at"]
```

{% if pagination == "cursor" %}
**Cursor pagination:**

```python
# core/pagination.py
from rest_framework.pagination import CursorPagination

class StandardPagination(CursorPagination):
    page_size = 20
    ordering = "-created_at"
    cursor_query_param = "cursor"
```
{% endif %}
{% if pagination == "offset" %}
**Offset pagination:**

```python
# core/pagination.py
from rest_framework.pagination import LimitOffsetPagination

class StandardPagination(LimitOffsetPagination):
    default_limit = 20
    max_limit = 100
```
{% endif %}

**Rules:**
- Never use `ModelSerializer` for write operations — use explicit `Serializer` with declared fields.
- `ModelSerializer` is fine for read-only responses.
- Validate at the serializer level. Business rule validation goes in services.

---

## 4. Auth Pattern

**Method: {{ auth.method }}**

All authentication is configured via DRF settings and permission classes.

```python
# settings.py
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",  # adapt to auth method
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}
```

**Custom permissions:**

```python
# apps/core/permissions.py
from rest_framework.permissions import BasePermission

class IsOwnerPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.owner_id == request.user.id

class IsAdminPermission(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_staff
```

**Applying to views:**

```python
# Protected (default — IsAuthenticated from settings)
class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

# Admin-only
class AdminUserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminPermission]

# Public endpoint
class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
```

**Rules:**
- Every endpoint is protected by default via `DEFAULT_PERMISSION_CLASSES`.
- Explicitly set `permission_classes = [AllowAny]` for public endpoints.
- Auth logic stays in permission classes and authentication backends — never inline in views.

---

## 5. Error Handling

### Domain Exceptions

```python
# apps/core/exceptions.py
class AppError(Exception):
    def __init__(self, message: str, code: str):
        self.message = message
        self.code = code

class NotFoundError(AppError):
    def __init__(self, resource: str, resource_id: str):
        super().__init__(f"{resource} '{resource_id}' not found", "NOT_FOUND")

class ConflictError(AppError):
    def __init__(self, message: str):
        super().__init__(message, "CONFLICT")
```

### Custom DRF Exception Handler

```python
# apps/core/exceptions.py
from rest_framework.views import exception_handler
from rest_framework.response import Response

STATUS_MAP = {
    "NOT_FOUND": 404,
    "CONFLICT": 409,
    "VALIDATION_ERROR": 422,
    "FORBIDDEN": 403,
}

def custom_exception_handler(exc, context):
    if isinstance(exc, AppError):
        return Response(
            {"error": {"code": exc.code, "message": exc.message}},
            status=STATUS_MAP.get(exc.code, 500),
        )
    return exception_handler(exc, context)  # fallback to DRF default
```

{% if error_response_format %}
**Error response format: {{ error_response_format }}**
{% endif %}

**Rules:**
- Services raise domain exceptions (`AppError` subclasses) — never DRF exceptions.
- Only the custom exception handler converts to HTTP responses.
- Log unexpected exceptions at ERROR level with full traceback.
- Never expose internal details to the client.

---

## 6. Database & ORM

{% if databases %}
### Model Definition

```python
# models.py
import uuid
from django.db import models

class TimestampMixin(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class User(TimestampMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, max_length=255)
    name = models.CharField(max_length=100)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["email"])]
```

### Migrations

```bash
python manage.py makemigrations    # create migration files
python manage.py migrate           # apply migrations
python manage.py showmigrations    # check status
```

**Rules:**
- Always review auto-generated migrations before committing.
- One migration per logical change — squash if too many small migrations accumulate.
- Never edit applied migrations — create new ones instead.

### QuerySet Optimization

```python
# ✅ Prefetch to avoid N+1
User.objects.prefetch_related("posts").all()

# ✅ Select related for ForeignKey
Post.objects.select_related("author").all()

# ✅ Only fetch needed fields
User.objects.only("id", "email", "name")
```

### Transaction Management

```python
from django.db import transaction

class OrderService:
    def create_order(self, data: dict) -> Order:
        with transaction.atomic():
            order = Order.objects.create(**data)
            self.update_inventory(order)
            return order
```

**Rules:**
- Services manage transactions with `transaction.atomic()`.
- Read operations don't need explicit transactions.
- Use `select_for_update()` for concurrent write scenarios.
{% endif %}

---

## 7. Background Tasks & Signals

**For background work, delegate to a worker service (Celery):**

```python
# In service layer
from src.{worker_name}.tasks import send_welcome_email

class UserService:
    def create_user(self, data: dict) -> User:
        user = User.objects.create(**data)
        send_welcome_email.delay(str(user.id))  # async via Celery
        return user
```

**Django signals — use sparingly:**

```python
# signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def on_user_created(sender, instance, created, **kwargs):
    if created:
        AuditLog.objects.create(action="user_created", target_id=instance.id)
```

**Rules:**
- Signals are for decoupled side effects (audit logging, cache invalidation). Never for core business logic.
- Long-running work goes to a worker service — never use signals or management commands for async processing.
- Register signals in `apps.py` `ready()` method.

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Business logic in views | Fat views, hard to test | Move to `services.py` |
| Business logic in models | Tight coupling, circular deps | Models = schema only; services = logic |
| N+1 queries | Slow list endpoints | Use `select_related()` / `prefetch_related()` |
| Missing `db_index` | Slow queries on filtered fields | Add `db_index=True` or `Meta.indexes` |
| Fat serializers | Side effects in validation | Serializers validate; services execute |
| Circular imports | apps importing each other | Use signals or service-layer orchestration |
| Mutable default args | Shared state across requests | Use `default=dict` not `default={}` |
| Sync blocking calls | Thread blocked | Offload to worker or use async views |
| `print()` for logging | Unstructured, lost | Use structured logger (→ skills/common/observability/) |
