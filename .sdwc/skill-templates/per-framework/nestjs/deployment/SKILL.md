# Deployment — NestJS

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

{% if build_tool == "npm" %}
```bash
npm ci                      # clean install (CI)
npm run build               # nest build → dist/
```
{% endif %}
{% if build_tool == "pnpm" %}
```bash
pnpm install --frozen-lockfile
pnpm build                  # nest build → dist/
```
{% endif %}
{% if build_tool == "yarn" %}
```bash
yarn install --frozen-lockfile
yarn build                  # nest build → dist/
```
{% endif %}

**package.json scripts:**

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main.js"
  }
}
```

**Rules:**
- Always commit the lock file.
- Use `--frozen-lockfile` in CI for reproducible builds.
- NestJS CLI (`nest build`) compiles TypeScript and handles path aliases.
- Production runs compiled JS from `dist/`.

---

## 2. Container

**Dockerfile (multi-stage build):**

```dockerfile
# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/
RUN npm run build

# Runtime stage
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
```

**.dockerignore:**

```
node_modules
dist
.git
.env
test/
*.md
```

**Rules:**
- Multi-stage build: build with dev deps, run with production deps only.
- Set `NODE_ENV=production` in runtime stage.
- Run as non-root user (`USER node`).
- Copy `nest-cli.json` and `tsconfig*.json` to build stage for proper compilation.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**

- IaC files location: `infra/` directory at project root.
- Never hardcode environment-specific values.
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**NestJS ConfigModule:**

```typescript
// config/config.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
      }),
    }),
  ],
})
export class AppConfigModule {}
```

**Rules:**
- Validate all env vars at startup — fail fast on missing config.
- All config via environment variables. Never hardcode secrets.
- Use `.env` for local development only. Never commit `.env` files.
{% if deployment.secrets_management %}
- **Secrets management: {{ deployment.secrets_management }}**
{% endif %}

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
2. Install dependencies
3. Lint (npx eslint .)
4. Type check (npx tsc --noEmit)
5. Unit tests (npm run test)
6. E2E tests (npm run test:e2e)
7. Build (npm run build)
8. Build container image
9. Push to registry
10. Run migrations
11. Deploy application
```

**Rules:**
- Pipeline must pass before merge.
- Migrations run as a pre-deploy step — separate from app startup.
- Container image tag uses git commit SHA.
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

**NestJS Terminus module:**

```typescript
// modules/health/health.module.ts
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}

@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck("database"),
    ]);
  }
}
```

**Rules:**
- Use `@nestjs/terminus` for standardized health checks.
- Health endpoint must not require authentication.
- Check database and critical dependencies in readiness probe.

---

## 6. Operational Commands

```bash
# Development
npm run start:dev                       # nest start --watch

# Production
npm run build && npm run start:prod

# Database (TypeORM)
npx typeorm migration:generate -d src/config/database.config.ts -n MigrationName
npx typeorm migration:run -d src/config/database.config.ts
npx typeorm migration:revert -d src/config/database.config.ts

# Docker
docker build -t {{ name }} .
docker run -p 3000:3000 --env-file .env {{ name }}

# NestJS CLI
npx nest generate module modules/new-feature
npx nest generate service modules/new-feature
npx nest generate controller modules/new-feature
```
