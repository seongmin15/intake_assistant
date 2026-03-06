# Deployment — Sidekiq

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

{% if build_tool == "bundler" %}
```bash
bundle install               # install dependencies
bundle lock                  # update Gemfile.lock
bundle audit                 # check gem vulnerabilities
```

**Rules:**
- Always commit `Gemfile.lock`.
- Pin major versions in `Gemfile` (e.g., `gem "sidekiq", "~> 7.0"`).
- Use groups for environment-specific gems: `:development`, `:test`, `:production`.
- Run `bundle audit` to check for known vulnerabilities.
{% endif %}

---

## 2. Container

**Dockerfile:**

```dockerfile
# Build stage
FROM ruby:3.3-slim AS builder
RUN apt-get update && apt-get install -y build-essential libpq-dev git
WORKDIR /app
COPY Gemfile Gemfile.lock ./
RUN bundle config set --local deployment true && \
    bundle config set --local without "development test" && \
    bundle install --jobs 4

# Runtime stage
FROM ruby:3.3-slim
RUN apt-get update && apt-get install -y libpq5 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/vendor/bundle ./vendor/bundle
COPY --from=builder /usr/local/bundle/config /usr/local/bundle/config
COPY . .

CMD ["bundle", "exec", "sidekiq", "-C", "config/sidekiq.yml"]
```

**Separate containers for worker and cron (if using sidekiq-cron):**

```yaml
# docker-compose example
services:
  worker:
    build: .
    command: bundle exec sidekiq -C config/sidekiq.yml
    environment:
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

**Rules:**
- Multi-stage builds to minimize image size.
- Never copy `.env` files into the image. Inject environment variables at runtime.
- Exclude development and test gems from the production image.
- Worker concurrency is configured via `config/sidekiq.yml`, not in Dockerfile.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**

- IaC files location: `infra/` directory at project root.
- Never hardcode environment-specific values.
- All infra changes go through the same PR review process as code.
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Configuration management:**

```ruby
# config/initializers/sidekiq.rb
Sidekiq.configure_server do |config|
  config.redis = { url: ENV.fetch("REDIS_URL") }
end

Sidekiq.configure_client do |config|
  config.redis = { url: ENV.fetch("REDIS_URL") }
end
```

**Rules:**
- All config via environment variables. Never hardcode Redis URLs or secrets.
- Use `.env` for local development only (via `dotenv` gem). Never commit `.env` files.
- Each environment loads its own variables (via deployment platform, not files).
- Redis URL is environment-specific — different per staging/production.
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
2. Install Ruby + bundle install (with cache)
3. Lint (rubocop)
4. Unit tests (rspec spec/workers/ spec/services/)
5. Integration tests (rspec spec/ --tag integration — with Redis in CI)
6. Security audit (bundle audit, brakeman if Rails)
7. Build container image
8. Push to registry
9. Deploy worker
```

**Rules:**
- Pipeline must pass before merge.
- Integration tests require Redis service in CI (e.g., `services: redis`).
- Run `bundle audit` on every CI run.
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

## 5. Health Check

Workers don't serve HTTP. Health checks use the Sidekiq API:

```ruby
# health_check.rb (run as a script or sidecar)
require "sidekiq/api"

def healthy?
  processes = Sidekiq::ProcessSet.new
  processes.any? { |p| p["hostname"] == `hostname`.strip }
rescue Redis::CannotConnectError
  false
end

exit(healthy? ? 0 : 1)
```

**For container orchestrators:**

```yaml
# Kubernetes example
livenessProbe:
  exec:
    command: ["bundle", "exec", "ruby", "health_check.rb"]
  initialDelaySeconds: 30
  periodSeconds: 30
```

**Alternative — Sidekiq Web UI health endpoint:**

```ruby
# If Sidekiq Web is mounted, use /sidekiq/stats as a basic check
```

**Rules:**
- Workers don't expose HTTP ports — use exec probes or sidecar patterns.
- Monitor Redis connectivity as part of health checks.
- Monitor queue depth — alert if queues grow unboundedly (→ skills/common/observability/).

---

## 6. Operational Commands

```bash
# Start worker
bundle exec sidekiq -C config/sidekiq.yml

# Start with specific queues
bundle exec sidekiq -q critical -q default -q low

# Start with concurrency
bundle exec sidekiq -c 20

# Quiet (stop fetching new jobs, finish current)
kill -TSTP $(cat tmp/pids/sidekiq.pid)   # or via API

# Stop gracefully
kill -TERM $(cat tmp/pids/sidekiq.pid)

# Sidekiq Web UI (if mounted in Rails)
# Visit http://localhost:3000/sidekiq

# Console — inspect queues
bundle exec rails console  # or irb with sidekiq loaded
> Sidekiq::Queue.all.map { |q| [q.name, q.size] }
> Sidekiq::RetrySet.new.size
> Sidekiq::DeadSet.new.size
> Sidekiq::Stats.new.processed

# Clear a specific queue (caution!)
> Sidekiq::Queue.new("default").clear

# Retry all dead jobs
> Sidekiq::DeadSet.new.each(&:retry)

# Logs (container)
docker logs -f {container_name}
```

### Scaling

```bash
# Horizontal scaling — run more Sidekiq processes
# Each process has its own concurrency pool
docker-compose up --scale worker=3

# Vertical scaling — increase concurrency per process
# config/sidekiq.yml
:concurrency: 20
```
