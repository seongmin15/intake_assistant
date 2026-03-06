# Coding Standards — Kotlin (Android)

> This skill defines coding rules for the **{{ name }}** service (Kotlin / Android Views).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── app/
│   ├── src/main/
│   │   ├── java/com/company/{{ name }}/
│   │   │   ├── app/                      ← Application, DI setup
│   │   │   │   ├── {{ name }}Application.kt
│   │   │   │   └── di/
│   │   │   ├── features/                 ← feature-first modules
│   │   │   │   └── {feature_name}/
│   │   │   │       ├── ui/              ← Activities, Fragments, Adapters
│   │   │   │       ├── viewmodel/
│   │   │   │       └── model/
│   │   │   ├── shared/                   ← cross-feature reusables
│   │   │   │   ├── ui/
│   │   │   │   ├── extensions/
│   │   │   │   └── util/
│   │   │   ├── data/                     ← repositories, data sources
│   │   │   │   ├── repository/
│   │   │   │   ├── remote/              ← API services
│   │   │   │   └── local/              ← Room DAOs, DataStore
│   │   │   └── model/                    ← shared data models
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   ├── values/
│   │   │   ├── drawable/
│   │   │   └── navigation/              ← Navigation graph XML
│   │   └── AndroidManifest.xml
│   ├── src/test/                         ← unit tests
│   └── src/androidTest/                  ← instrumented tests
├── build.gradle.kts                      ← project-level
├── app/build.gradle.kts                  ← app-level
├── gradle.properties
└── settings.gradle.kts
```

**Rules:**
- Feature-first grouping. Each feature owns its UI, view models, and models.
- One top-level class per file. File name matches class in PascalCase.
- Promote components to `shared/` when used by 2+ features.
- `data/remote/` contains only API call interfaces — no UI logic.
- Use `res/navigation/` for Navigation Component graphs.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | PascalCase matching class | `UserProfileFragment.kt` |
| Classes | PascalCase | `UserCard`, `AuthRepository` |
| Functions | camelCase | `fetchUser()`, `formatDate()` |
| Variables / Properties | camelCase | `isLoading`, `userName` |
| Constants | UPPER_SNAKE in companion | `const val MAX_RETRY = 3` |
| Packages | lowercase, no underscores | `com.company.app.features.auth` |
| XML layouts | snake_case with prefix | `fragment_user_profile.xml`, `item_user_card.xml` |
| XML IDs | camelCase | `@+id/nameText`, `@+id/submitButton` |
| ViewModels | PascalCase + `ViewModel` | `UserListViewModel` |
| Fragments | PascalCase + `Fragment` | `UserProfileFragment` |
| Activities | PascalCase + `Activity` | `MainActivity` |

---

## 3. Type System

Kotlin is **null-safe by default**. Leverage the type system fully.

```kotlin
// Prefer explicit types for public APIs
fun fetchUser(id: String): Flow<Result<User>> { ... }

// OK to infer for local variables
val user = repository.getById(id)
var count = 0
```

**Rules:**
- Avoid nullable types (`?`) unless the value is genuinely optional.
- Never use `!!` (not-null assertion) — use `?.`, `?:`, or `let`/`run`.
- Use `data class` for DTOs and value objects.
- Use `sealed class` / `sealed interface` for finite state sets.
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
// 1. Android / AndroidX
import android.os.Bundle
import androidx.fragment.app.Fragment

// 2. Third-party
import dagger.hilt.android.AndroidEntryPoint
import retrofit2.http.GET

// 3. Project imports
import com.company.app.data.repository.UserRepository
import com.company.app.shared.extensions.viewBinding

// 4. Kotlin stdlib (usually auto-sorted last)
import kotlinx.coroutines.flow.Flow
```

**Rules:**
- Use wildcard imports sparingly — prefer explicit imports.
- Sort alphabetically within each group.
- Android Studio auto-organizes; configure in Editor → Code Style → Kotlin → Imports.

---

## 5. Android-specific Patterns

### View Binding

```kotlin
class UserProfileFragment : Fragment(R.layout.fragment_user_profile) {
    private var _binding: FragmentUserProfileBinding? = null
    private val binding get() = _binding!!

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        _binding = FragmentUserProfileBinding.bind(view)
        // use binding.nameText, binding.submitButton, etc.
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
```

### ViewModel with StateFlow

```kotlin
@HiltViewModel
class UserListViewModel @Inject constructor(
    private val repository: UserRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<UiState<List<User>>>(UiState.Loading)
    val uiState: StateFlow<UiState<List<User>>> = _uiState.asStateFlow()

    fun loadUsers() {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            repository.getUsers()
                .onSuccess { _uiState.value = UiState.Success(it) }
                .onFailure { _uiState.value = UiState.Error(it.message ?: "Unknown error") }
        }
    }
}
```

### Coroutine scoping

```kotlin
// ✅ Use viewModelScope in ViewModels
viewModelScope.launch { ... }

// ✅ Use lifecycleScope in Fragments/Activities
viewLifecycleOwner.lifecycleScope.launch {
    repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.uiState.collect { state -> updateUI(state) }
    }
}
```

**Rules:**
- Use **View Binding** — not `findViewById` or Kotlin synthetics.
- Use `StateFlow` / `SharedFlow` for ViewModel → UI communication.
- Collect flows with `repeatOnLifecycle` to respect lifecycle.
- Use `viewModelScope` for coroutines in ViewModels.

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ktlint** | Linter + formatter | `.editorconfig` |
| **detekt** | Static analysis | `detekt.yml` |
| **Android Lint** | Android-specific checks | `lint.xml` |

```bash
./gradlew ktlintCheck
./gradlew ktlintFormat
./gradlew detekt
./gradlew lint
```

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| `!!` not-null assertion | `?.let { }`, `?:`, safe calls |
| `findViewById` | View Binding |
| Business logic in Fragment/Activity | Extract to ViewModel + Repository |
| `GlobalScope.launch` | `viewModelScope` / `lifecycleScope` |
| Mutable LiveData exposed | `private _state` + public `state` (StateFlow) |
| Hard-coded strings in layouts | `@string/` resources |
| `println()` for logging | Use structured logger (→ skills/common/observability/) |
| God Activity / Fragment | Single-responsibility: one screen per Fragment |
