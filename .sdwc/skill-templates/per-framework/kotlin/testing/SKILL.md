# Testing — Kotlin (Android)

> This skill defines testing rules for the **{{ name }}** service (Kotlin / Android Views).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify ViewModels emit correct states with valid input.
- Confirm key user interactions trigger expected behavior.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: ViewModels emit correct states, UI displays data.
- Edge cases: empty data, loading/error states, null values, configuration changes.
- Failure cases: API errors, network failures, permission denials.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: ViewModels emit correct states, UI displays data.
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
│   │           └── LoginFragmentTest.kt
│   └── flows/
│       └── LoginFlowTest.kt
```

**Naming:** `class {Type}Test` → `fun {behavior}_when_{condition}()`

---

## 3. ViewModel Testing

Use **JUnit** + **Turbine** (for Flow testing) + **coroutines-test**.

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

**MainDispatcherRule (required for ViewModel tests):**

```kotlin
@OptIn(ExperimentalCoroutinesApi::class)
class MainDispatcherRule(
    private val dispatcher: TestDispatcher = UnconfinedTestDispatcher()
) : TestWatcher() {
    override fun starting(description: Description) {
        Dispatchers.setMain(dispatcher)
    }
    override fun finished(description: Description) {
        Dispatchers.resetMain()
    }
}
```

**Rules:**
- Always use `MainDispatcherRule` — ViewModel tests fail without it.
- Use Turbine's `.test { }` to assert Flow emissions in order.
- Use `runTest` for all coroutine-based tests.

---

## 4. Repository / Data Layer Testing

```kotlin
class UserRepositoryTest {

    private lateinit var fakeApi: FakeUserApi
    private lateinit var fakeDao: FakeUserDao
    private lateinit var sut: UserRepository

    @Before
    fun setUp() {
        fakeApi = FakeUserApi()
        fakeDao = FakeUserDao()
        sut = UserRepository(fakeApi, fakeDao)
    }

    @Test
    fun `getUsers should return cached data when available`() = runTest {
        fakeDao.stubbedUsers = listOf(UserEntity(id = "1", name = "Alice"))

        val result = sut.getUsers()

        assertThat(result.isSuccess).isTrue()
        assertThat(result.getOrNull()).hasSize(1)
    }

    @Test
    fun `getUsers should fetch from API when cache is empty`() = runTest {
        fakeApi.stubbedUsers = listOf(UserDto(id = "1", name = "Alice"))

        val result = sut.getUsers()

        assertThat(result.isSuccess).isTrue()
        assertThat(fakeApi.fetchCallCount).isEqualTo(1)
    }
}
```

---

## 5. Mocking Rules

### Prefer Fakes over Mocks

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

### When Mockito/MockK is needed

```kotlin
// MockK example
@Test
fun `should call analytics on login`() {
    val analytics = mockk<AnalyticsService>(relaxed = true)
    val sut = LoginViewModel(fakeAuthRepo, analytics)

    sut.login("user@test.com", "password")

    verify { analytics.logEvent("login_success") }
}
```

**What to mock:**
- Analytics / crash reporting SDKs.
- Platform APIs (via interface wrappers).
- Complex third-party dependencies.

**What NOT to mock:**
- Data classes, value objects — use real instances.
- Repositories in ViewModel tests — use Fakes.
- Coroutine dispatchers — use `MainDispatcherRule` + `runTest`.

---

## 6. Fragment / UI Testing

Use **Espresso** + **FragmentScenario**.

```kotlin
@HiltAndroidTest
class UserProfileFragmentTest {

    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    @Test
    fun should_display_user_name() {
        launchFragmentInHiltContainer<UserProfileFragment>(
            bundleOf("userId" to "1")
        )

        onView(withId(R.id.nameText))
            .check(matches(withText("Alice")))
    }

    @Test
    fun should_show_error_when_load_fails() {
        // inject failing repository via Hilt test module
        launchFragmentInHiltContainer<UserProfileFragment>()

        onView(withId(R.id.errorText))
            .check(matches(isDisplayed()))
    }
}
```

**Rules:**
- Use `launchFragmentInHiltContainer` for Hilt-injected Fragments.
- Test UI output (text, visibility) — not internal Fragment state.
- Use `IdlingResource` for async operations in Espresso tests.

---

## 7. E2E Testing

Use **Espresso** for full flow tests or **UI Automator** for cross-app scenarios.

```kotlin
@HiltAndroidTest
@LargeTest
class LoginFlowTest {

    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    @Test
    fun should_navigate_to_dashboard_after_login() {
        onView(withId(R.id.emailInput)).perform(typeText("user@test.com"))
        onView(withId(R.id.passwordInput)).perform(typeText("password"))
        onView(withId(R.id.loginButton)).perform(click())

        onView(withText("Dashboard")).check(matches(isDisplayed()))
    }
}
```

**Rules:**
- E2E tests cover critical user flows only (login, main feature, checkout).
- Run on CI with emulator — not on every commit, but on PR and release.
- Use resource IDs for selectors — not text (text changes with localization).

---

## 8. Test Execution

```bash
# Unit tests (JVM)
./gradlew test

# Unit tests with coverage
./gradlew testDebugUnitTest jacocoTestReport

# Specific test class
./gradlew test --tests "com.company.app.features.auth.viewmodel.LoginViewModelTest"

# Instrumented tests (requires emulator/device)
./gradlew connectedAndroidTest

# Lint
./gradlew lint
```
