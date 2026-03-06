# Deployment — Next.js

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

```bash
{% if build_tool == "turbopack" %}
npm run build               # next build (Turbopack)
npm run start               # production server locally
{% endif %}
{% if build_tool == "pnpm" %}
pnpm build                  # next build
pnpm install --frozen-lockfile  # CI install
{% endif %}
{% if build_tool == "npm" %}
npm ci                      # CI install (clean)
npm run build               # next build
{% endif %}
{% if build_tool == "yarn" %}
yarn install --frozen-lockfile
yarn build                  # next build
{% endif %}

**Output modes:**

```javascript
// next.config.ts
const config = {
  output: "standalone",     // Self-contained Node.js server (for Docker)
  // output: "export",      // Static export (no SSR, no API routes)
};
```

**Rules:**
- Use `output: "standalone"` for containerized deployments — produces minimal Node.js server.
- Use `output: "export"` only for fully static sites (no SSR, no Server Actions).
- Always commit the lock file.
- Use `--frozen-lockfile` (or `npm ci`) in CI.

---

## 2. Container

**Dockerfile (standalone output):**

```dockerfile
# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-slim
WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

**.dockerignore:**

```
node_modules
.git
.env*
.next/
```

**Rules:**
- `standalone` output copies only required `node_modules` — image size is minimal.
- Copy `.next/static` and `public/` separately — they are not included in standalone.
- Set `HOSTNAME="0.0.0.0"` to listen on all interfaces in container.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**

- IaC files location: `infra/` directory at project root.
- Never hardcode environment-specific values.
- All infra changes go through PR review.
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Environment variables:**

```bash
# .env.local (dev only, not committed)
NEXT_PUBLIC_API_URL=http://localhost:8000   # exposed to client
API_SECRET_KEY=xxx                          # server-only
```

**Rules:**
- Prefix with `NEXT_PUBLIC_` to expose to client bundle. All others are server-only.
- `NEXT_PUBLIC_*` vars are inlined at build time — they cannot change at runtime.
- Server-only vars are available in Server Components, API routes, middleware, and Server Actions.
- Per-environment values are set in the deployment platform.
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
2. Install dependencies (--frozen-lockfile)
3. Lint (next lint)
4. Type check (tsc --noEmit)
5. Unit tests (vitest)
6. Build (next build)
7. E2E tests (against production build)
8. Deploy to target environment
```

**Rules:**
- Pipeline must pass before merge.
- E2E tests run against `next start`, not dev server.
- Tag container images with git commit SHA.
- Enable build cache (`next build` uses `.next/cache`).
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

## 5. Performance Budget

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s (SSR advantage) |
| Largest Contentful Paint | < 2.5s |
| Client JS bundle (gzip) | < 100 KB (Server Components reduce client JS) |
| Time to Interactive | < 3.5s |

**Rules:**
- Check bundle with `@next/bundle-analyzer`.
- Server Components produce zero client JS — maximize their usage.
- Use `next/image` for automatic image optimization.
- Monitor Core Web Vitals via Next.js Analytics or Lighthouse CI.

---

## 6. Operational Commands

```bash
# Run locally (dev)
npm run dev                    # dev server with HMR (Turbopack)

# Build and run production
npm run build && npm run start

# Analyze bundle
ANALYZE=true npm run build     # with @next/bundle-analyzer

# Check types
tsc --noEmit

# Lint
next lint
```
