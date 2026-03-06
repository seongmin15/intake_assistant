# Coding Standards — Swift (UIKit)

> This skill defines coding rules for the **{{ name }}** service (Swift / UIKit).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── {{ name }}/
│   ├── App/                          ← AppDelegate, SceneDelegate, DI
│   │   ├── AppDelegate.swift
│   │   ├── SceneDelegate.swift
│   │   └── DependencyContainer.swift
│   ├── Features/                     ← feature-first modules
│   │   └── {FeatureName}/
│   │       ├── ViewControllers/
│   │       ├── Views/
│   │       ├── ViewModels/
│   │       └── Models/
│   ├── Shared/                       ← cross-feature reusables
│   │   ├── Views/
│   │   ├── Extensions/
│   │   └── Protocols/
│   ├── Services/                     ← API clients, platform services
│   │   └── {Resource}Service.swift
│   ├── Models/                       ← shared data models
│   ├── Networking/                   ← HTTP client, interceptors
│   ├── Resources/                    ← Assets.xcassets, Localizable.strings
│   └── Utilities/                    ← pure helper functions
├── {{ name }}Tests/
├── {{ name }}UITests/
├── {{ name }}.xcodeproj
└── Package.swift                     ← SPM dependencies (if used)
```

**Rules:**
- Feature-first grouping. Each feature owns its VCs, views, view models, and models.
- One type per file. File name matches type name (PascalCase).
- Promote views/utilities to `Shared/` when used by 2+ features.
- `Services/` contains only API/platform calls — no UI logic.
- Group files in Xcode project navigator to match folder structure.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | PascalCase matching type | `UserProfileViewController.swift` |
| Classes / Structs | PascalCase | `UserCard`, `AuthService` |
| Protocols | PascalCase + `-able`/`-ing`/`-Protocol` | `Configurable`, `NetworkingProtocol` |
| Functions / Methods | camelCase | `fetchUser()`, `formatDate()` |
| Variables / Properties | camelCase | `isLoading`, `userName` |
| Constants | camelCase | `defaultPadding`, `maxRetryCount` |
| Enums | PascalCase, cases camelCase | `enum AuthStatus { case loggedIn }` |
| Boolean properties | `is`/`has`/`should` prefix | `isActive`, `hasError` |
| Delegate methods | Start with sender type | `tableView(_:didSelectRowAt:)` |
| IBOutlets / IBActions | camelCase, suffix with type | `nameLabel`, `submitButtonTapped` |

---

## 3. Type System

Swift is **statically typed with powerful type inference**.

```swift
// Prefer explicit types for public APIs
func fetchUser(id: String) -> AnyPublisher<User, APIError> { ... }

// OK to infer for local variables
let user = try await userService.getById(id)
var count = 0
```

**Rules:**
- Prefer `struct` over `class` unless reference semantics are needed.
- Use `enum` with associated values for finite state sets.
- Use `Result<Success, Failure>` or async/await for error handling — not optionals for errors.
- Prefer protocols + extensions over class inheritance.
- Use `typealias` for complex closure signatures.

```swift
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
// 1. Foundation / UIKit
import Foundation
import UIKit

// 2. Apple frameworks
import Combine
import CoreLocation

// 3. Third-party
import Alamofire
import SnapKit

// 4. Internal modules (if modularized)
import NetworkingModule
import SharedUI
```

**Rules:**
- Sort alphabetically within each group.
- `@testable import` only in test files.
- Minimize framework imports — import only what is used.

---

## 5. Swift-specific Patterns

### MVVM with protocols

```swift
protocol UserListViewModelProtocol: AnyObject {
    var users: [User] { get }
    var onUpdate: (() -> Void)? { get set }
    func loadUsers()
}

final class UserListViewModel: UserListViewModelProtocol {
    private let userService: UserServiceProtocol
    private(set) var users: [User] = []
    var onUpdate: (() -> Void)?

    init(userService: UserServiceProtocol) {
        self.userService = userService
    }

    func loadUsers() {
        Task {
            users = try await userService.fetchAll()
            onUpdate?()
        }
    }
}
```

### Prefer `final` classes

```swift
// ✅ Mark classes final by default
final class UserProfileViewController: UIViewController { ... }
```

### Access control

```swift
// Explicit access control for all types and members
public struct User { ... }           // cross-module
internal final class ViewModel { ... } // default, within module
private var cache: [String: Data] = [:] // within file
```

**Rules:**
- Mark all classes `final` unless designed for subclassing.
- Use `private` by default, widen only when needed.
- Avoid force unwraps (`!`) — use `guard let` or `if let`.
- Prefer `guard` for early exits, `if let` for conditional paths.

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
  - Pods
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
| Force unwraps (`!`) | `guard let` / `if let` / nil coalescing |
| Massive ViewController | Extract to ViewModel + child VCs |
| Retain cycles in closures | `[weak self]` in escaping closures |
| Stringly-typed identifiers | Enums or constants for cell IDs, segues |
| God objects / singletons | Protocol-based DI |
| `print()` for logging | Use structured logger (→ skills/common/observability/) |
| Nested callbacks | async/await or Combine chains |
| Ignoring `@MainActor` | Mark UI-updating code `@MainActor` |
