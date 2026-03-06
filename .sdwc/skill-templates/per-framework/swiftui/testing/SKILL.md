# Testing — SwiftUI

> This skill defines testing rules for the **{{ name }}** service (Swift / SwiftUI).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify ViewModels emit correct states with valid input.
- Confirm key user interactions trigger expected state changes.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: ViewModels emit correct states, views render data.
- Edge cases: empty data, loading/error states, nil optionals, different screen sizes.
- Failure cases: API errors, network failures, permission denials.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: ViewModels emit correct states, views render data.
- Edge cases: empty data, loading/error states, nil optionals, different screen sizes.
- Failure cases: API errors, network failures, permission denials.
- Security cases: token tampering, deep link injection, keychain access failures.
{% endif %}

---

## 2. Test Structure

```
{{ name }}Tests/
├── Features/
│   └── Auth/
│       └── ViewModels/
│           └── LoginViewModelTests.swift
├── Services/
│   └── UserServiceTests.swift
├── Networking/
│   └── APIClientTests.swift
├── Helpers/
│   └── XCTestCase+Helpers.swift
└── Mocks/
    └── MockUserService.swift

{{ name }}UITests/
└── Flows/
    └── LoginFlowUITests.swift
```

**Naming:** `final class {Type}Tests: XCTestCase` → `func test_{behavior}_when_{condition}()`

---

## 3. ViewModel Testing (Primary Focus)

SwiftUI encourages testing logic through ViewModels — not views directly.

```swift
import XCTest
@testable import {{ name }}

@MainActor
final class UserListViewModelTests: XCTestCase {
    private var sut: UserListViewModel!
    private var mockService: MockUserService!

    override func setUp() {
        super.setUp()
        mockService = MockUserService()
        sut = UserListViewModel(userService: mockService)
    }

    override func tearDown() {
        sut = nil
        mockService = nil
        super.tearDown()
    }

    func test_loadUsers_shouldPopulateUsers_whenAPISucceeds() async {
        mockService.stubbedUsers = [User(id: "1", name: "Alice")]

        await sut.loadUsers()

        XCTAssertEqual(sut.users.count, 1)
        XCTAssertEqual(sut.users.first?.name, "Alice")
        XCTAssertFalse(sut.isLoading)
    }

    func test_loadUsers_shouldSetError_whenAPIFails() async {
        mockService.stubbedError = APIError.networkFailure

        await sut.loadUsers()

        XCTAssertTrue(sut.users.isEmpty)
        XCTAssertNotNil(sut.errorMessage)
    }
}
```

**Rules:**
- Mark test class `@MainActor` when testing `@MainActor` ViewModels.
- Use `setUp()` / `tearDown()` to create and nil out the system under test.
- Use `async` test methods for async code — no `XCTestExpectation` needed.
- Test ViewModel **outputs** (published properties) after calling **inputs** (methods).

---

## 4. View Testing

SwiftUI views are declarative structs — test logic in ViewModels, verify views via UI tests or snapshots.

### Preview as visual verification

```swift
#Preview("UserCard - Normal") {
    UserCardView(user: .mock, onTap: {})
}

#Preview("UserCard - Long Name") {
    UserCardView(user: .init(id: "1", name: "Very Long Username That Should Truncate"), onTap: {})
}
```

### Snapshot testing (optional)

```swift
import SnapshotTesting

final class UserCardSnapshotTests: XCTestCase {
    func test_userCard_defaultAppearance() {
        let view = UserCardView(user: .mock, onTap: {})
        assertSnapshot(of: view, as: .image(layout: .device(config: .iPhone13)))
    }
}
```

**Rules:**
- Prefer testing logic in ViewModels over testing views directly.
- Use **Previews** for visual verification during development.
- Use **snapshot tests** for design-critical components (optional).
- Do NOT test SwiftUI view body structure — it's an implementation detail.

---

## 5. Mocking Rules

### Protocol-based mocks (same as UIKit)

```swift
protocol UserServiceProtocol {
    func fetchAll() async throws -> [User]
    func getById(_ id: String) async throws -> User
}

final class MockUserService: UserServiceProtocol {
    var stubbedUsers: [User] = []
    var stubbedError: Error?
    private(set) var fetchAllCallCount = 0

    func fetchAll() async throws -> [User] {
        fetchAllCallCount += 1
        if let error = stubbedError { throw error }
        return stubbedUsers
    }

    func getById(_ id: String) async throws -> User {
        if let error = stubbedError { throw error }
        return stubbedUsers.first { $0.id == id }!
    }
}
```

### HTTP mocking

Use `MockURLProtocol` (same pattern as UIKit — see swift/testing).

**What to mock:**
- Network layer (via protocol-based service mocks).
- Platform APIs (location, camera, keychain).
- External SDKs (analytics, crash reporting).

**What NOT to mock:**
- Value types (structs, enums) — use real instances with `.mock` factory.
- SwiftUI views — test indirectly via ViewModels or UI tests.

---

## 6. UI Testing

Use **XCUITest** (same framework as UIKit).

```swift
final class LoginFlowUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launch()
    }

    func test_loginFlow_shouldShowDashboard_whenCredentialsValid() {
        app.textFields["email-input"].tap()
        app.textFields["email-input"].typeText("user@test.com")
        app.secureTextFields["password-input"].tap()
        app.secureTextFields["password-input"].typeText("password")
        app.buttons["login-button"].tap()

        XCTAssertTrue(app.staticTexts["Dashboard"].waitForExistence(timeout: 5))
    }
}
```

**SwiftUI accessibility identifiers:**

```swift
TextField("Email", text: $email)
    .accessibilityIdentifier("email-input")

Button("Login") { viewModel.login() }
    .accessibilityIdentifier("login-button")
```

**Rules:**
- UI tests cover critical user flows only (login, main feature, checkout).
- Use `.accessibilityIdentifier()` for element queries — not display text.
- Run on CI with simulator — not on every commit, but on PR and release.
- Use `waitForExistence(timeout:)` for async UI transitions.

---

## 7. Test Execution

```bash
# All unit tests
xcodebuild test -scheme {{ name }} -destination 'platform=iOS Simulator,name=iPhone 16'

# Specific test class
xcodebuild test -scheme {{ name }} -only-testing:{{ name }}Tests/UserListViewModelTests

# UI tests
xcodebuild test -scheme {{ name }}UITests -destination 'platform=iOS Simulator,name=iPhone 16'

# With coverage
xcodebuild test -scheme {{ name }} -enableCodeCoverage YES

# Via swift CLI (SPM projects)
swift test
```
