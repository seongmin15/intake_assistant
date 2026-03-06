# Framework — ASP.NET Core

> This skill defines ASP.NET Core-specific patterns for the **{{ name }}** service.
> Auth: **{{ auth.method }}** | API style: **{{ api_style }}**
> Read this before building or modifying any application logic.

---

## 1. Application Bootstrap

### Program.cs (Minimal hosting model)

```csharp
var builder = WebApplication.CreateBuilder(args);

// --- Service registration ---
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddApplicationServices();           // custom extension
builder.Services.AddPersistence(builder.Configuration); // DbContext
builder.Services.AddAuthServices(builder.Configuration); // Auth config

// --- Logging ---
builder.Services.AddSerilog(builder.Configuration);

var app = builder.Build();

// --- Middleware pipeline (order matters) ---
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<ExceptionHandlingMiddleware>();      // 1. Global error handling
app.UseCors();                                         // 2. CORS
app.UseAuthentication();                               // 3. Authentication
app.UseAuthorization();                                // 4. Authorization
app.MapControllers();                                  // 5. Route mapping

app.Run();

// Required for WebApplicationFactory in integration tests
public partial class Program { }
```

**Middleware order** (first registered = outermost):
1. Exception handling (catches all downstream errors)
2. CORS
3. Authentication (who are you)
4. Authorization (are you allowed)
5. Routing / Controllers

### Logging setup (→ also see skills/common/observability/)

```csharp
// Extensions/SerilogExtensions.cs
public static IServiceCollection AddSerilog(this IServiceCollection services, IConfiguration config)
{
    Log.Logger = new LoggerConfiguration()
        .ReadFrom.Configuration(config)
        .Enrich.FromLogContext()
        .WriteTo.Console(new JsonFormatter())
        .CreateLogger();

    services.AddSerilog();
    return services;
}
```

Use `ILogger<T>` everywhere — never `Console.WriteLine()`.

```csharp
public class UserService(ILogger<UserService> logger)
{
    public async Task<UserResponse> GetByIdAsync(Guid id, CancellationToken ct)
    {
        logger.LogInformation("Fetching user {UserId}", id);
        ...
    }
}
```

---

## 2. Controller Layer

```csharp
[ApiController]
[Route("api/v1/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResponse<UserResponse>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _userService.GetAllAsync(page, pageSize, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserResponse>> GetById(Guid id, CancellationToken ct = default)
    {
        var result = await _userService.GetByIdAsync(id, ct);
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<UserResponse>> Create(
        [FromBody] UserCreateRequest request,
        CancellationToken ct = default)
    {
        var result = await _userService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UserResponse>> Update(
        Guid id,
        [FromBody] UserUpdateRequest request,
        CancellationToken ct = default)
    {
        var result = await _userService.UpdateAsync(id, request, ct);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        await _userService.DeleteAsync(id, ct);
        return NoContent();
    }
}
```

{% if pagination == "cursor" %}
### Cursor pagination

```csharp
public record CursorPagedResponse<T>(
    IReadOnlyList<T> Items,
    string? NextCursor,
    bool HasMore
);
```
{% endif %}
{% if pagination == "offset" %}
### Offset pagination

```csharp
public record PagedResponse<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Page,
    int PageSize
);
```
{% endif %}

**Rules:**
- Always use `[ApiController]` attribute — enables automatic model validation and ProblemDetails.
- Always accept `CancellationToken` — propagate through all async methods.
- Use `ActionResult<T>` return types for Swagger documentation.
- Use `CreatedAtAction` for POST to return 201 with Location header.
- Controllers do HTTP mapping only — no business logic.

---

## 3. Service Layer

```csharp
public interface IUserService
{
    Task<UserResponse> GetByIdAsync(Guid id, CancellationToken ct);
    Task<PagedResponse<UserResponse>> GetAllAsync(int page, int pageSize, CancellationToken ct);
    Task<UserResponse> CreateAsync(UserCreateRequest request, CancellationToken ct);
    Task<UserResponse> UpdateAsync(Guid id, UserUpdateRequest request, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly IMapper _mapper;
    private readonly ILogger<UserService> _logger;

    public UserService(IUserRepository userRepository, IMapper mapper, ILogger<UserService> logger)
    {
        _userRepository = userRepository;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<UserResponse> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var user = await _userRepository.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("User", id);
        return _mapper.Map<UserResponse>(user);
    }

    public async Task<UserResponse> CreateAsync(UserCreateRequest request, CancellationToken ct)
    {
        if (await _userRepository.ExistsByEmailAsync(request.Email, ct))
            throw new ConflictException($"Email '{request.Email}' already exists");

        var user = _mapper.Map<User>(request);
        await _userRepository.AddAsync(user, ct);
        await _userRepository.SaveChangesAsync(ct);

        _logger.LogInformation("User created: {UserId}", user.Id);
        return _mapper.Map<UserResponse>(user);
    }
}
```

**Rules:**
- Services define interfaces — required for DI and mocking.
- Services throw domain exceptions — never return HTTP status codes.
- Always propagate `CancellationToken` through the entire chain.
- Use `ILogger<T>` for structured logging with message templates.

---

## 4. Auth Pattern

**Method: {{ auth.method }}**

### Authentication & Authorization setup

```csharp
// Program.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]!))
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
});
```

### Applying to controllers

```csharp
// Protected by default (all controllers)
[Authorize]
[ApiController]
public class UsersController : ControllerBase { ... }

// Admin-only endpoint
[HttpDelete("{id:guid}")]
[Authorize(Policy = "AdminOnly")]
public async Task<IActionResult> Delete(Guid id) { ... }

// Public endpoint
[AllowAnonymous]
[HttpGet("/health")]
public IActionResult Health() => Ok(new { Status = "ok" });
```

### Access current user in services

```csharp
// Register IHttpContextAccessor
builder.Services.AddHttpContextAccessor();

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public Guid UserId => Guid.Parse(
        _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? throw new UnauthorizedException());

    public bool IsAdmin => _httpContextAccessor.HttpContext?.User.IsInRole("Admin") ?? false;
}
```

**Rules:**
- Health/readiness endpoints always `[AllowAnonymous]`.
- Auth config in `Program.cs` — never in controllers.
- Use policies for role-based authorization.
- Access user context via `ICurrentUserService` — never `HttpContext` directly in services.

---

## 5. Error Handling

### Domain exceptions

```csharp
public abstract class AppException : Exception
{
    public string Code { get; }
    public int HttpStatusCode { get; }

    protected AppException(string message, string code, int httpStatusCode)
        : base(message)
    {
        Code = code;
        HttpStatusCode = httpStatusCode;
    }
}

public class NotFoundException : AppException
{
    public NotFoundException(string resource, object id)
        : base($"{resource} '{id}' not found", "NOT_FOUND", 404) { }
}

public class ConflictException : AppException
{
    public ConflictException(string message)
        : base(message, "CONFLICT", 409) { }
}

public class ValidationException : AppException
{
    public ValidationException(string message)
        : base(message, "VALIDATION_ERROR", 422) { }
}
```

### Global exception handling middleware

```csharp
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (AppException ex)
        {
            _logger.LogWarning(ex, "Application error: {Code} — {Message}", ex.Code, ex.Message);
            context.Response.StatusCode = ex.HttpStatusCode;
            await context.Response.WriteAsJsonAsync(new
            {
                Error = new { ex.Code, ex.Message }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception");
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(new
            {
                Error = new { Code = "INTERNAL_ERROR", Message = "Internal server error" }
            });
        }
    }
}
```

{% if error_response_format %}
**Error response format: {{ error_response_format }}**
{% endif %}

**Rules:**
- Services throw domain exceptions (`AppException` subclasses) — never return HTTP codes.
- Middleware converts exceptions to consistent JSON error responses.
- Log unexpected exceptions at ERROR level with full stack trace.
- Never expose internal details (stack traces, SQL) to the client.
- `[ApiController]` handles validation errors automatically as ProblemDetails.

---

## 6. Database & EF Core

{% if databases %}
### DbContext

```csharp
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Post> Posts => Set<Post>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        // Auto-set timestamps
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = DateTime.UtcNow;
            if (entry.State == EntityState.Modified) entry.Entity.UpdatedAt = DateTime.UtcNow;
        }
        return await base.SaveChangesAsync(ct);
    }
}
```

### Entity configuration (Fluent API)

```csharp
public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Email).IsRequired().HasMaxLength(255);
        builder.HasIndex(u => u.Email).IsUnique();
        builder.Property(u => u.Name).IsRequired().HasMaxLength(100);
    }
}
```

### Repository pattern

```csharp
public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<bool> ExistsByEmailAsync(string email, CancellationToken ct);
    Task AddAsync(User user, CancellationToken ct);
    Task SaveChangesAsync(CancellationToken ct);
}

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _context;

    public UserRepository(AppDbContext context) => _context = context;

    public async Task<User?> GetByIdAsync(Guid id, CancellationToken ct)
        => await _context.Users.FindAsync(new object[] { id }, ct);

    public async Task<bool> ExistsByEmailAsync(string email, CancellationToken ct)
        => await _context.Users.AnyAsync(u => u.Email == email, ct);

    public async Task AddAsync(User user, CancellationToken ct)
        => await _context.Users.AddAsync(user, ct);

    public async Task SaveChangesAsync(CancellationToken ct)
        => await _context.SaveChangesAsync(ct);
}
```

### Migrations (EF Core)

```bash
dotnet ef migrations add CreateUsersTable
dotnet ef database update
dotnet ef migrations list
```

**Rules:**
- Use Fluent API (`IEntityTypeConfiguration`) over data annotations for entity config.
- Use repository pattern to abstract data access.
- Register `DbContext` as `Scoped` (one per request).
- Always pass `CancellationToken` to all EF Core async methods.
- Use `AsNoTracking()` for read-only queries.
- Apply migrations via CLI or startup hook — never `EnsureCreated()` in production.
{% endif %}

---

## 7. Background Services

```csharp
public class CleanupBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<CleanupBackgroundService> _logger;

    public CleanupBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<CleanupBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = _scopeFactory.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<ICleanupService>();

            try
            {
                await service.RunAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Cleanup failed");
            }

            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }
}

// Register in Program.cs
builder.Services.AddHostedService<CleanupBackgroundService>();
```

**Rules:**
- Use `BackgroundService` for in-process background work.
- Create a new DI scope for each execution cycle (`IServiceScopeFactory`).
- Always respect `CancellationToken` for graceful shutdown.
- For long-running or complex jobs, delegate to a dedicated worker service.

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Business logic in controllers | Fat controllers | Move to services |
| Missing `CancellationToken` | Can't cancel requests | Propagate through entire chain |
| `async void` | Unobserved exceptions | Always return `Task` |
| Blocking async (`.Result`, `.Wait()`) | Deadlocks | Use `await` |
| Service locator pattern | Hidden dependencies | Constructor injection |
| Returning EF entities from API | Over-exposure | Map to DTOs |
| `EnsureCreated()` in prod | Skips migrations | Use EF migrations |
| Missing `AsNoTracking()` | Memory waste on reads | Add for read-only queries |
| `Console.WriteLine()` | Unstructured | Use `ILogger<T>` (→ skills/common/observability/) |
| `IConfiguration` in services | Untyped config | Use `IOptions<T>` pattern |
