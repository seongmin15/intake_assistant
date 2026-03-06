# Deployment — Rails

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

{% if build_tool == "bundler" %}
```bash
bundle install               # install dependencies
bundle lock                  # update Gemfile.lock
bundle exec rails assets:precompile  # if assets exist (skip for API-only)
```

**Rules:**
- Always commit `Gemfile.lock`.
- Pin major versions in `Gemfile` (e.g., `gem "rails", "~> 7.1"`).
- Use groups for environment-specific gems: `:development`, `:test`, `:production`.
- Run `bundle audit` to check for known vulnerabilities in dependencies.
{% endif %}

---

## 2. Container

**Dockerfile (multi-stage build):**

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

# Precompile bootsnap (faster boot)
RUN bundle exec bootsnap precompile --gemfile app/ lib/

EXPOSE 3000
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
```

**.dockerignore:**

```
.git
.env
tmp/
log/
spec/
node_modules/
storage/
coverage/
```

**Rules:**
- Always use multi-stage builds to minimize image size.
- Never copy `.env` files into the image. Inject environment variables at runtime.
- Use `bundle config deployment true` in the build stage for reproducible installs.
- Exclude development and test gems from the production image.

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

```ruby
# config/database.yml
default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS", 5) %>

production:
  <<: *default
  url: <%= ENV["DATABASE_URL"] %>

# Access in code
database_url = ENV.fetch("DATABASE_URL")
secret_key = Rails.application.credentials.secret_key_base
```

**Rails credentials (for secrets):**

```bash
# Edit credentials (opens $EDITOR)
EDITOR="vim" rails credentials:edit

# Access in code
Rails.application.credentials.dig(:aws, :access_key_id)
```

**Rules:**
- All config via environment variables or Rails credentials. Never hardcode secrets.
- Use `ENV.fetch("KEY")` (raises on missing) for required vars, `ENV["KEY"]` for optional.
- Use `.env` for local development only (via `dotenv-rails` gem). Never commit `.env` files.
- Each environment loads its own variables (via deployment platform, not files).
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
4. Unit tests (rspec spec/models/ spec/services/)
5. Integration tests (rspec spec/requests/)
6. Security audit (bundle audit, brakeman)
7. Build container image
8. Push to registry
9. Run migrations (rails db:migrate on target)
10. Deploy application
```

**Rails-specific CI tools:**

| Tool | Purpose |
|------|---------|
| `rubocop` | Lint and style |
| `brakeman` | Static security analysis |
| `bundle audit` | Gem vulnerability check |
| `rspec` | Test execution |

**Rules:**
- Pipeline must pass before merge.
- Integration tests run against a disposable test database.
- Run `brakeman` on every CI run — fail on high-confidence warnings.
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

```ruby
# app/controllers/health_controller.rb
class HealthController < ApplicationController
  skip_before_action :authenticate_user!

  def show
    render json: { status: "ok" }
  end

  def ready
    ActiveRecord::Base.connection.execute("SELECT 1")
    render json: { status: "ready" }
  rescue StandardError
    render json: { status: "not ready" }, status: :service_unavailable
  end
end
```

**Route registration (public):**

```ruby
# config/routes.rb
get "health", to: "health#show"
get "ready", to: "health#ready"
```

**Rules:**
- `/health` — no dependencies, always fast. Used for liveness.
- `/ready` — checks DB and critical dependencies. Used for readiness.
- Both endpoints skip authentication (`skip_before_action`).

---

## 6. Operational Commands

```bash
# Run locally (development)
bundle exec rails server -b 0.0.0.0 -p 3000

# Run in production (Puma)
bundle exec puma -C config/puma.rb

# Database
bundle exec rails db:create         # create database
bundle exec rails db:migrate        # apply migrations
bundle exec rails db:rollback       # rollback last migration
bundle exec rails db:migrate:status # check migration status
bundle exec rails db:seed           # seed data

# Console
bundle exec rails console           # interactive Rails console
bundle exec rails dbconsole          # database console

# Routes
bundle exec rails routes             # list all routes

# Generators
bundle exec rails generate model User email:string name:string
bundle exec rails generate migration AddRoleToUsers role:string

# Logs (container)
docker logs -f {container_name}

# Shell access (container)
docker exec -it {container_name} /bin/bash
```

### Puma Configuration

```ruby
# config/puma.rb
workers ENV.fetch("WEB_CONCURRENCY", 2)
threads_count = ENV.fetch("RAILS_MAX_THREADS", 5)
threads threads_count, threads_count

port ENV.fetch("PORT", 3000)
environment ENV.fetch("RAILS_ENV", "development")

preload_app!

on_worker_boot do
  ActiveRecord::Base.establish_connection
end
```
