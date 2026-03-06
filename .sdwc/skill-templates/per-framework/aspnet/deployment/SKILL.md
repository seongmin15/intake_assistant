# Deployment — ASP.NET Core

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **dotnet CLI**

---

## 1. Build & Package

```bash
dotnet restore                          # restore NuGet packages
dotnet build --configuration Release    # compile
dotnet publish --configuration Release --output ./publish  # publish for deployment
```

**Rules:**
- Always commit `*.csproj` files with pinned package versions.
- Use `Directory.Build.props` for shared properties across projects.
- Use `<PackageReference>` with specific versions — no floating versions in production.
- Run `dotnet restore` as a separate step in CI for caching.

```xml
<!-- Directory.Build.props -->
<Project>
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
</Project>
```

---

## 2. Container

**Dockerfile (multi-stage build):**

```dockerfile
# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder
WORKDIR /app

# Restore (cacheable layer)
COPY *.sln .
COPY src/{ServiceName}/{ServiceName}.csproj src/{ServiceName}/
COPY tests/{ServiceName}.UnitTests/{ServiceName}.UnitTests.csproj tests/{ServiceName}.UnitTests/
RUN dotnet restore

# Build & publish
COPY . .
RUN dotnet publish src/{ServiceName}/{ServiceName}.csproj \
    --configuration Release \
    --output /app/publish \
    --no-restore

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=builder /app/publish .

EXPOSE 8080
USER 1000
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "{ServiceName}.dll"]
```

**.dockerignore:**

```
.git
.env
**/bin/
**/obj/
**/publish/
tests/
*.md
```

**Rules:**
- Use `aspnet` runtime image (not `sdk`) for production — much smaller.
- Separate restore layer for Docker cache efficiency.
- Run as non-root user (`USER 1000`).
- Set `ASPNETCORE_URLS` via environment variable.
- Never copy `.env` or test projects into the production image.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**

- IaC files location: `infra/` directory at project root.
- Never hardcode environment-specific values.
- All infra changes go through the same PR review process as code.
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Configuration layering:**

```
appsettings.json              ← base (shared defaults)
appsettings.{Environment}.json ← environment overrides
Environment variables          ← runtime overrides (highest priority)
```

```json
// appsettings.json
{
  "ConnectionStrings": {
    "DefaultConnection": ""
  },
  "Jwt": {
    "Issuer": "{{ name }}",
    "ExpiryMinutes": 60
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}
```

**Rules:**
- All secrets via environment variables — never in `appsettings.*.json`.
- Use `appsettings.json` for non-sensitive defaults.
- Use `appsettings.Development.json` for local dev only (gitignored or safe values).
- Environment variable naming: `ConnectionStrings__DefaultConnection` (double underscore for nesting).
{% if deployment.secrets_management %}
- **Secrets management: {{ deployment.secrets_management }}** — fetch secrets from this source in production.
{% endif %}
- For local development, use `dotnet user-secrets` for sensitive config.

```bash
dotnet user-secrets init
dotnet user-secrets set "Jwt:Secret" "local-dev-secret"
```

---

## 4. CI/CD Pipeline

{% if deployment.ci %}
**Tool: {{ deployment.ci.tool }}**
{% if deployment.ci.pipeline_stages %}
**Stages: {{ deployment.ci.pipeline_stages }}**
{% endif %}

Standard pipeline steps:

```
1. Checkout code
2. Setup .NET SDK + NuGet cache
3. Restore packages (dotnet restore)
4. Build (dotnet build --no-restore)
5. Lint (dotnet format --verify-no-changes)
6. Unit tests (dotnet test tests/{ServiceName}.UnitTests/)
7. Integration tests (dotnet test tests/{ServiceName}.IntegrationTests/)
8. Publish (dotnet publish --configuration Release)
9. Build container image
10. Push to registry
11. Run migrations (dotnet ef database update or startup)
12. Deploy application
```

**Rules:**
- Pipeline must pass before merge.
- Cache NuGet packages in CI (`~/.nuget/packages`).
- Integration tests use Testcontainers (Docker-in-Docker required in CI).
- EF migrations run as part of deployment — either startup hook or separate step.
- Container image tag uses git commit SHA for traceability.
- `dotnet format --verify-no-changes` fails CI if code is not formatted.
{% endif %}
{% if deployment.cd %}
**CD Tool: {{ deployment.cd.tool }}**
{% if deployment.cd.strategy %}
**Strategy: {{ deployment.cd.strategy }}**
{% endif %}
{% endif %}

{% if deployment.container_registry %}
**Container registry: {{ deployment.container_registry }}**
{% endif %}

---

## 5. Health Check & Readiness

**ASP.NET Core built-in health checks:**

```csharp
// Program.cs
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database")
    .AddRedis(builder.Configuration["Redis:ConnectionString"]!, "redis");

app.MapHealthChecks("/health", new HealthCheckOptions
{
    Predicate = _ => false,  // liveness — no dependency checks
    ResponseWriter = WriteResponse
});

app.MapHealthChecks("/ready", new HealthCheckOptions
{
    Predicate = _ => true,   // readiness — check all dependencies
    ResponseWriter = WriteResponse
});

static Task WriteResponse(HttpContext context, HealthReport report)
{
    context.Response.ContentType = "application/json";
    var result = new
    {
        Status = report.Status.ToString(),
        Checks = report.Entries.Select(e => new
        {
            Name = e.Key,
            Status = e.Value.Status.ToString(),
            Duration = e.Value.Duration.TotalMilliseconds
        })
    };
    return context.Response.WriteAsJsonAsync(result);
}
```

**Rules:**
- `/health` — liveness probe, no dependency checks, always fast.
- `/ready` — readiness probe, checks DB and critical dependencies.
- Both endpoints are public — `[AllowAnonymous]` via health check mapping.
- Use `Microsoft.Extensions.Diagnostics.HealthChecks` NuGet packages.

---

## 6. Operational Commands

```bash
# Development
dotnet run --project src/{ServiceName}/
dotnet watch run --project src/{ServiceName}/   # hot reload

# Production
dotnet {ServiceName}.dll

# Database migrations (EF Core)
dotnet ef migrations add MigrationName --project src/{ServiceName}/
dotnet ef database update --project src/{ServiceName}/
dotnet ef migrations list --project src/{ServiceName}/
dotnet ef migrations script --idempotent       # generate SQL script

# Build & publish
dotnet build --configuration Release
dotnet publish --configuration Release --output ./publish

# Docker
docker build -t {{ name }} .
docker run -p 8080:8080 \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e ConnectionStrings__DefaultConnection="Host=..." \
  {{ name }}

# Tests
dotnet test
dotnet test --collect:"XPlat Code Coverage"

# Formatting
dotnet format
dotnet format --verify-no-changes              # CI check
```

### Kestrel Configuration

```json
// appsettings.json
{
  "Kestrel": {
    "Endpoints": {
      "Http": { "Url": "http://+:8080" }
    },
    "Limits": {
      "MaxRequestBodySize": 10485760,
      "RequestHeadersTimeout": "00:00:30"
    }
  }
}
```
