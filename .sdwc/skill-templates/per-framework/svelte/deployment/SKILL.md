# Deployment — Svelte

> This skill defines deployment rules for the **{{ name }}** service (SvelteKit).
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

```bash
{% if build_tool == "vite" %}
npm run build               # SvelteKit build (uses Vite internally)
npm run preview             # preview production build locally
{% endif %}
{% if build_tool == "pnpm" %}
pnpm build
pnpm install --frozen-lockfile  # CI install
{% endif %}
{% if build_tool == "npm" %}
npm ci                      # CI install (clean)
npm run build
{% endif %}
{% if build_tool == "yarn" %}
yarn install --frozen-lockfile
yarn build
{% endif %}
```

**SvelteKit adapters:**

SvelteKit uses adapters to target different deployment platforms.

```javascript
// svelte.config.js
import adapter from "@sveltejs/adapter-node";     // Node.js server
// import adapter from "@sveltejs/adapter-static"; // Static site
// import adapter from "@sveltejs/adapter-auto";   // Auto-detect platform

export default {
  kit: {
    adapter: adapter({ out: "build" }),
  },
};
```

**Rules:**
- Choose adapter based on deployment target: `adapter-node` for containers, `adapter-static` for CDN/static, `adapter-auto` for Vercel/Netlify/Cloudflare.
- Always commit the lock file.
- Use `--frozen-lockfile` (or `npm ci`) in CI.
- Check bundle size in CI.

---

## 2. Container

**Dockerfile (multi-stage build, adapter-node):**

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
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
ENV PORT=3000
CMD ["node", "build"]
```

**For static adapter (SPA/SSG), use nginx instead:**

```dockerfile
FROM nginx:alpine
COPY build/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**.dockerignore:**

```
node_modules
.git
.env*
.svelte-kit/
build/
```

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
PUBLIC_API_URL=http://localhost:8000    # exposed to client
SECRET_API_KEY=xxx                      # server-only
```

**Rules:**
- Prefix with `PUBLIC_` to expose to client bundle. All others are server-only.
- Access via `$env/static/public`, `$env/static/private`, `$env/dynamic/public`, `$env/dynamic/private`.
- Never put secrets in `PUBLIC_` vars — they are visible in the bundle.
- Use `$env/dynamic/*` for runtime env vars (adapter-node).
- Use `$env/static/*` for build-time env vars (adapter-static).
{% if deployment.secrets_management %}
- **Secrets management: {{ deployment.secrets_management }}** — for server-side secrets only.
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
3. Lint (eslint src/)
4. Type check (svelte-check)
5. Unit tests (vitest)
6. Build (npm run build)
7. E2E tests (against preview build)
8. Deploy to target environment
```

**Rules:**
- Pipeline must pass before merge.
- E2E tests run against `npm run preview`, not dev server.
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
| Initial JS (gzip) | < 50 KB (SvelteKit is lightweight) |
| Largest Contentful Paint | < 2.5s |
| First Input Delay | < 100ms |

**Rules:**
- SvelteKit auto-splits by route — minimal manual optimization needed.
- Use `data-sveltekit-preload-data` for link preloading.
- Analyze bundle: check `.svelte-kit/output` after build.

---

## 6. Operational Commands

```bash
# Run locally
npm run dev                    # dev server with HMR

# Build and preview
npm run build && npm run preview

# Type check
svelte-check

# Sync types
svelte-kit sync
```
