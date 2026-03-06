# Coding Standards — SwiftUI

> This skill defines coding rules for the **{{ name }}** service (Swift / SwiftUI).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── {{ name }}/
│   ├── App/                          ← App entry point, DI
│   │   ├── {{ name }}App.swift
│   │   └── DependencyContainer.swift
│   ├── Features/                     ← feature-first modules
│   │   └── {FeatureName}/
│   │       ├── Views/
│   │       ├── ViewModels/
│   │       └── Models/
│   ├── Shared/                       ← cross-feature reusables
│   │   ├── Components/              ← reusable SwiftUI views
│   │   ├── Modifiers/               ← custom ViewModifiers
│   │   ├── Extensions/
│   │   └── Styles/                  ← custom ButtonStyle, etc.
│   ├── Services/                     ← API clients, platform services
│   │   └── {Resource}Service.swift
│   ├── Models/                       ← shared data models
│   ├── Networking/                   ← HTTP client, interceptors
│   ├── Resources/                    ← Assets.xcassets, Localizable
│   └── Utilities/                    ← pure helper functions
├── {{ name }}Tests/
├── {{ name }}UITests/
├── {{ name }}.xcodeproj
└── Package.swift                     ← SPM dependencies (if used)
```

**Rules:**
- Feature-first grouping. Each feature owns its views, view models, and models.
- One type per file. File name matches type name (PascalCase).
- Promote components to `Shared/` when used by 2+ features.
- Custom `ViewModifier`s go in `Shared/Modifiers/`.
- `Services/` contains only API/platform calls — no UI logic.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | PascalCase matching type | `UserProfileView.swift` |
| Views | PascalCase + `View` suffix | `UserCardView`, `ProfileHeaderView` |
| ViewModels | PascalCase + `ViewModel` | `UserListViewModel` |
| Modifiers | PascalCase + `Modifier` | `CardShadowModifier` |
| Styles | PascalCase + style type | `PrimaryButtonStyle` |
| Functions / Methods | camelCase | `fetchUser()`, `formatDate()` |
| Properties | camelCase | `isLoading`, `userName` |
| Constants | camelCase | `defaultPadding`, `maxRetryCount` |
| Enums | PascalCase, cases camelCase | `enum Route { case profile }` |
| Boolean properties | `is`/`has`/`should` prefix | `isActive`, `hasError` |

---

## 3. Type System

Same Swift type system as UIKit — **statically typed, null-safe**.

```swift
// Prefer explicit types for public APIs
func fetchUser(id: String) async throws -> User { ... }

// OK to infer for local variables
let user = try await userService.getById(id)
```

**SwiftUI-specific rules:**
- Prefer `struct` for Views — SwiftUI views are always value types.
- Use `enum` with associated values for navigation routes and finite states.
- Use `@Observable` (iOS 17+) or `ObservableObject` for view models.
- Prefer `let` over `var`. Use `@State` / `@Binding` for mutable view state.

```swift
// Navigation routes
enum Route: Hashable {
    case userProfile(userId: String)
    case settings
}

// Loading state
enum LoadingState<T> {
    case idle
    case loading
    case loaded(T)
    case failed(Error)
}
```

---

## 4. Import Order

```swift
// 1. SwiftUI / Foundation
import SwiftUI
import Foundation

// 2. Apple frameworks
import Combine
import PhotosUI

// 3. Third-party
import Kingfisher

// 4. Internal modules (if modularized)
import NetworkingModule
import SharedUI
```

**Rules:**
- Sort alphabetically within each group.
- `import SwiftUI` replaces `import UIKit` — never import both in the same file.
- `@testable import` only in test files.

---

## 5. SwiftUI Patterns

### View composition

```swift
struct UserCardView: View {
    let user: User
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                AsyncImage(url: user.avatarURL) { image in
                    image.resizable().frame(width: 40, height: 40)
                } placeholder: {
                    ProgressView()
                }
                Text(user.name)
                    .font(.headline)
            }
            .padding()
        }
    }
}
```

### Extract subviews

```swift
// ✅ Extract as computed properties for small sections
var body: some View {
    VStack {
        headerSection
        contentSection
    }
}

private var headerSection: some View {
    Text("Header").font(.title)
}

// ✅ Extract as separate View structs for reusable/complex sections
struct ProfileHeaderView: View { ... }
```

### Custom ViewModifiers

```swift
struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding()
            .background(.white)
            .cornerRadius(12)
            .shadow(radius: 4)
    }
}

extension View {
    func cardStyle() -> some View {
        modifier(CardStyle())
    }
}
```

**Rules:**
- Keep `body` focused — extract at 30+ lines.
- Use computed properties for small non-reusable sections.
- Use separate `View` structs for reusable or complex sections.
- Prefer custom `ViewModifier` over repeated inline modifiers.
- Never put business logic in views — delegate to ViewModel.

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **SwiftLint** | Linter | `.swiftlint.yml` |
| **swift-format** | Formatter (Apple) | `.swift-format` |

```yaml
# .swiftlint.yml
opt_in_rules:
  - force_unwrapping
  - empty_count
  - closure_spacing
disabled_rules:
  - trailing_whitespace
excluded:
  - .build
```

```bash
swiftlint lint --strict
swift-format format --recursive Sources/
```

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in View `body` | Extract to ViewModel |
| Massive `body` (50+ lines) | Extract subviews / ViewModifiers |
| `@State` for shared state | `@StateObject` / `@Observable` in ViewModel |
| Force unwraps (`!`) | `guard let` / `if let` / nil coalescing |
| Hard-coded colors/fonts | Use `Color("name")` / `Font` from design system |
| Ignoring `@MainActor` | Mark ViewModel `@MainActor` for UI updates |
| `print()` for logging | Use structured logger (→ skills/common/observability/) |
| Deep view nesting | Extract and compose smaller views |
