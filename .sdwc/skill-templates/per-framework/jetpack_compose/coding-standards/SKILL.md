# Coding Standards — Jetpack Compose

> This skill defines coding rules for the **{{ name }}** service (Kotlin / Jetpack Compose).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── app/
│   ├── src/main/
│   │   ├── java/com/company/{{ name }}/
│   │   │   ├── app/                      ← Application, DI, theme
│   │   │   │   ├── {{ name }}Application.kt
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── di/
│   │   │   │   └── theme/
│   │   │   │       ├── Theme.kt
│   │   │   │       ├── Color.kt
│   │   │   │       └── Type.kt
│   │   │   ├── features/                 ← feature-first modules
│   │   │   │   └── {feature_name}/
│   │   │   │       ├── ui/              ← Composable screens + components
│   │   │   │       ├── viewmodel/
│   │   │   │       └── model/
│   │   │   ├── shared/                   ← cross-feature reusables
│   │   │   │   ├── components/          ← reusable Composables
│   │   │   │   ├── extensions/
│   │   │   │   └── util/
│   │   │   ├── data/                     ← repositories, data sources
│   │   │   │   ├── repository/
│   │   │   │   ├── remote/
│   │   │   │   └── local/
│   │   │   ├── model/                    ← shared data models
│   │   │   └── navigation/              ← nav graph, routes
│   │   │       ├── NavGraph.kt
│   │   │       └── Route.kt
│   │   ├── res/
│   │   │   ├── values/                  ← strings, colors (no layout XMLs)
│   │   │   └── drawable/
│   │   └── AndroidManifest.xml
│   ├── src/test/
│   └── src/androidTest/
├── build.gradle.kts
├── app/build.gradle.kts
├── gradle.properties
└── settings.gradle.kts
```

**Rules:**
- Feature-first grouping. Each feature owns its composables, view models, and models.
- One top-level class/function per file. File name matches primary type (PascalCase).
- **No `res/layout/` XMLs** — all UI is Composable functions.
- Promote components to `shared/components/` when used by 2+ features.
- Navigation routes defined in `navigation/` — not scattered across features.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | PascalCase matching type | `UserProfileScreen.kt` |
| Composable screens | PascalCase + `Screen` | `UserProfileScreen` |
| Composable components | PascalCase | `UserCard`, `PrimaryButton` |
| ViewModels | PascalCase + `ViewModel` | `UserListViewModel` |
| Functions | camelCase | `fetchUser()`, `formatDate()` |
| Variables / Properties | camelCase | `isLoading`, `userName` |
| Constants | UPPER_SNAKE in companion | `const val MAX_RETRY = 3` |
| Packages | lowercase, no underscores | `com.company.app.features.auth` |
| Routes | PascalCase object/class | `Route.UserProfile(id)` |
| State holders | camelCase + `State` | `uiState`, `loginState` |

---

## 3. Type System

Same Kotlin type system as Android Views — **null-safe by default**.

```kotlin
// Prefer explicit types for public APIs
fun fetchUser(id: String): Flow<Result<User>> { ... }

// OK to infer for local variables
val user = repository.getById(id)
```

**Rules:**
- Avoid nullable types (`?`) unless the value is genuinely optional.
- Never use `!!` — use `?.`, `?:`, or `let`/`run`.
- Use `data class` for DTOs and value objects.
- Use `sealed interface` for UI state and navigation routes.
- Prefer `val` over `var` — immutability by default.

```kotlin
sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}
```

---

## 4. Import Order

```kotlin
// 1. Android / AndroidX / Compose
import android.os.Bundle
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*

// 2. Third-party
import dagger.hilt.android.AndroidEntryPoint
import coil.compose.AsyncImage

// 3. Project imports
import com.company.app.data.repository.UserRepository
import com.company.app.shared.components.LoadingIndicator

// 4. Kotlin stdlib
import kotlinx.coroutines.flow.Flow
```

**Rules:**
- Compose imports can use wildcards (`androidx.compose.runtime.*`) — they're large.
- Sort alphabetically within each group.
- Android Studio auto-organizes; configure in Editor → Code Style → Kotlin → Imports.

---

## 5. Compose Patterns

### State hoisting

```kotlin
// ✅ Stateless composable — state hoisted to caller
@Composable
fun UserCard(
    user: User,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(onClick = onClick, modifier = modifier) {
        Text(user.name, style = MaterialTheme.typography.titleMedium)
    }
}
```

### Screen + ViewModel wiring

```kotlin
@Composable
fun UserListScreen(
    viewModel: UserListViewModel = hiltViewModel(),
    onNavigateToDetail: (String) -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    UserListContent(
        uiState = uiState,
        onRetry = viewModel::loadUsers,
        onUserClick = onNavigateToDetail,
    )
}

@Composable
private fun UserListContent(
    uiState: UiState<List<User>>,
    onRetry: () -> Unit,
    onUserClick: (String) -> Unit,
) {
    when (uiState) {
        is UiState.Loading -> CircularProgressIndicator()
        is UiState.Success -> LazyColumn { items(uiState.data) { UserCard(it, onClick = { onUserClick(it.id) }) } }
        is UiState.Error -> ErrorView(message = uiState.message, onRetry = onRetry)
    }
}
```

### Modifier parameter convention

```kotlin
// ✅ Always accept Modifier as last optional parameter
@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,   // always last, default empty
) { ... }
```

**Rules:**
- **State hoisting**: composables receive state as params, emit events as lambdas.
- Split Screen (ViewModel-aware) from Content (stateless, previewable).
- Accept `Modifier` as last parameter with `Modifier` default — never hardcode size/padding internally.
- Use `collectAsStateWithLifecycle()` for Flow → Compose state (lifecycle-aware).
- Use `LaunchedEffect` for side effects, `rememberCoroutineScope` for event-driven coroutines.

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ktlint** | Linter + formatter | `.editorconfig` |
| **detekt** | Static analysis | `detekt.yml` |
| **Compose compiler metrics** | Stability/skip checks | Gradle flag |
| **Android Lint** | Android-specific checks | `lint.xml` |

```bash
./gradlew ktlintCheck
./gradlew ktlintFormat
./gradlew detekt
./gradlew lint
```

**Compose compiler reports (debug stability):**

```kotlin
// build.gradle.kts
composeCompiler {
    reportsDestination = layout.buildDirectory.dir("compose_compiler")
}
```

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| `!!` not-null assertion | `?.let { }`, `?:`, safe calls |
| Business logic in Composable | Extract to ViewModel |
| Stateful composable that's hard to preview | State hoisting — split Screen/Content |
| Missing `Modifier` parameter | Always accept `modifier: Modifier = Modifier` |
| `mutableStateOf` in ViewModel | `MutableStateFlow` + `collectAsStateWithLifecycle()` |
| `collectAsState()` without lifecycle | Use `collectAsStateWithLifecycle()` |
| Hard-coded colors/fonts | `MaterialTheme.colorScheme` / `MaterialTheme.typography` |
| `println()` for logging | Use structured logger (→ skills/common/observability/) |
