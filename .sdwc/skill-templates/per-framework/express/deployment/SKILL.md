# Deployment — Express

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

{% if build_tool == "npm" %}
```bash
npm ci                      # clean install (CI)
npm run build               # tsc → dist/
```
{% endif %}
{% if build_tool == "pnpm" %}
```bash
pnpm install --frozen-lockfile
pnpm build                  # tsc → dist/
```
{% endif %}
{% if build_tool == "yarn" %}
```bash
yarn install --frozen-lockfile
yarn build                  # tsc → dist/
```
{% endif %}

**package.json scripts:**

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  }
}
```

**Rules:**
- Always commit the lock file (`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`).
- Use `--frozen-lockfile` (or `npm ci`) in CI for reproducible builds.
- Development uses `tsx` (TypeScript execution). Production runs compiled JS from `dist/`.

---

## 2. Container

**Dockerfile (multi-stage build):**

```dockerfile
# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
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
CMD ["node", "dist/index.js"]
```

**.dockerignore:**

```
node_modules
dist
.git
.env
tests/
*.md
```

**Rules:**
- Multi-stage build: build with dev deps, run with production deps only.
- Set `NODE_ENV=production` in runtime stage.
- Run as non-root user (`USER node`).
- Never copy `node_modules` into the image — install fresh.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**

- IaC files location: `infra/` directory at project root.
- Never hardcode environment-specific values — use variables/parameters.
- All infra changes go through the same PR review process as code.
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Configuration management:**

```typescript
// config/index.ts
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export const config = EnvSchema.parse(process.env);
```

**Rules:**
- Validate all env vars at startup with zod — fail fast on missing config.
- All config via environment variables. Never hardcode secrets or URLs.
- Use `.env` for local development only. Never commit `.env` files.
{% if deployment.secrets_management %}
- **Secrets management: {{ deployment.secrets_management }}** — fetch secrets from this source in production.
{% endif %}

---

## 4. CI/CD Pipeline

{% if deployment.ci %}
**Tool: {{ deployment.ci.tool }}**
{% if deployment.ci.pipeline_stages %}
**Stages: {{ deployment.ci.pipeline_stages }}**
{% endif %}

Standard pipeline steps for this service:

```
1. Checkout code
2. Install dependencies (npm ci)
3. Lint (npx eslint .)
4. Type check (npx tsc --noEmit)
5. Unit tests (npm test -- tests/unit/)
6. Integration tests (npm test -- tests/integration/)
7. Build (npm run build)
8. Build container image
9. Push to registry
10. Run migrations (on deploy target)
11. Deploy application
```

**Rules:**
- Pipeline must pass before merge.
- Migrations run as a pre-deploy step — separate from app startup.
- Container image tag uses git commit SHA for traceability.
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

```typescript
// routes/health.routes.ts
import { Router } from "express";
import { dataSource } from "@/config/database";

export const healthRoutes = Router();

healthRoutes.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

healthRoutes.get("/ready", async (req, res) => {
  try {
    await dataSource.query("SELECT 1");
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not ready" });
  }
});
```

**Register before auth middleware (public):**

```typescript
// app.ts
app.use(healthRoutes);        // no auth
app.use("/api/v1", routes);   // auth applied per route
```

**Rules:**
- `/health` — no dependencies, always fast. Used for liveness.
- `/ready` — checks DB and critical dependencies. Used for readiness.
- Both endpoints skip authentication.

---

## 6. Operational Commands

```bash
# Development
npm run dev                             # tsx watch mode

# Production
npm run build && npm start              # compile + run

# Database (TypeORM)
npx typeorm migration:generate -d src/config/database.ts -n MigrationName
npx typeorm migration:run -d src/config/database.ts
npx typeorm migration:revert -d src/config/database.ts

# Docker
docker build -t {{ name }} .
docker run -p 3000:3000 --env-file .env {{ name }}

# Logs (container)
docker logs -f {container_name}
```
