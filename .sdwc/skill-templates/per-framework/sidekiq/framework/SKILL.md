# Framework — Sidekiq

> This skill defines Sidekiq-specific patterns for the **{{ name }}** service.
> Read this before building or modifying any worker logic.

---

## 1. Application Setup

### Sidekiq Configuration

```ruby
# config/initializers/sidekiq.rb
Sidekiq.configure_server do |config|
  config.redis = { url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0") }

  # Server middleware (runs around each job)
  config.server_middleware do |chain|
    chain.add Middleware::LoggingMiddleware
  end
end

Sidekiq.configure_client do |config|
  config.redis = { url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0") }
end

# Strict argument checking (Sidekiq 7+)
Sidekiq.strict_args!
```

### Queue Configuration

```yaml
# config/sidekiq.yml
:concurrency: <%= ENV.fetch("SIDEKIQ_CONCURRENCY", 10) %>
:queues:
  - [critical, 3]          # weight 3 (processed 3x more often)
  - [default, 2]
  - [low, 1]
```

**Logging setup** (→ also see skills/common/observability/):

```ruby
# config/initializers/logging.rb
Sidekiq.logger = Sidekiq::Logger.new($stdout)
Sidekiq.logger.level = Logger.const_get(ENV.fetch("LOG_LEVEL", "INFO"))

# Structured JSON logging
require "lograge"
# or custom formatter:
Sidekiq.logger.formatter = proc do |severity, datetime, _progname, msg|
  { timestamp: datetime.iso8601, level: severity, message: msg, service: "{{ name }}" }.to_json + "\n"
end
```

Use `Sidekiq.logger` or `Rails.logger` everywhere — never `puts` or `p`.

---

## 2. Job Definition

### Basic job

```ruby
class ProcessOrderWorker
  include Sidekiq::Job

  sidekiq_options(
    queue: "default",
    retry: 5,                        # max retry count
    dead: true,                      # move to dead set after exhaustion
    lock: :until_executed,           # uniqueness (if using sidekiq-unique-jobs)
    tags: ["orders"]                 # for filtering in Web UI
  )

  def perform(order_id)
    service = OrderService.new
    service.process(order_id)
  rescue Errors::TransientError => e
    Sidekiq.logger.warn("Transient error, will retry", order_id: order_id, error: e.message)
    raise  # Sidekiq auto-retries on exception
  end
end
```

**Rules:**
- Always `include Sidekiq::Job` (not `Sidekiq::Worker` — deprecated alias).
- Always set `queue:` explicitly — never rely on the default queue for production jobs.
- Always set `retry:` — default is 25, which is often too many.
- Arguments to `perform` must be JSON-serializable primitives.
- Use `dead: true` so failed jobs go to the Dead Set for inspection.

### Enqueuing jobs

```ruby
# Immediate execution (queued)
ProcessOrderWorker.perform_async(order.id)

# Delayed execution
ProcessOrderWorker.perform_in(5.minutes, order.id)
ProcessOrderWorker.perform_at(Time.current + 1.hour, order.id)

# Bulk enqueue (efficient for many jobs)
args = orders.map { |o| [o.id] }
Sidekiq::Client.push_bulk("class" => ProcessOrderWorker, "args" => args)
```

---

## 3. Retry & Error Handling

### Retry strategy

Sidekiq retries automatically with exponential backoff: `(retry_count ** 4) + 15 + (rand(10) * (retry_count + 1))` seconds.

```ruby
class ResilientWorker
  include Sidekiq::Job

  sidekiq_options retry: 5

  # Custom retry delay (override default backoff)
  sidekiq_retry_in do |count, exception|
    case exception
    when Errors::RateLimitError
      60 * (count + 1)               # linear backoff for rate limits
    else
      (count ** 4) + 15              # default exponential backoff
    end
  end

  # Called when all retries exhausted
  sidekiq_retries_exhausted do |msg, exception|
    Sidekiq.logger.error(
      "Job permanently failed",
      jid: msg["jid"],
      class: msg["class"],
      args: msg["args"],
      error: exception.message
    )
    FailureService.new.record(msg, exception)
  end

  def perform(resource_id)
    ExternalService.new.call(resource_id)
  end
end
```

### Error classification

```ruby
def perform(payment_id)
  PaymentService.new.charge(payment_id)
rescue Errors::InvalidDataError => e
  # Permanent error — don't retry
  Sidekiq.logger.error("Permanent failure", payment_id: payment_id, error: e.message)
  FailureService.new.record_permanent(payment_id, e)
  # Do NOT re-raise — prevents retry
rescue Net::OpenTimeout, Net::ReadTimeout => e
  # Transient error — retry (re-raise)
  raise
end
```

**Rules:**
- Transient errors (network, timeout, rate limit): let the exception propagate for auto-retry.
- Permanent errors (invalid data, business rule violation): handle without re-raising.
- Always implement `sidekiq_retries_exhausted` for critical jobs.
- Log all failures with context (job ID, args, exception).

---

## 4. Concurrency & Queue Priority

### Queue weights

```yaml
# config/sidekiq.yml
:queues:
  - [critical, 5]      # payments, auth — process first
  - [default, 3]       # standard business logic
  - [email, 2]         # notifications — can wait
  - [low, 1]           # reports, analytics — lowest priority
```

### Concurrency control

```ruby
# Global concurrency (in sidekiq.yml)
:concurrency: 10       # 10 threads per process

# Per-job rate limiting (sidekiq-rate-limiter or custom)
class RateLimitedWorker
  include Sidekiq::Job

  def perform(api_key, payload)
    limiter = Sidekiq::Limiter.concurrent("api:#{api_key}", 5, wait: 5)
    limiter.within_limit do
      ExternalApi.call(payload)
    end
  end
end
```

### Ordering

Sidekiq does NOT guarantee ordering. If ordering is required:

```ruby
# Use a dedicated queue with concurrency=1
# Start a separate Sidekiq process:
# bundle exec sidekiq -q ordered -c 1
class OrderedWorker
  include Sidekiq::Job
  sidekiq_options queue: "ordered"

  def perform(sequence_id, data)
    ...
  end
end
```

---

## 5. Scheduled & Periodic Jobs

{% for wkr in workers %}
{% if wkr.trigger_type == "cron" %}
### {{ wkr.name }}

```ruby
# config/schedule.yml (sidekiq-cron)
{{ wkr.name }}:
  cron: "{{ wkr.trigger_config }}"
  class: "{{ wkr.name_pascal_case }}Worker"
  queue: "default"
  {{ "description: \"overlap_policy: " ~ wkr.overlap_policy ~ "\"" if wkr.overlap_policy else "" }}
```
{% endif %}
{% endfor %}

**Setup sidekiq-cron:**

```ruby
# config/initializers/sidekiq_cron.rb
if Sidekiq.server?
  schedule_file = Rails.root.join("config", "schedule.yml")

  if File.exist?(schedule_file)
    schedule = YAML.load_file(schedule_file)
    Sidekiq::Cron::Job.load_from_hash(schedule)
  end
end
```

**Rules:**
- Define all periodic jobs in `config/schedule.yml`.
- Use `sidekiq-cron` gem for cron-based scheduling.
- Periodic jobs must be idempotent — they may fire more than once on leader failover.
- Monitor periodic jobs in the Sidekiq Web UI → Cron tab.

---

## 6. Graceful Shutdown

```ruby
# Sidekiq handles SIGTERM gracefully by default:
# 1. Stops fetching new jobs
# 2. Waits for current jobs to finish (up to timeout)
# 3. Pushes unfinished jobs back to Redis

# config/sidekiq.yml
:timeout: 25            # seconds to wait for jobs to finish on shutdown
```

**For long-running jobs, implement checkpointing:**

```ruby
class LongRunningWorker
  include Sidekiq::Job

  def perform(batch_id)
    items = Batch.find(batch_id).unprocessed_items

    items.each do |item|
      break if Sidekiq::CLI.instance&.launcher&.stopping?
      process_item(item)
    end

    # Re-enqueue if not finished
    self.class.perform_async(batch_id) unless items.empty?
  end
end
```

**Rules:**
- Set `timeout` lower than deployment termination grace period.
- Long jobs should check `stopping?` and checkpoint progress.
- `acks_late`-equivalent: Sidekiq uses `super_fetch` (Sidekiq Pro) or `BRPOPLPUSH` for reliable fetch.

---

## 7. Monitoring & Observability

### Sidekiq Web UI

```ruby
# config/routes.rb (if using Rails)
require "sidekiq/web"

mount Sidekiq::Web => "/sidekiq"
# Protect with auth:
# Sidekiq::Web.use Rack::Auth::Basic do |user, pass|
#   ActiveSupport::SecurityUtils.secure_compare(user, ENV["SIDEKIQ_USER"]) &
#   ActiveSupport::SecurityUtils.secure_compare(pass, ENV["SIDEKIQ_PASS"])
# end
```

### Custom metrics via middleware

```ruby
# lib/middleware/logging_middleware.rb
module Middleware
  class LoggingMiddleware
    def call(worker, job, queue)
      start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      Sidekiq.logger.info("Job started", jid: job["jid"], class: job["class"], queue: queue)

      yield

      duration = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start
      Sidekiq.logger.info("Job completed", jid: job["jid"], class: job["class"], duration_ms: (duration * 1000).round)
    rescue StandardError => e
      duration = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start
      Sidekiq.logger.error("Job failed", jid: job["jid"], class: job["class"], duration_ms: (duration * 1000).round, error: e.message)
      raise
    end
  end
end
```

**Key metrics to track** (→ also see skills/common/observability/):

| Metric | Source |
|--------|--------|
| Queue depth per queue | Sidekiq API: `Sidekiq::Queue.new("default").size` |
| Job execution time | Server middleware |
| Retry count | `Sidekiq::RetrySet.new.size` |
| Dead set size | `Sidekiq::DeadSet.new.size` |
| Processed/failed counters | `Sidekiq::Stats.new` |

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Passing ActiveRecord objects to `perform_async` | Serialization failure | Pass IDs, fetch inside `perform` |
| No retry limit | 25 retries = days of retrying | Always set `retry:` explicitly |
| Ignoring `sidekiq_retries_exhausted` | Permanently failed jobs silently lost | Implement callback for critical jobs |
| Shared mutable state | Race conditions between threads | Each `perform` is independent |
| No idempotency | Duplicate processing on retry | Check-before-act or idempotency keys |
| Fat workers with business logic | Hard to test, violates SRP | Delegate to services |
| Using `sleep` in workers | Blocks the thread, wastes concurrency | Use `perform_in` for delays |
| Not setting queue | All jobs in "default" queue | Explicitly set `queue:` per worker |
