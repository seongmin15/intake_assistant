# Coding Standards — Sidekiq

> This skill defines coding rules for the **{{ name }}** service (Sidekiq / Ruby).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── app/
│   ├── workers/                       ← Sidekiq job classes (one per domain)
│   │   └── {domain}_worker.rb
│   ├── services/                      ← business logic (called by workers)
│   │   └── {domain}_service.rb
│   ├── models/                        ← ActiveRecord models (if using DB)
│   │   ├── application_record.rb
│   │   └── {domain}.rb
│   ├── queries/                       ← complex query objects
│   │   └── {domain}_query.rb
│   └── errors/                        ← domain exception classes
│       └── application_error.rb
├── config/
│   ├── sidekiq.yml                    ← queue definitions + concurrency
│   ├── initializers/
│   │   ├── sidekiq.rb                 ← Redis config + middleware
│   │   └── logging.rb
│   └── schedule.yml                   ← periodic jobs (sidekiq-cron)
├── lib/
│   ├── middleware/                     ← custom Sidekiq middleware
│   │   └── logging_middleware.rb
│   └── tasks/
├── spec/
│   ├── rails_helper.rb
│   ├── workers/
│   ├── services/
│   └── factories/
├── Gemfile
├── Gemfile.lock
└── Dockerfile
```

**Rules:**
- One worker file per domain (e.g., `email_worker.rb`, `report_worker.rb`).
- Workers are thin wrappers — they parse args, call services, handle retries.
- Business logic lives in `app/services/`, not in workers.
- Dependency flow: workers → services → models/repositories. Never the reverse.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Worker files | `{domain}_worker.rb` | `email_worker.rb` |
| Worker classes | PascalCase + `Worker` | `EmailWorker`, `ReportGenerationWorker` |
| Service classes | PascalCase + `Service` | `EmailService` |
| Queue names | snake_case | `default`, `email`, `reports`, `critical` |
| Scheduled job names | descriptive snake_case | `daily_report_generation` |
| Constants | UPPER_SNAKE | `MAX_RETRY_COUNT = 5` |

**Worker class naming:**
- Single-responsibility: `Send{Action}Worker` — e.g., `SendWelcomeEmailWorker`
- Domain-grouped: `{Domain}Worker` — e.g., `EmailWorker` (multiple related actions via separate methods dispatched by type)
- Prefer single-responsibility workers over multi-action workers.

---

## 3. Type Safety & Documentation

Ruby is dynamically typed. Compensate with discipline:

**YARD documentation** for all public methods:

```ruby
# @param user_id [String] UUID of the user
# @param template [String] email template name
# @return [void]
# @raise [Errors::NotFoundError] if user does not exist
def perform(user_id, template = "default")
  ...
end
```

**Rules:**
- Use keyword arguments in services (not in `perform` — Sidekiq serialization requires positional args).
- Use `freeze` on string constants: `QUEUE_NAME = "email".freeze`.
- Document all worker `perform` parameters with YARD.

```ruby
# ✅ Worker uses positional args (Sidekiq requirement)
class EmailWorker
  include Sidekiq::Job

  def perform(user_id, template)
    service = EmailService.new
    service.send_email(user_id: user_id, template: template)
  end
end

# ✅ Service uses keyword args (clarity)
class EmailService
  def send_email(user_id:, template:)
    ...
  end
end
```

---

## 4. Require & Autoloading

If using Rails with Sidekiq, Zeitwerk autoloads everything. If standalone:

```ruby
# config/boot.rb (standalone Sidekiq without Rails)
require "bundler/setup"
require "sidekiq"

# Manually require app code
Dir[File.join(__dir__, "../app/**/*.rb")].sort.each { |f| require f }
```

**With Rails:** same autoloading rules as the Rails skill — let Zeitwerk handle it.

**Gem imports — in Gemfile:**

```ruby
# Gemfile
gem "sidekiq", "~> 7.0"
gem "sidekiq-cron"                     # periodic jobs
gem "redis", "~> 5.0"

# Database (if needed)
gem "activerecord"
gem "pg"

group :development, :test do
  gem "rspec-sidekiq"
  gem "factory_bot"
  gem "rubocop", require: false
end
```

---

## 5. Worker Design Patterns

### Worker as thin wrapper

```ruby
# ✅ Worker delegates to service
class ProcessOrderWorker
  include Sidekiq::Job

  sidekiq_options queue: "orders", retry: 3

  def perform(order_id)
    service = OrderService.new
    service.process(order_id)
  end
end

# ❌ Worker contains business logic
class ProcessOrderWorker
  include Sidekiq::Job

  def perform(order_id)
    order = Order.find(order_id)
    order.update!(status: "processing")
    # ... 50 lines of business logic ...
  end
end
```

### Idempotency

Every worker must be safe to retry:

```ruby
class ChargePaymentWorker
  include Sidekiq::Job

  def perform(payment_id)
    payment = Payment.find(payment_id)
    return if payment.charged?  # idempotent — already processed

    PaymentService.new.charge(payment)
  end
end
```

### Argument serialization

```ruby
# ✅ Pass IDs and simple types
SendEmailWorker.perform_async(user.id, "welcome")

# ❌ Pass complex objects (serialization issues)
SendEmailWorker.perform_async(user)          # wrong — ActiveRecord object
SendEmailWorker.perform_async(Time.current)  # wrong — use ISO string
```

**Rules:**
- Arguments must be JSON-serializable: strings, numbers, booleans, arrays, hashes.
- Always pass model IDs, never full objects.
- Pass times as ISO 8601 strings, parse inside the worker.

---

## 6. Linting & Formatting

Same tooling as Rails:

| Tool | Purpose | Config file |
|------|---------|-------------|
| **RuboCop** | Linter + formatter | `.rubocop.yml` |
| **rubocop-rspec** | RSpec-specific rules | `.rubocop.yml` (require) |

```bash
rubocop                    # lint
rubocop -A                 # auto-fix safe corrections
```

**YARD documentation:** all public methods in workers and services.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in workers | Delegate to `app/services/` |
| Non-serializable args | Pass IDs and primitives only |
| No retry limit | Always set `retry:` option |
| Ignoring failures silently | Use `sidekiq_retries_exhausted` callback |
| Global mutable state | Each `perform` call is independent |
| `puts` / `p` for logging | Use `Sidekiq.logger` or structured logger (→ skills/common/observability/) |
| Blocking without timeout | Set timeouts on all external calls |
| Passing full objects to `perform_async` | Serialize to ID/string, fetch inside worker |
