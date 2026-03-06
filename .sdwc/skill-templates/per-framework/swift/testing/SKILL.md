# Testing — Swift (UIKit)

> This skill defines testing rules for the **{{ name }}** service (Swift / UIKit).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify view controllers load and display correct data.
- Confirm key user interactions trigger expected behavior.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: views load and interactions work.
- Edge cases: empty data, loading/error states, nil optionals, different screen sizes.
- Failure cases: API errors, network failures, permission denials.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: views load and interactions work.
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
│       ├── ViewModels/
│       │   └── LoginViewModelTests.swift
│       └── ViewControllers/
│           └── LoginViewControllerTests.swift
├── Services/
│   └── UserServiceTests.swift
├── Networking/
│   └── APIClientTests.swift
├── Helpers/
│   ├── MockURLProtocol.swift
│   └── XCTestCase+Helpers.swift
└── Mocks/
    └── MockUserService.swift

{{ name }}UITests/
└── Flows/
    └── LoginFlowUITests.swift
```

**Naming:** `final class {Type}Tests: XCTestCase` → `func test_{behavior}_when_{condition}()`

---

## 3. Unit Testing (ViewModels / Services)

Use **XCTest** (built-in).

```swift
import XCTest
@testable import {{ name }}

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
    }

    func test_loadUsers_shouldSetError_whenAPIFails() async {
        mockService.stubbedError = APIError.networkFailure

        await sut.loadUsers()

        XCTAssertTrue(sut.users.isEmpty)
        XCTAssertNotNil(sut.error)
    }
}
```

**Rules:**
- Use `setUp()` / `tearDown()` to create and nil out the system under test (`sut`).
- One assertion concept per test — multiple `XCTAssert` calls are fine if testing one behavior.
- Use `async` test methods for async code — no `XCTestExpectation` needed for async/await.

---

## 4. ViewController Testing

```swift
final class UserProfileViewControllerTests: XCTestCase {
    private var sut: UserProfileViewController!

    override func setUp() {
        super.setUp()
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        sut = storyboard.instantiateViewController(
            withIdentifier: "UserProfile"
        ) as? UserProfileViewController
        sut.loadViewIfNeeded()  // triggers viewDidLoad
    }

    func test_viewDidLoad_shouldShowUserName() {
        sut.configure(with: User(id: "1", name: "Alice"))
        XCTAssertEqual(sut.nameLabel.text, "Alice")
    }
}
```

**Programmatic UI (no storyboard):**

```swift
override func setUp() {
    super.setUp()
    let viewModel = MockUserProfileViewModel()
    sut = UserProfileViewController(viewModel: viewModel)
    sut.loadViewIfNeeded()
}
```

**Rules:**
- Call `loadViewIfNeeded()` to trigger the view lifecycle.
- Test VC outputs (labels, visibility, navigation calls) — not internal state.
- Prefer programmatic VC creation with injected dependencies over storyboard.

---

## 5. Mocking Rules

### Protocol-based mocks

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

```swift
final class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.requestHandler else { return }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
```

**What to mock:**
- Network layer (via `MockURLProtocol` or protocol-based service mocks).
- Platform APIs (location, camera, keychain).
- External SDKs (analytics, crash reporting).

**What NOT to mock:**
- Value types (structs, enums) — use real instances.
- Simple utilities — test with real implementations.

---

## 6. UI Testing

Use **XCUITest** (built-in).

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

**Rules:**
- UI tests cover critical user flows only (login, main feature, checkout).
- Use accessibility identifiers for element queries — not labels.
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

# Via swift CLI (SPM projects)
swift test

# With coverage
xcodebuild test -scheme {{ name }} -enableCodeCoverage YES
```
