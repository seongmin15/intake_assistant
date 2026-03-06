# Deployment — Nuxt

> This skill defines deployment rules for the **{{ name }}** service (Nuxt / Nitro).
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

```bash
{% if build_tool == "pnpm" %}
pnpm build                  # nuxi build → .output/
pnpm install --frozen-lockfile  # CI install
{% endif %}
{% if build_tool == "npm" %}
npm ci                      # CI install (clean)
npm run build               # nuxi build → .output/
{% endif %}
{% if build_tool == "yarn" %}
yarn install --frozen-lockfile
yarn build                  # nuxi build → .output/
{% endif %}

**Nitro presets:**

Nuxt uses Nitro as its server engine. Preset controls the output format.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: "node-server",    // Node.js server (default, for Docker)
    // preset: "static",      // Static generation
    // preset: "vercel",      // Vercel deployment
    // preset: "cloudflare-pages", // Cloudflare
  },
});
```

**Rules:**
- Use `node-server` preset for containerized deployments.
- Use `static` preset only for fully static sites (`nuxi generate`).
- Always commit the lock file.
- Use `--frozen-lockfile` (or `npm ci`) in CI.

---

## 2. Container

**Dockerfile (node-server preset):**

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
COPY --from=builder /app/.output ./

EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0
CMD ["node", "server/index.mjs"]
```

**.dockerignore:**

```
node_modules
.git
.env*
.nuxt/
.output/
```

**Rules:**
- `.output/` is self-contained — it includes all dependencies. No `npm install` in runtime stage.
- `node server/index.mjs` is the production entry point.

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
# .env (dev only, not committed)
NUXT_PUBLIC_API_URL=http://localhost:8000   # exposed to client (runtimeConfig.public)
NUXT_API_SECRET=xxx                         # server-only (runtimeConfig)
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    apiSecret: "",              // server-only, overridden by NUXT_API_SECRET
    public: {
      apiUrl: "",               // client + server, overridden by NUXT_PUBLIC_API_URL
    },
  },
});
```

```vue
<!-- Usage in component -->
<script setup lang="ts">
const config = useRuntimeConfig();
// config.public.apiUrl — available on client and server
</script>
```

**Rules:**
- Use `runtimeConfig` for all env vars. Access via `useRuntimeConfig()`.
- `NUXT_` prefix auto-maps to `runtimeConfig` keys (`NUXT_PUBLIC_*` → `runtimeConfig.public.*`).
- Server-only vars (`runtimeConfig.*` without `public`) are never exposed to client.
- Runtime vars can change without rebuilding (unlike Next.js `NEXT_PUBLIC_*`).
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
3. Lint (eslint .)
4. Type check (nuxi typecheck)
5. Unit tests (vitest)
6. Build (nuxi build)
7. E2E tests (against production build)
8. Deploy to target environment
```

**Rules:**
- Pipeline must pass before merge.
- Use `nuxi typecheck` instead of `vue-tsc` for Nuxt-aware type checking.
- E2E tests run against `node .output/server/index.mjs`.
- Tag container images with git commit SHA.
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
| Client JS bundle (gzip) | < 150 KB |
| Time to Interactive | < 3.5s |

**Rules:**
- Nuxt auto-splits by route — minimal manual optimization needed.
- Use `<NuxtImg>` for automatic image optimization.
- Analyze payload sizes via Nuxt DevTools.
- Use `useLazyFetch` for non-critical data.

---

## 6. Operational Commands

```bash
# Run locally (dev)
npm run dev                    # dev server with HMR

# Build and preview
npm run build && node .output/server/index.mjs

# Generate static site
nuxi generate

# Type check
nuxi typecheck

# Prepare types
nuxi prepare
```
