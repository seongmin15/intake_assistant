# Coding Standards — Flutter

> This skill defines coding rules for the **{{ name }}** service (Flutter / Dart).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── lib/
│   ├── app/                      ← app root (MaterialApp, router, theme)
│   │   ├── app.dart
│   │   ├── router.dart
│   │   └── theme.dart
│   ├── features/                 ← feature-first modules
│   │   └── {feature_name}/
│   │       ├── screens/
│   │       ├── widgets/
│   │       ├── providers/        ← state (Riverpod/Bloc/etc.)
│   │       └── models/
│   ├── shared/                   ← cross-feature reusables
│   │   ├── widgets/
│   │   ├── extensions/
│   │   └── utils/
│   ├── services/                 ← API clients, platform services
│   │   └── {resource}_api.dart
│   ├── models/                   ← shared data models
│   ├── constants/                ← app-wide constants
│   └── main.dart                 ← entry point
├── test/
├── integration_test/
├── android/
├── ios/
├── pubspec.yaml
└── analysis_options.yaml
```

**Rules:**
- Feature-first grouping. Each feature owns its screens, widgets, state, and models.
- One public class per file. File name matches class in `snake_case`.
- Promote widgets to `shared/` when used by 2+ features.
- Platform-specific Dart code uses conditional imports, not separate files.
- `services/` contains only API/platform calls — no UI logic.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | snake_case | `user_card.dart` |
| Classes / Enums | PascalCase | `UserCard`, `AuthStatus` |
| Functions / Methods | camelCase | `fetchUser()`, `formatDate()` |
| Variables / Parameters | camelCase | `isLoading`, `userName` |
| Constants | camelCase or UPPER_SNAKE | `defaultPadding`, `API_BASE_URL` |
| Private members | `_` prefix | `_controller`, `_buildHeader()` |
| Named parameters | camelCase | `UserCard({required this.user})` |
| Boolean variables | `is`/`has`/`should` prefix | `isActive`, `hasError` |

---

## 3. Type System

Dart is **sound null-safe**. Leverage the type system fully.

```dart
// Prefer explicit types for public APIs
String formatPrice(double amount, {String currency = 'USD'}) { ... }

// OK to use var/final for local variables with obvious types
final user = await userApi.getById(id);
var count = 0;
```

**Rules:**
- Never use `dynamic` unless interfacing with untyped JSON. Prefer typed models.
- Use `required` for mandatory named parameters.
- Prefer `final` for variables that are assigned once.
- Use sealed classes / enums for finite state sets (Dart 3+).

```dart
sealed class AuthState {
  const AuthState();
}
class Authenticated extends AuthState { final User user; ... }
class Unauthenticated extends AuthState { const Unauthenticated(); }
class AuthLoading extends AuthState { const AuthLoading(); }
```

---

## 4. Import Order

```dart
// 1. Dart SDK
import 'dart:async';
import 'dart:convert';

// 2. Flutter SDK
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// 3. Third-party packages
import 'package:riverpod/riverpod.dart';
import 'package:dio/dio.dart';

// 4. Project imports
import 'package:{{ name }}/features/auth/providers/auth_provider.dart';
import 'package:{{ name }}/shared/widgets/loading_indicator.dart';

// 5. Relative imports (same feature only)
import '../widgets/profile_header.dart';
```

**Rules:**
- Use package imports (`package:{{ name }}/...`) for cross-feature references.
- Use relative imports only within the same feature folder.
- Sort alphabetically within each group.

---

## 5. Widget Patterns

### Prefer StatelessWidget

```dart
class UserCard extends StatelessWidget {
  const UserCard({super.key, required this.user, required this.onTap});

  final User user;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Text(user.name),
    );
  }
}
```

### const constructors

```dart
// Always use const constructors where possible
const SizedBox(height: 16);
const EdgeInsets.all(16);
```

### Extract methods → Extract widgets

```dart
// ❌ Extracting build methods (still rebuilds parent)
Widget _buildHeader() { ... }

// ✅ Extract to separate widget (independent rebuild)
class _ProfileHeader extends StatelessWidget { ... }
```

**Rules:**
- Use `const` constructors wherever possible — enables widget caching.
- Extract widgets instead of helper methods for better rebuild performance.
- Keep `build()` methods focused — break at 40+ lines.
- Use `named` parameters for widget constructors with 2+ arguments.

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **dart analyze** | Static analysis | `analysis_options.yaml` |
| **dart format** | Formatter | Built-in (line length 80) |
| **custom_lint** | Custom rules (optional) | `analysis_options.yaml` |

```yaml
# analysis_options.yaml
include: package:flutter_lints/flutter.yaml

linter:
  rules:
    prefer_const_constructors: true
    prefer_const_declarations: true
    avoid_print: true
    prefer_final_locals: true
```

```bash
dart analyze
dart format lib/ test/
dart fix --apply
```

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| `dynamic` types | Typed models with `fromJson` factories |
| Business logic in widgets | Extract to providers/blocs/services |
| Deeply nested widget trees | Extract sub-widgets as separate classes |
| `setState` for complex state | Use state management (Riverpod/Bloc) |
| `print()` for logging | Use structured logger (→ skills/common/observability/) |
| Hard-coded colors/sizes | Use `Theme.of(context)` and constants |
| Mutable global state | Scoped state via providers |
| `build()` helper methods | Extract to separate `StatelessWidget` |
