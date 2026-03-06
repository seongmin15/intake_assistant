# Testing — ASP.NET Core

> This skill defines testing rules for the **{{ name }}** service (ASP.NET Core / C#).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify the main success scenario for each endpoint/service method.
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
- Security cases: injection attempts, token tampering, privilege escalation, IDOR, CORS violations.
{% endif %}

The number of test cases per method is not fixed — judge by the method's complexity and branching.

---

## 2. Test Structure

```
tests/
├── {ServiceName}.UnitTests/
│   ├── Services/
│   │   └── {Resource}ServiceTests.cs
│   ├── Mappers/
│   │   └── {Resource}MapperTests.cs
│   └── Validators/
│       └── {Resource}ValidatorTests.cs
├── {ServiceName}.IntegrationTests/
│   ├── Controllers/
│   │   └── {Resource}ControllerTests.cs
│   ├── Repositories/
│   │   └── {Resource}RepositoryTests.cs
│   ├── Fixtures/
│   │   └── WebApplicationFixture.cs
│   └── Helpers/
│       └── AuthHelper.cs
```

**Naming:** `{MethodName}_Should{Expected}_When{Condition}`

```csharp
// ✅ clear intent
[Fact]
public async Task GetByIdAsync_ShouldReturnUser_WhenUserExists() { ... }

[Fact]
public async Task GetByIdAsync_ShouldThrowNotFoundException_WhenUserDoesNotExist() { ... }

[Fact]
public async Task CreateAsync_ShouldReturn201_WhenInputIsValid() { ... }

// ❌ too vague
[Fact]
public void TestGetUser() { ... }
```

**Pattern:** Arrange → Act → Assert.

```csharp
[Fact]
public async Task GetByIdAsync_ShouldReturnUser_WhenUserExists()
{
    // Arrange
    var userId = Guid.NewGuid();
    var user = new User { Id = userId, Email = "test@example.com", Name = "Test" };
    _userRepositoryMock.Setup(r => r.GetByIdAsync(userId, default))
        .ReturnsAsync(user);

    // Act
    var result = await _sut.GetByIdAsync(userId, CancellationToken.None);

    // Assert
    result.Email.Should().Be("test@example.com");
}
```

---

## 3. Unit Testing

Use xUnit + Moq + FluentAssertions. No ASP.NET host loaded.

```csharp
public class UserServiceTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly Mock<IMapper> _mapperMock = new();
    private readonly Mock<ILogger<UserService>> _loggerMock = new();
    private readonly UserService _sut;

    public UserServiceTests()
    {
        _sut = new UserService(
            _userRepositoryMock.Object,
            _mapperMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task GetByIdAsync_ShouldReturnResponse_WhenFound()
    {
        // Arrange
        var user = new User { Id = Guid.NewGuid(), Email = "test@example.com" };
        var response = new UserResponse(user.Id, "test@example.com", "Test", null, DateTime.UtcNow);

        _userRepositoryMock.Setup(r => r.GetByIdAsync(user.Id, default)).ReturnsAsync(user);
        _mapperMock.Setup(m => m.Map<UserResponse>(user)).Returns(response);

        // Act
        var result = await _sut.GetByIdAsync(user.Id, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Email.Should().Be("test@example.com");
        _userRepositoryMock.Verify(r => r.GetByIdAsync(user.Id, default), Times.Once);
    }

    [Fact]
    public async Task GetByIdAsync_ShouldThrow_WhenNotFound()
    {
        // Arrange
        var id = Guid.NewGuid();
        _userRepositoryMock.Setup(r => r.GetByIdAsync(id, default)).ReturnsAsync((User?)null);

        // Act & Assert
        await _sut.Invoking(s => s.GetByIdAsync(id, CancellationToken.None))
            .Should().ThrowAsync<NotFoundException>();
    }
}
```

---

## 4. Integration Testing

### WebApplicationFactory

```csharp
// Fixtures/WebApplicationFixture.cs
public class WebApplicationFixture : IAsyncLifetime
{
    public WebApplicationFactory<Program> Factory { get; private set; } = null!;
    public HttpClient Client { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        Factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    // Replace real DB with in-memory or Testcontainers
                    services.RemoveAll<DbContextOptions<AppDbContext>>();
                    services.AddDbContext<AppDbContext>(options =>
                        options.UseInMemoryDatabase("TestDb"));
                });
            });

        Client = Factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        Client.Dispose();
        await Factory.DisposeAsync();
    }
}
```

### Controller integration tests

```csharp
public class UsersControllerTests : IClassFixture<WebApplicationFixture>
{
    private readonly HttpClient _client;

    public UsersControllerTests(WebApplicationFixture fixture)
    {
        _client = fixture.Client;
    }

    [Fact]
    public async Task Create_ShouldReturn201_WhenInputIsValid()
    {
        // Arrange
        var request = new { Email = "test@example.com", Name = "Test User" };
        var content = new StringContent(
            JsonSerializer.Serialize(request),
            Encoding.UTF8,
            "application/json");

        // Act
        var response = await _client.PostAsync("/api/v1/users", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<UserResponse>();
        body!.Email.Should().Be("test@example.com");
    }

    [Fact]
    public async Task Create_ShouldReturn400_WhenEmailIsInvalid()
    {
        var request = new { Email = "not-an-email", Name = "" };
        var content = new StringContent(
            JsonSerializer.Serialize(request),
            Encoding.UTF8,
            "application/json");

        var response = await _client.PostAsync("/api/v1/users", content);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
```

### Testcontainers for real DB

```csharp
public class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public string ConnectionString => _postgres.GetConnectionString();

    public async Task InitializeAsync() => await _postgres.StartAsync();
    public async Task DisposeAsync() => await _postgres.DisposeAsync();
}
```

---

## 5. Mocking Rules

**What to mock (Moq):**
- External API calls (HttpClient via `IHttpClientFactory`).
- Time-dependent logic (`TimeProvider` / `ISystemClock`).
- File storage operations.
- Message queue publishers.

**What NOT to mock:**
- Database in integration tests — use InMemory provider or Testcontainers.
- Model validation — let it run to catch constraint regressions.
- ASP.NET middleware pipeline in e2e tests.
- Exception handling middleware.

```csharp
// ✅ Mock external HTTP call
var httpMessageHandler = new Mock<HttpMessageHandler>();
httpMessageHandler.Protected()
    .Setup<Task<HttpResponseMessage>>("SendAsync",
        ItExpr.IsAny<HttpRequestMessage>(),
        ItExpr.IsAny<CancellationToken>())
    .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
    {
        Content = new StringContent("{\"status\": \"ok\"}")
    });

var httpClient = new HttpClient(httpMessageHandler.Object);
```

```csharp
// ✅ Mock time
var fakeTime = new FakeTimeProvider(new DateTimeOffset(2025, 1, 1, 12, 0, 0, TimeSpan.Zero));
services.AddSingleton<TimeProvider>(fakeTime);
```

---

## 6. Test Execution

```bash
# Run all tests
dotnet test

# Run specific project
dotnet test tests/{ServiceName}.UnitTests/

# Run with coverage (Coverlet)
dotnet test --collect:"XPlat Code Coverage"

# Run with filter
dotnet test --filter "FullyQualifiedName~UserServiceTests"
dotnet test --filter "Category=Integration"

# Run single test
dotnet test --filter "GetByIdAsync_ShouldReturnUser_WhenUserExists"

# Verbose output
dotnet test --logger "console;verbosity=detailed"
```

**Test project configuration:**

```xml
<!-- {ServiceName}.UnitTests.csproj -->
<ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.*" />
    <PackageReference Include="xunit" Version="2.*" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.*" />
    <PackageReference Include="Moq" Version="4.*" />
    <PackageReference Include="FluentAssertions" Version="6.*" />
    <PackageReference Include="coverlet.collector" Version="6.*" />
</ItemGroup>

<!-- Integration tests add: -->
<PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="8.*" />
<PackageReference Include="Testcontainers.PostgreSql" Version="3.*" />
```

**Rules:**
- All tests must pass before committing.
- Unit tests run without external dependencies.
- Integration tests use `WebApplicationFactory` for full HTTP pipeline.
- Use Testcontainers for real database testing in CI.
- Use `[Trait("Category", "Integration")]` for integration test filtering.
- Always pass `CancellationToken` in async test methods.
