# Coding Standards — ASP.NET Core

> This skill defines coding rules for the **{{ name }}** service (ASP.NET Core / C#).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   └── {ServiceName}/                     ← main project (PascalCase)
│       ├── Program.cs                     ← entry point + host builder
│       ├── Controllers/                   ← API controllers (thin layer)
│       │   └── {Resource}Controller.cs
│       ├── Services/                      ← business logic
│       │   ├── I{Resource}Service.cs      (interface)
│       │   └── {Resource}Service.cs       (implementation)
│       ├── Repositories/                  ← data access
│       │   ├── I{Resource}Repository.cs
│       │   └── {Resource}Repository.cs
│       ├── Models/                        ← EF Core entities
│       │   └── {Resource}.cs
│       ├── Dtos/                          ← request/response DTOs
│       │   ├── {Resource}CreateRequest.cs
│       │   ├── {Resource}UpdateRequest.cs
│       │   └── {Resource}Response.cs
│       ├── Mappers/                       ← entity ↔ DTO mappers
│       │   └── {Resource}Mapper.cs
│       ├── Data/                          ← DbContext + migrations
│       │   ├── AppDbContext.cs
│       │   └── Migrations/
│       ├── Configuration/                 ← options, service registration
│       │   └── {Feature}Options.cs
│       ├── Middleware/                     ← custom middleware
│       │   └── ExceptionHandlingMiddleware.cs
│       ├── Exceptions/                    ← domain exception classes
│       │   ├── AppException.cs
│       │   └── NotFoundException.cs
│       ├── Filters/                       ← action filters
│       └── Extensions/                    ← IServiceCollection extensions
│           └── ServiceCollectionExtensions.cs
│       └── {ServiceName}.csproj
├── tests/
│   ├── {ServiceName}.UnitTests/
│   │   └── {ServiceName}.UnitTests.csproj
│   └── {ServiceName}.IntegrationTests/
│       └── {ServiceName}.IntegrationTests.csproj
├── {ServiceName}.sln
├── Directory.Build.props                  ← shared build properties
└── Dockerfile
```

**Rules:**
- One controller per resource (e.g., `UsersController`, `PostsController`).
- Controllers are thin — they validate, call services, and return responses. No business logic.
- Dependency flow: controllers → services → repositories. Never the reverse.
- Interfaces required for services and repositories — enables DI and testability.
- `Data/` holds `DbContext` and EF Core migrations only.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Namespaces | PascalCase, dot-separated | `MyApi.Services`, `MyApi.Models` |
| Classes & records | PascalCase | `UserService`, `UserResponse` |
| Interfaces | `I` + PascalCase | `IUserService`, `IUserRepository` |
| Methods | PascalCase | `GetByIdAsync()`, `CreateUserAsync()` |
| Properties | PascalCase | `public string Email { get; set; }` |
| Private fields | `_camelCase` | `private readonly IUserRepository _userRepository;` |
| Parameters & locals | camelCase | `userId`, `cancellationToken` |
| Constants | PascalCase | `public const int MaxPageSize = 100;` |
| Endpoints | kebab-case plural | `/api/v1/user-profiles` |
| Route parameters | camelCase | `/users/{userId}` |
| Async methods | suffix `Async` | `GetByIdAsync()`, `CreateAsync()` |

**DTO naming pattern:**
- `{Resource}CreateRequest` — POST request body
- `{Resource}UpdateRequest` — PUT/PATCH request body
- `{Resource}Response` — single item response
- `{Resource}ListResponse` — paginated list response

---

## 3. Type System & Validation

**Use records for DTOs (immutable, concise):**

```csharp
public record UserCreateRequest(
    [Required, EmailAddress, MaxLength(255)] string Email,
    [Required, MinLength(1), MaxLength(100)] string Name,
    [MaxLength(500)] string? Bio
);

public record UserResponse(
    Guid Id,
    string Email,
    string Name,
    string? Bio,
    DateTime CreatedAt
);
```

**FluentValidation for complex rules:**

```csharp
public class UserCreateRequestValidator : AbstractValidator<UserCreateRequest>
{
    public UserCreateRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(255);
        RuleFor(x => x.Name).NotEmpty().MinimumLength(1).MaximumLength(100);
    }
}
```

**Rules:**
- Use C# records for DTOs — immutable by default.
- Use `required` keyword or `[Required]` attribute for mandatory fields.
- Use nullable reference types (`string?`) for optional fields. Enable `<Nullable>enable</Nullable>`.
- Use DataAnnotations for simple validation, FluentValidation for complex rules.
- Never use `object` or `dynamic` for typed data.

---

## 4. Using Directives

Group `using` directives in this order:

```csharp
// 1. System / Microsoft
using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

// 2. Third-party
using FluentValidation;
using AutoMapper;

// 3. Project-local
using MyApi.Services;
using MyApi.Dtos;
using MyApi.Models;
```

**Rules:**
- Use implicit usings (enabled by default in .NET 6+) for common System namespaces.
- Use `global using` in a `GlobalUsings.cs` for project-wide imports.
- Never use `using static` for non-obvious types.

```csharp
// GlobalUsings.cs
global using Microsoft.AspNetCore.Mvc;
global using Microsoft.EntityFrameworkCore;
global using MyApi.Exceptions;
```

---

## 5. .NET Patterns

### Dependency injection (constructor injection)

```csharp
public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly IMapper _mapper;
    private readonly ILogger<UserService> _logger;

    public UserService(
        IUserRepository userRepository,
        IMapper mapper,
        ILogger<UserService> logger)
    {
        _userRepository = userRepository;
        _mapper = mapper;
        _logger = logger;
    }
}
```

### Service registration

```csharp
// Extensions/ServiceCollectionExtensions.cs
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddAutoMapper(typeof(Program));
        services.AddValidatorsFromAssemblyContaining<Program>();
        return services;
    }
}

// Program.cs
builder.Services.AddApplicationServices();
```

### Options pattern (typed configuration)

```csharp
// Configuration/JwtOptions.cs
public class JwtOptions
{
    public const string Section = "Jwt";
    public required string Secret { get; init; }
    public int ExpiryMinutes { get; init; } = 60;
}

// Program.cs
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.Section));

// Usage via DI
public class AuthService(IOptions<JwtOptions> jwtOptions) { ... }
```

**Rules:**
- Always use constructor injection — never service locator or `HttpContext.RequestServices`.
- Register services with appropriate lifetime: `Scoped` (per-request), `Transient` (per-resolve), `Singleton` (app lifetime).
- Use Options pattern for typed config — never `IConfiguration` directly in services.
- Use primary constructors (C# 12) for concise service definitions where appropriate.

---

## 6. Linting & Formatting

| Tool | Purpose | Config file |
|------|---------|-------------|
| **dotnet format** | Code formatting | `.editorconfig` |
| **Roslyn analyzers** | Code quality | `Directory.Build.props` |
| **StyleCop.Analyzers** | Style enforcement | NuGet + `.editorconfig` |

**.editorconfig:**

```ini
[*.cs]
indent_style = space
indent_size = 4
dotnet_sort_system_directives_first = true
csharp_style_var_for_built_in_types = false:suggestion
csharp_style_var_when_type_is_apparent = true:suggestion
csharp_prefer_braces = true:warning
dotnet_style_require_accessibility_modifiers = always:warning
```

**Commands:**

```bash
dotnet format                    # format code
dotnet build /warnaserror        # treat warnings as errors
```

**Rules:**
- Run `dotnet format` before every commit.
- Enable `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` in CI.
- XML documentation (`///`) required for all public types and members.

```csharp
/// <summary>
/// Service for managing user operations.
/// </summary>
public class UserService : IUserService
{
    /// <summary>
    /// Finds a user by their unique identifier.
    /// </summary>
    /// <param name="id">The user's GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The user response DTO.</returns>
    /// <exception cref="NotFoundException">Thrown when user not found.</exception>
    public async Task<UserResponse> GetByIdAsync(Guid id, CancellationToken ct) { ... }
}
```

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in controllers | Move to `Services/` layer |
| Service locator (`GetService<T>()`) | Constructor injection |
| Returning EF entities from API | Map to DTOs |
| `async void` methods | Always return `Task` or `Task<T>` |
| Blocking async (`task.Result`, `.Wait()`) | Use `await` everywhere |
| `Console.WriteLine()` | Use `ILogger<T>` (→ skills/common/observability/) |
| Hardcoded config values | Use Options pattern + `appsettings.json` |
| Catching generic `Exception` | Catch specific exceptions |
| Missing `CancellationToken` | Pass through all async call chains |
| `IConfiguration` in services | Use typed `IOptions<T>` |
| Missing `[ApiController]` attribute | Add for automatic model validation + ProblemDetails |
