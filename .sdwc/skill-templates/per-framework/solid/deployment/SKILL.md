# Deployment — Solid

> This skill defines deployment rules for the **{{ name }}** service (SolidJS).
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

```bash
{% if build_tool == "vite" %}
npm run build               # vite build → dist/
npm run preview             # preview production build locally
{% endif %}
{% if build_tool == "pnpm" %}
pnpm build
pnpm install --frozen-lockfile
{% endif %}
{% if build_tool == "npm" %}
npm ci
npm run build
{% endif %}
{% if build_tool == "yarn" %}
yarn install --frozen-lockfile
yarn build
{% endif %}
```

**SolidStart (if using SSR):**

```bash
npm run build               # SolidStart build with Vinxi/Nitro
npm run start               # production server
```

**Rules:**
- Solid uses Vite by default. Build output is `dist/`.
- If using SolidStart (SSR), output depends on the deployment preset (similar to Nitro).
- Always commit the lock file.
- Use `--frozen-lockfile` (or `npm ci`) in CI.

---

## 2. Container

**Dockerfile (multi-stage build — SPA):**

```dockerfile
# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
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
- Prefix with `VITE_` to expose to client bundle.
- Never put secrets in client-side env vars.
- Build-time injection. Access via `import.meta.env.VITE_*`.
- Per-environment values set in deployment platform.
{% if deployment.secrets_management %}
- **Secrets management: {{ deployment.secrets_management }}** — for server-side secrets only (SolidStart SSR).
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
8. E2E tests
9. Deploy to target environment
```

**Rules:**
- Pipeline must pass before merge.
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
| Initial bundle (gzip) | < 30 KB (Solid is very lightweight) |
| Largest Contentful Paint | < 2.0s |
| First Input Delay | < 50ms |

**Rules:**
- Solid produces small bundles by default — no VDOM overhead.
- Analyze bundle with `npx vite-bundle-visualizer`.
- Lazy-load routes with `lazy()`.

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
