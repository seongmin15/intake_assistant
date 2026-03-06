# Coding Standards — Spring Boot

> This skill defines coding rules for the **{{ name }}** service (Spring Boot / Java).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── main/
│   │   ├── java/com/{org}/{service}/    ← base package
│   │   │   ├── Application.java         ← @SpringBootApplication entry
│   │   │   ├── controller/              ← REST controllers (thin layer)
│   │   │   │   └── {Resource}Controller.java
│   │   │   ├── service/                 ← business logic
│   │   │   │   ├── {Resource}Service.java        (interface)
│   │   │   │   └── {Resource}ServiceImpl.java     (implementation)
│   │   │   ├── repository/              ← data access (Spring Data JPA)
│   │   │   │   └── {Resource}Repository.java
│   │   │   ├── entity/                  ← JPA entities
│   │   │   │   └── {Resource}.java
│   │   │   ├── dto/                     ← request/response DTOs
│   │   │   │   ├── {Resource}CreateRequest.java
│   │   │   │   ├── {Resource}UpdateRequest.java
│   │   │   │   └── {Resource}Response.java
│   │   │   ├── mapper/                  ← entity ↔ DTO mappers
│   │   │   │   └── {Resource}Mapper.java
│   │   │   ├── config/                  ← @Configuration classes
│   │   │   │   ├── SecurityConfig.java
│   │   │   │   └── WebConfig.java
│   │   │   ├── exception/              ← custom exceptions + handler
│   │   │   │   ├── {Domain}Exception.java
│   │   │   │   └── GlobalExceptionHandler.java
│   │   │   └── util/                    ← pure utility classes
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── application-dev.yml
│   │       ├── application-prod.yml
│   │       └── db/migration/           ← Flyway migrations
│   └── test/
│       └── java/com/{org}/{service}/
│           ├── unit/
│           ├── integration/
│           └── e2e/
├── build.gradle                         ← or pom.xml
└── Dockerfile
```

**Rules:**
- One controller per resource (e.g., `UserController`, `PostController`).
- Controllers are thin — they validate, call services, and format responses. No business logic.
- Dependency flow: controller → service → repository. Never the reverse.
- Service interfaces are optional but recommended when multiple implementations exist.
- `config/` holds `@Configuration` classes only — no business logic.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Packages | lowercase, dot-separated | `com.example.myapi.service` |
| Classes | PascalCase | `UserService`, `UserController` |
| Interfaces | PascalCase (no `I` prefix) | `UserService` (impl: `UserServiceImpl`) |
| Methods | camelCase | `findById()`, `createUser()` |
| Constants | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Endpoints | kebab-case plural | `/api/v1/user-profiles` |
| Path variables | camelCase | `/users/{userId}` |
| DTO classes | PascalCase with suffix | `UserCreateRequest`, `UserResponse` |
| Entity classes | PascalCase singular | `User`, `Post`, `OrderItem` |
| Repository | PascalCase + `Repository` | `UserRepository` |
| Config | PascalCase + `Config` | `SecurityConfig` |
| Enums | PascalCase, members UPPER_SNAKE | `enum Status { ACTIVE, INACTIVE }` |

**DTO naming pattern:**
- `{Resource}CreateRequest` — POST request body
- `{Resource}UpdateRequest` — PUT/PATCH request body
- `{Resource}Response` — single item response
- `{Resource}ListResponse` — paginated list response

---

## 3. Type System & Validation

**Use Jakarta Bean Validation annotations on DTOs:**

```java
public record UserCreateRequest(
    @NotBlank @Email @Size(max = 255)
    String email,

    @NotBlank @Size(min = 1, max = 100)
    String name,

    @Size(max = 500)
    String bio
) {}
```

**Rules:**
- Use Java records for DTOs (immutable, concise).
- Validate with `@Valid` in controller parameters — Spring handles 400 responses.
- Never use primitive types for nullable fields — use wrapper types (`Integer`, `Long`).
- Use `Optional<T>` for return types only, never for parameters or fields.
- Prefer sealed interfaces/records for domain models where appropriate (Java 17+).

---

## 4. Import Order

Group imports in this order (IDE auto-format handles this):

```java
// 1. java.* / javax.* / jakarta.*
import java.util.UUID;
import jakarta.validation.Valid;

// 2. Spring framework
import org.springframework.web.bind.annotation.*;
import org.springframework.stereotype.Service;

// 3. Third-party
import lombok.RequiredArgsConstructor;

// 4. Project-local
import com.example.myapi.dto.UserCreateRequest;
import com.example.myapi.service.UserService;
```

**Rules:**
- No wildcard imports (`import java.util.*`) — always import specific classes.
- IDE auto-organize handles ordering — configure Checkstyle/IntelliJ to enforce.

---

## 5. Spring-specific Patterns

### Constructor injection (preferred)

```java
@Service
@RequiredArgsConstructor  // Lombok generates constructor
public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;
    private final UserMapper userMapper;

    @Override
    public UserResponse findById(UUID id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User", id));
        return userMapper.toResponse(user);
    }
}
```

### Controller pattern

```java
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @GetMapping("/{userId}")
    public UserResponse getById(@PathVariable UUID userId) {
        return userService.findById(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody UserCreateRequest request) {
        return userService.create(request);
    }
}
```

**Rules:**
- Always use constructor injection — never field injection (`@Autowired` on fields).
- Use `@RequiredArgsConstructor` (Lombok) to reduce boilerplate.
- Controllers handle HTTP concerns; services handle business logic.
- Use `@Transactional` on service methods that modify data.

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **Checkstyle** | Code style enforcement | `config/checkstyle/checkstyle.xml` |
| **SpotBugs** | Bug detection | Gradle/Maven plugin |
| **google-java-format** | Code formatting | IDE plugin or Gradle task |

{% if build_tool == "gradle" %}
**Gradle configuration:**

```groovy
plugins {
    id 'checkstyle'
}

checkstyle {
    toolVersion = '10.12.0'
    configFile = file("config/checkstyle/checkstyle.xml")
}
```

```bash
./gradlew checkstyleMain
./gradlew spotbugsMain
```
{% endif %}
{% if build_tool == "maven" %}
**Maven configuration:**

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-checkstyle-plugin</artifactId>
    <version>3.3.0</version>
</plugin>
```

```bash
mvn checkstyle:check
mvn spotbugs:check
```
{% endif %}

**Rules:**
- Run Checkstyle and SpotBugs before every commit.
- Javadoc required for all public classes and methods.

```java
/**
 * Service for managing user operations.
 *
 * @since 1.0
 */
@Service
public class UserServiceImpl implements UserService {
    /**
     * Finds a user by their unique identifier.
     *
     * @param id the user's UUID
     * @return the user response DTO
     * @throws ResourceNotFoundException if user not found
     */
    public UserResponse findById(UUID id) { ... }
}
```

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in controllers | Move to `service/` layer |
| Field injection (`@Autowired`) | Constructor injection |
| Returning entities from controllers | Map to DTOs |
| Catching generic `Exception` | Catch specific exceptions |
| `System.out.println()` | Use SLF4J logger |
| Manual transaction management | Use `@Transactional` |
| Hardcoded config values | Use `application.yml` + `@Value` or `@ConfigurationProperties` |
| Circular dependencies | Refactor or use events |
| Missing validation on DTOs | Add `@Valid` + Jakarta annotations |
| `Optional` in method parameters | Use overloaded methods or nullable types |
