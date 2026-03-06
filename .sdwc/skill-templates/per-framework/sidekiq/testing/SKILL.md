# Testing — Sidekiq

> This skill defines testing rules for the **{{ name }}** service (Sidekiq / Ruby).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify each worker completes successfully with valid input.
- Confirm expected side effects (DB writes, API calls).
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: worker completes successfully.
- Edge cases: empty inputs, large payloads, duplicate execution (idempotency).
- Failure cases: external service down, invalid input, record not found, timeout.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: worker completes successfully.
- Edge cases: empty inputs, large payloads, duplicate execution (idempotency).
- Failure cases: external service down, invalid input, record not found, timeout.
- Security cases: injection via worker args, unauthorized data access, privilege escalation.
{% endif %}

The number of test cases per worker is not fixed — judge by the worker's complexity and branching.

---

## 2. Test Structure

```
spec/
├── rails_helper.rb            ← shared config (FactoryBot, Sidekiq::Testing, etc.)
├── spec_helper.rb
├── support/
│   ├── sidekiq.rb             ← Sidekiq::Testing mode config
│   ├── factory_bot.rb
│   └── shared_contexts/
├── workers/                   ← worker behavior specs
│   └── {domain}_worker_spec.rb
├── services/                  ← service logic in isolation
│   └── {domain}_service_spec.rb
├── models/                    ← model validations, scopes
│   └── {domain}_spec.rb
└── factories/
    └── {domain}.rb
```

**Naming:** `describe "#perform"` + `context "when condition"` + `it "expected result"`

```ruby
# ✅ descriptive, follows RSpec convention
RSpec.describe SendWelcomeEmailWorker do
  describe "#perform" do
    context "when user exists" do
      it "sends a welcome email" do
        ...
      end
    end

    context "when user does not exist" do
      it "raises NotFoundError" do
        ...
      end
    end

    context "when called twice with same user" do
      it "is idempotent" do
        ...
      end
    end
  end
end
```

**Pattern:** Given (arrange) → When (act) → Then (assert).

```ruby
RSpec.describe ProcessOrderWorker do
  describe "#perform" do
    context "when order is valid" do
      it "updates order status to completed" do
        # Given
        order = create(:order, status: "pending")

        # When
        described_class.new.perform(order.id)

        # Then
        expect(order.reload.status).to eq("completed")
      end
    end
  end
end
```

---

## 3. Fixtures & Factories

### Sidekiq Testing Modes

```ruby
# spec/support/sidekiq.rb
require "sidekiq/testing"

RSpec.configure do |config|
  config.before(:each) do
    Sidekiq::Testing.fake!    # default — jobs pushed to array, not executed
    Sidekiq::Worker.clear_all
  end
end
```

| Mode | Use case |
|------|----------|
| `Sidekiq::Testing.fake!` | Test that jobs are enqueued (default) |
| `Sidekiq::Testing.inline!` | Execute jobs immediately (integration) |
| `Sidekiq::Testing.disable!` | Real Redis (e2e) |

### FactoryBot

```ruby
# spec/factories/orders.rb
FactoryBot.define do
  factory :order do
    user
    status { "pending" }
    total { 99.99 }

    trait :completed do
      status { "completed" }
    end
  end
end
```

### Testing Job Enqueueing

```ruby
# Test that a service enqueues a job
RSpec.describe OrderService do
  describe "#create_order" do
    it "enqueues a confirmation email worker" do
      Sidekiq::Testing.fake!

      expect {
        service.create_order(params)
      }.to change(SendConfirmationEmailWorker.jobs, :size).by(1)
    end

    it "enqueues with correct arguments" do
      Sidekiq::Testing.fake!
      service.create_order(params)

      job = SendConfirmationEmailWorker.jobs.last
      expect(job["args"]).to eq([order.id])
    end
  end
end
```

### Testing Job Execution (inline)

```ruby
RSpec.describe SendWelcomeEmailWorker do
  describe "#perform" do
    it "calls EmailService with correct params" do
      Sidekiq::Testing.inline!
      user = create(:user)

      expect_any_instance_of(EmailService)
        .to receive(:send_email)
        .with(user_id: user.id, template: "welcome")

      described_class.perform_async(user.id, "welcome")
    end
  end
end
```

**Rules:**
- Use `fake!` mode by default — test enqueue behavior without executing jobs.
- Use `inline!` mode for integration tests — verify full execution path.
- Use FactoryBot for test data creation.
- Always `Sidekiq::Worker.clear_all` before each test.
- Never share mutable state between tests.

---

## 4. Mocking Rules

### Instance Doubles (type-safe mocks)

```ruby
# ✅ instance_double verifies method exists
let(:email_service) { instance_double(EmailService) }

before do
  allow(EmailService).to receive(:new).and_return(email_service)
  allow(email_service).to receive(:send_email).and_return(true)
end
```

**What to mock:**
- External API calls (email, payment, third-party).
- Time-dependent logic — use `travel_to` (ActiveSupport).
- Services in worker unit tests (test workers and services separately).

**What NOT to mock:**
- Database in integration tests — use real test DB with transaction rollback.
- Sidekiq enqueueing behavior — use `Sidekiq::Testing.fake!` and inspect `.jobs`.
- Worker retry/error handling — test with real Sidekiq behavior.

```ruby
# ✅ Mock external API
RSpec.describe PaymentWorker do
  describe "#perform" do
    it "charges the payment gateway" do
      payment = create(:payment)
      gateway = instance_double(PaymentGateway)

      allow(PaymentGateway).to receive(:new).and_return(gateway)
      allow(gateway).to receive(:charge).and_return({ transaction_id: "txn_123" })

      described_class.new.perform(payment.id)

      expect(gateway).to have_received(:charge).with(amount: payment.amount)
    end
  end
end

# ✅ Time freezing
it "schedules retry for 1 hour later" do
  travel_to Time.zone.parse("2025-01-01 12:00:00") do
    described_class.perform_in(1.hour, order.id)
    expect(described_class.jobs.last["at"]).to eq(Time.zone.parse("2025-01-01 13:00:00").to_f)
  end
end
```

---

## 5. Test Execution

```bash
# Run all tests
bundle exec rspec

# Run with coverage
COVERAGE=true bundle exec rspec

# Run specific category
bundle exec rspec spec/workers/
bundle exec rspec spec/services/

# Run single file
bundle exec rspec spec/workers/email_worker_spec.rb

# Run single example (by line number)
bundle exec rspec spec/workers/email_worker_spec.rb:15

# Parallel execution
bundle exec parallel_rspec spec/
```

**RSpec configuration:**

```ruby
# .rspec
--require rails_helper
--format documentation
--color
--order rand
```

**Rules:**
- All tests must pass before committing.
- Unit tests run without external dependencies (Redis, DB for worker specs).
- Integration tests tagged with `:integration` — require running Redis.
- Use `instance_double` over plain `double` for type-safe mocks.
- Use `--order rand` to catch test interdependencies.
