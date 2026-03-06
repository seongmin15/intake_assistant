# Testing — Jetpack Compose

> This skill defines testing rules for the **{{ name }}** service (Kotlin / Jetpack Compose).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify ViewModels emit correct states with valid input.
- Confirm key composables render correct content.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: ViewModels emit correct states, composables render data.
- Edge cases: empty data, loading/error states, null values, configuration changes.
- Failure cases: API errors, network failures, permission denials.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: ViewModels emit correct states, composables render data.
- Edge cases: empty data, loading/error states, null values, configuration changes.
- Failure cases: API errors, network failures, permission denials.
- Security cases: token tampering, deep link injection, insecure storage access.
{% endif %}

---

## 2. Test Structure

```
app/src/test/                             ← unit tests (JVM)
├── java/com/company/{{ name }}/
│   ├── features/
│   │   └── auth/
│   │       └── viewmodel/
│   │           └── LoginViewModelTest.kt
│   ├── data/
│   │   └── repository/
│   │       └── UserRepositoryTest.kt
│   └── helpers/
│       ├── MainDispatcherRule.kt
│       └── Fakes.kt

app/src/androidTest/                      ← instrumented tests (device)
├── java/com/company/{{ name }}/
│   ├── features/
│   │   └── auth/
│   │       └── ui/
│   │           └── LoginScreenTest.kt
│   └── flows/
│       └── LoginFlowTest.kt
```

**Naming:** `class {Type}Test` → `fun {behavior}_when_{condition}()`

---

## 3. ViewModel Testing

Same approach as Android Views — **JUnit + Turbine + coroutines-test**.

```kotlin
@OptIn(ExperimentalCoroutinesApi::class)
class UserListViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var fakeRepository: FakeUserRepository
    private lateinit var sut: UserListViewModel

    @Before
    fun setUp() {
        fakeRepository = FakeUserRepository()
        sut = UserListViewModel(fakeRepository)
    }

    @Test
    fun `loadUsers should emit Success when repository returns data`() = runTest {
        fakeRepository.stubbedUsers = listOf(User(id = "1", name = "Alice"))

        sut.uiState.test {
            sut.loadUsers()
            assertThat(awaitItem()).isInstanceOf(UiState.Loading::class.java)
            val success = awaitItem() as UiState.Success
            assertThat(success.data).hasSize(1)
            assertThat(success.data.first().name).isEqualTo("Alice")
        }
    }

    @Test
    fun `loadUsers should emit Error when repository fails`() = runTest {
        fakeRepository.shouldFail = true

        sut.uiState.test {
            sut.loadUsers()
            assertThat(awaitItem()).isInstanceOf(UiState.Loading::class.java)
            assertThat(awaitItem()).isInstanceOf(UiState.Error::class.java)
        }
    }
}
```

**Rules:**
- Always use `MainDispatcherRule` — ViewModel tests fail without it.
- Use Turbine's `.test { }` to assert Flow emissions in order.
- Use `runTest` for all coroutine-based tests.
- ViewModel tests are JVM-only (`src/test/`) — no emulator needed.

---

## 4. Composable Testing

Use **Compose UI Test** (instrumented or Robolectric).

```kotlin
class UserCardTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun should_display_user_name() {
        val user = User(id = "1", name = "Alice")

        composeTestRule.setContent {
            UserCard(user = user, onClick = {})
        }

        composeTestRule.onNodeWithText("Alice").assertIsDisplayed()
    }

    @Test
    fun should_call_onClick_when_tapped() {
        var clicked = false
        val user = User(id = "1", name = "Alice")

        composeTestRule.setContent {
            UserCard(user = user, onClick = { clicked = true })
        }

        composeTestRule.onNodeWithText("Alice").performClick()
        assertThat(clicked).isTrue()
    }
}
```

### Testing stateless Content composables

```kotlin
class UserListContentTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun should_show_loading_indicator_when_loading() {
        composeTestRule.setContent {
            UserListContent(
                uiState = UiState.Loading,
                onRetry = {},
                onUserClick = {},
            )
        }

        composeTestRule.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate))
            .assertIsDisplayed()
    }

    @Test
    fun should_show_error_message_when_failed() {
        composeTestRule.setContent {
            UserListContent(
                uiState = UiState.Error("Network error"),
                onRetry = {},
                onUserClick = {},
            )
        }

        composeTestRule.onNodeWithText("Network error").assertIsDisplayed()
    }
}
```

**Rules:**
- Test **Content composables** (stateless) — not Screen composables (ViewModel-wired).
- Use `createComposeRule()` for composable-only tests (no Activity).
- Query by text, testTag, content description, or semantics — not by Composable type.
- Use `testTag` for elements without visible text.

```kotlin
// In production code
Box(modifier = Modifier.testTag("loading-indicator")) { ... }

// In test
composeTestRule.onNodeWithTag("loading-indicator").assertIsDisplayed()
```

---

## 5. Mocking Rules

### Prefer Fakes over Mocks (same as Android Views)

```kotlin
class FakeUserRepository : UserRepository {
    var stubbedUsers: List<User> = emptyList()
    var shouldFail = false

    override suspend fun getUsers(): Result<List<User>> {
        if (shouldFail) return Result.failure(IOException("Network error"))
        return Result.success(stubbedUsers)
    }
}
```

**What to mock:**
- Analytics / crash reporting SDKs.
- Platform APIs (via interface wrappers).
- Complex third-party dependencies.

**What NOT to mock:**
- Data classes, value objects — use real instances.
- Composables — render real composables with `setContent { }`.
- Repositories in ViewModel tests — use Fakes.
- Navigation — test via UI assertions, not nav controller mocking.

---

## 6. Navigation Testing

```kotlin
class NavigationTest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun should_navigate_to_detail_when_item_clicked() {
        // Given: on home screen
        composeTestRule.onNodeWithTag("user-item-1").performClick()

        // Then: detail screen is shown
        composeTestRule.onNodeWithText("User Detail").assertIsDisplayed()
    }

    @Test
    fun should_navigate_back_from_detail() {
        composeTestRule.onNodeWithTag("user-item-1").performClick()
        composeTestRule.onNodeWithContentDescription("Back").performClick()

        composeTestRule.onNodeWithText("User List").assertIsDisplayed()
    }
}
```

**Rules:**
- Test navigation by asserting visible content — not by inspecting `NavController` state.
- Use `createAndroidComposeRule<Activity>()` for full navigation tests.
- E2E navigation tests are instrumented (`src/androidTest/`).

---

## 7. E2E Testing

```kotlin
@HiltAndroidTest
@LargeTest
class LoginFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun should_navigate_to_dashboard_after_login() {
        composeTestRule.onNodeWithTag("email-input").performTextInput("user@test.com")
        composeTestRule.onNodeWithTag("password-input").performTextInput("password")
        composeTestRule.onNodeWithTag("login-button").performClick()

        composeTestRule.waitUntil(5000) {
            composeTestRule.onAllNodesWithText("Dashboard").fetchSemanticsNodes().isNotEmpty()
        }
        composeTestRule.onNodeWithText("Dashboard").assertIsDisplayed()
    }
}
```

**Rules:**
- E2E tests cover critical user flows only (login, main feature, checkout).
- Run on CI with emulator — not on every commit, but on PR and release.
- Use `testTag` for selectors — not display text (text changes with localization).
- Use `waitUntil` for async UI transitions.

---

## 8. Test Execution

```bash
# Unit tests (JVM)
./gradlew test

# Unit tests with coverage
./gradlew testDebugUnitTest jacocoTestReport

# Specific test class
./gradlew test --tests "com.company.app.features.auth.viewmodel.LoginViewModelTest"

# Compose UI tests (requires emulator/device)
./gradlew connectedAndroidTest

# Lint
./gradlew lint
```
