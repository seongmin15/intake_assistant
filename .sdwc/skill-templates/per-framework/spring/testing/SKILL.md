# Testing — Spring Boot

> This skill defines testing rules for the **{{ name }}** service (Spring Boot / Java).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify the main success scenario for each endpoint/function.
- Confirm correct status codes and response shapes.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: main success scenario.
- Edge cases: boundary values, empty inputs, max-length, pagination limits.
- Failure cases: invalid input (400), unauthorized (401), not found (404), conflict (409).
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: main success scenario.
- Edge cases: boundary values, empty inputs, max-length, pagination limits.
- Failure cases: invalid input (400), unauthorized (401), not found (404), conflict (409).
- Security cases: injection attempts, token tampering, privilege escalation, IDOR, CSRF.
{% endif %}

---

## 2. Test Structure

```
src/test/java/com/{org}/{service}/
├── unit/                          ← service/repository tests (mocked deps)
│   └── {Resource}ServiceTest.java
├── integration/                   ← controller tests with Spring context
│   └── {Resource}ControllerTest.java
└── e2e/                           ← full application tests
    └── {Flow}E2ETest.java
```

**Naming:** `{ClassName}Test` for unit, `{ClassName}IntegrationTest` or `{ClassName}E2ETest` for integration/e2e.

Method naming: `should{Expected}_when{Condition}`

```java
// ✅ clear intent
@Test
void shouldReturnUser_whenValidId() { ... }

@Test
void shouldThrowNotFoundException_whenUserDoesNotExist() { ... }

// ❌ vague
@Test
void testGetUser() { ... }
```

**Pattern:** Arrange → Act → Assert (Given-When-Then).

```java
@Test
void shouldReturnUser_whenValidId() {
    // Arrange
    var user = new User(UUID.randomUUID(), "test@example.com", "Test");
    when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

    // Act
    var result = userService.findById(user.getId());

    // Assert
    assertThat(result.email()).isEqualTo("test@example.com");
}
```

---

## 3. Unit Testing

Use JUnit 5 + Mockito. No Spring context loaded.

```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock
    private UserRepository userRepository;

    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private UserServiceImpl userService;

    @Test
    void shouldReturnUser_whenFound() {
        var user = new User(UUID.randomUUID(), "test@example.com", "Test");
        var response = new UserResponse(user.getId(), "test@example.com", "Test");
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userMapper.toResponse(user)).thenReturn(response);

        var result = userService.findById(user.getId());

        assertThat(result.email()).isEqualTo("test@example.com");
        verify(userRepository).findById(user.getId());
    }

    @Test
    void shouldThrow_whenNotFound() {
        var id = UUID.randomUUID();
        when(userRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.findById(id))
            .isInstanceOf(ResourceNotFoundException.class);
    }
}
```

---

## 4. Integration Testing

### Controller tests with `@WebMvcTest`

```java
@WebMvcTest(UserController.class)
class UserControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Test
    void shouldReturn200_whenUserExists() throws Exception {
        var response = new UserResponse(UUID.randomUUID(), "test@example.com", "Test");
        when(userService.findById(any())).thenReturn(response);

        mockMvc.perform(get("/api/v1/users/{id}", response.id()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("test@example.com"));
    }

    @Test
    void shouldReturn400_whenInvalidInput() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email": "not-an-email", "name": ""}
                    """))
            .andExpect(status().isBadRequest());
    }
}
```

### Repository tests with `@DataJpaTest`

```java
@DataJpaTest
class UserRepositoryTest {
    @Autowired
    private UserRepository userRepository;

    @Test
    void shouldFindByEmail() {
        var user = new User(null, "test@example.com", "Test");
        userRepository.save(user);

        var found = userRepository.findByEmail("test@example.com");

        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("Test");
    }
}
```

### Full application tests with `@SpringBootTest`

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class UserE2ETest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldCreateAndRetrieveUser() throws Exception {
        var createResult = mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email": "test@example.com", "name": "Test User"}
                    """))
            .andExpect(status().isCreated())
            .andReturn();

        var id = JsonPath.read(createResult.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(get("/api/v1/users/{id}", id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("test@example.com"));
    }
}
```

---

## 5. Mocking Rules

**What to mock:**
- External API calls (use `@MockBean` or WireMock).
- Time-dependent logic (`Clock` injection).
- File storage operations.
- Message queue publishers.

**What NOT to mock:**
- Database in `@DataJpaTest` — uses embedded H2 or Testcontainers.
- Bean Validation — let it run to catch constraint regressions.
- Spring Security filters in e2e tests.
- Exception handlers in integration tests.

**Testcontainers for real DB:**

```java
@SpringBootTest
@Testcontainers
class UserIntegrationTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
}
```

---

## 6. Test Execution

{% if build_tool == "gradle" %}
```bash
# All tests
./gradlew test

# Unit tests only
./gradlew test --tests '*unit*'

# Integration tests
./gradlew test --tests '*integration*'

# Single test class
./gradlew test --tests 'com.example.myapi.unit.UserServiceTest'

# With coverage (JaCoCo)
./gradlew test jacocoTestReport
```
{% endif %}
{% if build_tool == "maven" %}
```bash
# All tests
mvn test

# Unit tests only (Surefire)
mvn test -Dtest='**/unit/**'

# Integration tests (Failsafe)
mvn verify

# Single test class
mvn test -Dtest=UserServiceTest

# With coverage (JaCoCo)
mvn test jacoco:report
```
{% endif %}

**Rules:**
- Unit tests run without external dependencies.
- Integration tests use `@SpringBootTest` or slice annotations (`@WebMvcTest`, `@DataJpaTest`).
- Use Testcontainers for real database testing in CI.
- All tests must pass before committing.
