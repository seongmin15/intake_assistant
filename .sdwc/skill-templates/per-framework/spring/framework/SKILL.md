# Framework — Spring Boot

> This skill defines Spring Boot-specific patterns for the **{{ name }}** service.
> Auth: **{{ auth.method }}** | API style: **{{ api_style }}**
> Read this before building or modifying any application logic.

---

## 1. Application Bootstrap

```java
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### Application configuration

```yaml
# application.yml
server:
  port: ${PORT:8080}
  shutdown: graceful

spring:
  application:
    name: {{ name }}
  lifecycle:
    timeout-per-shutdown-phase: 30s
  jackson:
    default-property-inclusion: non_null
    serialization:
      write-dates-as-timestamps: false
```

**Logging** (→ also see skills/common/observability/):

```yaml
# application.yml
logging:
  level:
    root: INFO
    com.example.{{ name }}: DEBUG
  pattern:
    console: "%d{ISO8601} [%thread] %-5level %logger{36} - %msg%n"
```

Use SLF4J + Logback (Spring Boot default). Structured JSON logging in production:

```java
private static final Logger log = LoggerFactory.getLogger(UserService.class);

log.info("User created: userId={}", user.getId());
```

---

## 2. Controller Layer

```java
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @GetMapping
    public Page<UserResponse> list(Pageable pageable) {
        return userService.findAll(pageable);
    }

    @GetMapping("/{id}")
    public UserResponse getById(@PathVariable UUID id) {
        return userService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody UserCreateRequest request) {
        return userService.create(request);
    }

    @PutMapping("/{id}")
    public UserResponse update(@PathVariable UUID id, @Valid @RequestBody UserUpdateRequest request) {
        return userService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        userService.delete(id);
    }
}
```

{% if pagination == "cursor" %}
### Cursor pagination

```java
public record CursorPage<T>(
    List<T> data,
    String nextCursor,
    boolean hasMore
) {}

@GetMapping
public CursorPage<UserResponse> list(
    @RequestParam(required = false) String cursor,
    @RequestParam(defaultValue = "20") int limit
) {
    return userService.findAll(cursor, limit);
}
```
{% endif %}

**Rules:**
- Controllers only handle HTTP concerns: parse request → call service → format response.
- Use `@Valid` on `@RequestBody` parameters for automatic validation.
- Use Spring `Pageable` for offset pagination (default behavior).
- Set `@ResponseStatus` explicitly for non-200 responses.

---

## 3. Service Layer

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;
    private final UserMapper userMapper;

    @Override
    public UserResponse findById(UUID id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User", id));
        return userMapper.toResponse(user);
    }

    @Override
    @Transactional
    public UserResponse create(UserCreateRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email already exists: " + request.email());
        }
        User user = userMapper.toEntity(request);
        User saved = userRepository.save(user);
        return userMapper.toResponse(saved);
    }
}
```

**Rules:**
- Use `@Transactional(readOnly = true)` at class level, `@Transactional` on write methods.
- Services throw domain exceptions — never HTTP exceptions.
- All dependencies injected via constructor (Lombok `@RequiredArgsConstructor`).

---

## 4. Auth Pattern

**Method: {{ auth.method }}**

### Security configuration

```java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final AuthenticationFilter authFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/health", "/ready", "/actuator/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(authFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```

### Authentication filter

```java
@Component
@RequiredArgsConstructor
public class AuthenticationFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                     FilterChain chain) throws ServletException, IOException {
        String token = extractToken(request);
        if (token != null) {
            try {
                var auth = verifyAndBuildAuthentication(token);
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception e) {
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) return header.substring(7);
        return null;
    }
}
```

### Role-based authorization

```java
@GetMapping("/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public List<UserResponse> listAllUsers() { ... }

@DeleteMapping("/{id}")
@PreAuthorize("hasRole('ADMIN') or #id == authentication.principal.id")
public void delete(@PathVariable UUID id) { ... }
```

**Rules:**
- Health/readiness endpoints always `permitAll()`.
- Authentication is handled by filter; authorization by `@PreAuthorize`.
- Never put auth logic in controllers or services.

---

## 5. Error Handling

### Domain exceptions

```java
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String resource, Object id) {
        super(String.format("%s '%s' not found", resource, id));
    }
}

public class ConflictException extends RuntimeException {
    public ConflictException(String message) { super(message); }
}

public class BusinessRuleException extends RuntimeException {
    public BusinessRuleException(String message) { super(message); }
}
```

### Global exception handler

```java
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(ResourceNotFoundException ex) {
        return new ErrorResponse("NOT_FOUND", ex.getMessage());
    }

    @ExceptionHandler(ConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handleConflict(ConflictException ex) {
        return new ErrorResponse("CONFLICT", ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleValidation(MethodArgumentNotValidException ex) {
        var details = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> Map.of("field", e.getField(), "message", e.getDefaultMessage()))
            .toList();
        return new ErrorResponse("VALIDATION_ERROR", "Validation failed", details);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ErrorResponse handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        return new ErrorResponse("INTERNAL_ERROR", "Internal server error");
    }
}

public record ErrorResponse(String code, String message, Object details) {
    public ErrorResponse(String code, String message) { this(code, message, null); }
}
```

{% if error_response_format %}
**Error response format: {{ error_response_format }}**
{% endif %}

---

## 6. Database & JPA

{% if databases %}
### Entity definition

```java
@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(nullable = false, length = 100)
    private String name;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    @OneToMany(mappedBy = "author", cascade = CascadeType.ALL)
    private List<Post> posts = new ArrayList<>();
}
```

### Repository (Spring Data JPA)

```java
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.name LIKE %:query%")
    Page<User> search(@Param("query") String query, Pageable pageable);
}
```

### Migrations (Flyway)

```
src/main/resources/db/migration/
├── V1__create_users_table.sql
├── V2__create_posts_table.sql
└── V3__add_user_bio_column.sql
```

```sql
-- V1__create_users_table.sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Rules:**
- Never use `spring.jpa.hibernate.ddl-auto=update` in production — use Flyway migrations.
- Always review generated SQL before committing migrations.
- Use `@Transactional` in services, not in repositories.
- Use `Pageable` for pagination — Spring Data handles it.
{% endif %}

---

## 7. Mapper (Entity ↔ DTO)

```java
@Component
public class UserMapper {
    public UserResponse toResponse(User entity) {
        return new UserResponse(
            entity.getId(),
            entity.getEmail(),
            entity.getName(),
            entity.getCreatedAt()
        );
    }

    public User toEntity(UserCreateRequest request) {
        var user = new User();
        user.setEmail(request.email());
        user.setName(request.name());
        return user;
    }
}
```

Or use MapStruct for compile-time mapping:

```java
@Mapper(componentModel = "spring")
public interface UserMapper {
    UserResponse toResponse(User entity);
    User toEntity(UserCreateRequest request);
}
```

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Business logic in controllers | Fat controllers | Move to services |
| Field injection (`@Autowired`) | Hard to test | Constructor injection |
| Returning entities from API | Over-exposure, tight coupling | Use DTOs + mappers |
| N+1 query problem | Performance degradation | Use `@EntityGraph` or `JOIN FETCH` |
| `ddl-auto=update` in prod | Data loss risk | Use Flyway/Liquibase migrations |
| `System.out.println()` | Unstructured | Use SLF4J (`log.info()`) |
| Missing `@Transactional` | Partial writes | Add to service write methods |
| Catching generic `Exception` | Swallowing errors | Catch specific exceptions |
| Circular bean dependencies | Startup failure | Refactor or use `@Lazy` sparingly |
| No request validation | Invalid data | Use `@Valid` + Jakarta annotations |
