# Deployment — React

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

```bash
{% if build_tool == "vite" %}
npm run build               # vite build → dist/
npm run preview             # preview production build locally
{% endif %}
{% if build_tool == "webpack" %}
npm run build               # webpack → dist/
{% endif %}
{% if build_tool == "turbopack" %}
npm run build               # next build → .next/
{% endif %}
{% if build_tool == "pnpm" %}
pnpm build                  # build via pnpm
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

**Rules:**
- Always commit the lock file (`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`).
- Use `--frozen-lockfile` (or `npm ci`) in CI to ensure reproducible builds.
- Check bundle size in CI — flag increases over 10%.

---

## 2. Container

**Dockerfile (multi-stage build):**

```dockerfile
# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage — serve static files
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**nginx.conf (SPA routing):**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**.dockerignore:**

```
node_modules
.git
.env*
dist/
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
# .env.local (dev only, not committed)
VITE_API_URL=http://localhost:8000
VITE_APP_ENV=development
```

**Rules:**
- Prefix all env vars with `VITE_` (or framework equivalent) to expose to client.
- Never put secrets in client-side env vars — they are visible in the bundle.
- Build-time injection only. Use `import.meta.env.VITE_*` to access.
- Per-environment values are set in the deployment platform, not in `.env` files.
{% if deployment.secrets_management %}
- **Secrets management: {{ deployment.secrets_management }}** — for server-side secrets only (SSR, BFF).
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
4. Type check (tsc --noEmit)
5. Unit tests (vitest)
6. Build (npm run build)
7. Bundle size check
8. E2E tests (against preview build)
9. Deploy to target environment
```

**Rules:**
- Pipeline must pass before merge.
- E2E tests run against a built preview, not dev server.
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
| Initial bundle (gzip) | < 200 KB |
| Largest Contentful Paint | < 2.5s |
| First Input Delay | < 100ms |

**Rules:**
- Analyze bundle with `npx vite-bundle-visualizer` (or equivalent).
- Lazy-load routes and heavy components.
- Tree-shake unused library exports.

---

## 6. Operational Commands

```bash
# Run locally
npm run dev                    # dev server with HMR

# Build and preview
npm run build && npm run preview

# Analyze bundle
npx vite-bundle-visualizer

# Check types
tsc --noEmit
```
