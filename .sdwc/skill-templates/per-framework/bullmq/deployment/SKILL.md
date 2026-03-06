# Deployment — BullMQ

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
- Always commit the lock file.
- Use `--frozen-lockfile` in CI for reproducible builds.
- Workers run compiled JS from `dist/` in production.

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

USER node
CMD ["node", "dist/index.js"]
```

**Rules:**
- No `EXPOSE` needed — workers don't serve HTTP traffic (unless adding a health check server).
- Run as non-root user (`USER node`).
- Workers scale by increasing container replicas, not by threads.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**

- IaC files location: `infra/` directory at project root.
- Include Redis provisioning in IaC.
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Required environment variables:**

```bash
REDIS_URL=redis://localhost:6379    # Redis connection URL
DATABASE_URL=                       # if using DB
LOG_LEVEL=info                      # fatal|error|warn|info|debug|trace
NODE_ENV=production
```

**Rules:**
- Validate all env vars at startup with zod — fail fast.
- Never hardcode Redis URLs or secrets.
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
5. Unit tests (npm test -- tests/unit/)
6. Integration tests (npm test -- tests/integration/)  ← requires Redis
7. Build (npm run build)
8. Build container image
9. Push to registry
10. Deploy workers (rolling update)
```

**Rules:**
- Integration tests need a Redis service in CI (e.g., `services: redis:7` in GitHub Actions).
- Rolling deploys: new workers start before old ones stop — BullMQ handles job handoff.
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

## 5. Health Check

Workers don't serve HTTP by default. Add a minimal health check server:

```typescript
// health.ts
import http from "node:http";

export function startHealthServer(port = 8080) {
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200).end(JSON.stringify({ status: "ok" }));
    } else {
      res.writeHead(404).end();
    }
  });
  server.listen(port);
  return server;
}
```

**Add to bootstrap:**

```typescript
// index.ts
startHealthServer(8080);
```

**Rules:**
- Health check confirms the process is alive.
- Readiness could check Redis connectivity if needed.
- Health port should differ from any API port.

---

## 6. Scaling

**Horizontal scaling:**
- Each worker container processes jobs independently.
- Increase replicas to handle more throughput.
- BullMQ distributes jobs across workers automatically.

**Concurrency tuning:**

```
Total throughput = replicas × concurrency_per_worker × (1 / avg_job_duration)
```

- Start with concurrency 5-10 per worker.
- Monitor Redis memory, CPU, and job processing latency.
- Adjust replicas and concurrency based on queue depth.

---

## 7. Operational Commands

```bash
# Development
npm run dev                             # tsx watch mode

# Production
npm run build && npm start

# Docker
docker build -t {{ name }} .
docker run --env-file .env {{ name }}

# Queue inspection (BullMQ CLI or Bull Board)
# Install: npm install -g @bull-board/express
# Or use programmatic access:
npx ts-node -e "
  import { Queue } from 'bullmq';
  const q = new Queue('email-queue', { connection: { host: 'localhost' } });
  console.log(await q.getJobCounts());
  await q.close();
"

# Drain queue (remove all jobs)
npx ts-node -e "
  import { Queue } from 'bullmq';
  const q = new Queue('email-queue', { connection: { host: 'localhost' } });
  await q.drain();
  await q.close();
"
```
