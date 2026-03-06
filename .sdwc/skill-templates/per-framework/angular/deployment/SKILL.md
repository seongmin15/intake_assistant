# Deployment — Angular

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

```bash
{% if build_tool == "pnpm" %}
pnpm build                  # ng build → dist/
pnpm install --frozen-lockfile
{% endif %}
{% if build_tool == "npm" %}
npm ci
npm run build               # ng build → dist/{name}/browser/
{% endif %}
{% if build_tool == "yarn" %}
yarn install --frozen-lockfile
yarn build
{% endif %}
```

**Build configuration:**

```bash
ng build --configuration=production   # AOT, tree-shaking, minification
```

**Rules:**
- Always use production configuration for deployments.
- Always commit the lock file.
- Use `--frozen-lockfile` (or `npm ci`) in CI.
- Angular CLI outputs to `dist/{project-name}/browser/` — serve this directory.

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
RUN npm run build -- --configuration=production

# Runtime stage
FROM nginx:alpine
COPY --from=builder /app/dist/{{ name }}/browser /usr/share/nginx/html
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
.angular/
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

**Environment files:**

```typescript
// src/environments/environment.ts (dev)
export const environment = {
  production: false,
  apiUrl: "http://localhost:8000",
};

// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: "/api",  // relative URL in production
};
```

**Rules:**
- Angular CLI handles file replacement via `angular.json` `fileReplacements`.
- Environment files are build-time — values are baked into the bundle.
- Never put secrets in environment files — they are visible in the bundle.
- For runtime config, fetch from a config endpoint at app init.
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
3. Lint (ng lint)
4. Type check (included in build)
5. Unit tests (ng test --watch=false --browsers=ChromeHeadless)
6. Build (ng build --configuration=production)
7. Bundle size check
8. E2E tests
9. Deploy to target environment
```

**Rules:**
- Pipeline must pass before merge.
- Use `--watch=false` and headless browser in CI.
- Tag container images with git commit SHA.
- Cache `.angular/cache/` between builds for faster CI.
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
| Initial bundle (gzip) | < 250 KB |
| Largest Contentful Paint | < 2.5s |
| First Input Delay | < 100ms |

**Rules:**
- Use `ng build --stats-json` + `webpack-bundle-analyzer` to analyze bundle.
- Configure budgets in `angular.json` — CI fails if exceeded.
- Lazy-load all feature routes.
- Use `@defer` for heavy in-page components.

```json
// angular.json budgets
"budgets": [
  { "type": "initial", "maximumWarning": "200kb", "maximumError": "300kb" }
]
```

---

## 6. Operational Commands

```bash
# Run locally
ng serve                     # dev server with HMR

# Build and preview
ng build && npx http-server dist/{{ name }}/browser

# Analyze bundle
ng build --stats-json && npx webpack-bundle-analyzer dist/{{ name }}/browser/stats.json

# Lint
ng lint

# Test
ng test --watch=false
```
