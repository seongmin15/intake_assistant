# Deployment — Astro

> This skill defines deployment rules for the **{{ name }}** service (Astro).
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

```bash
{% if build_tool == "pnpm" %}
pnpm build                  # astro build → dist/
pnpm install --frozen-lockfile
{% endif %}
{% if build_tool == "npm" %}
npm ci
npm run build               # astro build → dist/
{% endif %}
{% if build_tool == "yarn" %}
yarn install --frozen-lockfile
yarn build
{% endif %}
```

**Astro adapters:**

```javascript
// astro.config.mjs
import { defineConfig } from "astro/config";
import node from "@astrojs/node";         // Node.js server (SSR)
// import vercel from "@astrojs/vercel";  // Vercel
// import cloudflare from "@astrojs/cloudflare"; // Cloudflare

export default defineConfig({
  output: "static",     // SSG: no adapter needed, outputs plain HTML
  // output: "server",  // SSR: requires adapter
  // adapter: node({ mode: "standalone" }),
});
```

**Rules:**
- `output: "static"` (default): No adapter needed. Output is plain HTML/CSS/JS in `dist/`.
- `output: "server"` or `"hybrid"`: Requires an adapter (`@astrojs/node`, `@astrojs/vercel`, etc.).
- Always commit the lock file.
- Use `--frozen-lockfile` in CI.

---

## 2. Container

**Dockerfile — SSG (static files via nginx):**

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

**Dockerfile — SSR (Node.js adapter):**

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 4321
ENV HOST=0.0.0.0
CMD ["node", "dist/server/entry.mjs"]
```

**nginx.conf (for SSG):**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ $uri.html =404;
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    error_page 404 /404.html;
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
# .env (dev only, not committed)
PUBLIC_SITE_URL=http://localhost:4321      # exposed to client
SECRET_API_KEY=xxx                          # server-only (SSR/build)
```

**Rules:**
- `PUBLIC_` prefix exposes vars to client (available via `import.meta.env.PUBLIC_*`).
- Non-prefixed vars are server-only (SSR endpoints, build-time data fetching).
- For SSG, all env vars are build-time only.
- For SSR, use `Astro.locals` or `import.meta.env` for runtime access.
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
4. Type/Astro check (astro check)
5. Unit tests (vitest)
6. Build (astro build)
7. E2E tests (against preview)
8. Deploy to target environment
```

**Rules:**
- `astro build` in CI catches content schema errors and SSG failures.
- `astro check` catches TypeScript and Astro-specific issues.
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
| Initial JS (gzip) | < 10 KB (zero-JS pages) to < 50 KB (with islands) |
| Largest Contentful Paint | < 1.5s (static pages) |
| Time to Interactive | < 2.0s |

**Rules:**
- Static pages should have near-zero JS — measure island overhead.
- Use `client:visible` / `client:idle` to defer island hydration.
- Use `<Image>` component for automatic image optimization.
- Pre-rendered pages are fully cacheable at CDN level.

---

## 6. Operational Commands

```bash
# Run locally
npm run dev                    # dev server with HMR

# Build and preview
npm run build && npm run preview

# Astro diagnostics
astro check

# Sync content types
astro sync
```
