# Testing — Rails

> This skill defines testing rules for the **{{ name }}** service (Ruby on Rails).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify the main success scenario for each endpoint/service method.
- Confirm correct status codes and response shapes.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: main success scenario.
- Edge cases: boundary values, empty inputs, max-length inputs, pagination limits.
- Failure cases: invalid input, missing required fields, unauthorized access, resource not found.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: main success scenario.
- Edge cases: boundary values, empty inputs, max-length inputs, pagination limits.
- Failure cases: invalid input, missing required fields, unauthorized access, resource not found.
- Security cases: mass assignment attempts, token tampering, privilege escalation, IDOR, injection.
{% endif %}

The number of test cases per method is not fixed — judge by the method's complexity and branching.

---

## 2. Test Structure

```
spec/
├── rails_helper.rb            ← shared config (FactoryBot, DatabaseCleaner, etc.)
├── spec_helper.rb             ← RSpec core config
├── support/                   ← shared helpers and configs
│   ├── factory_bot.rb
│   ├── database_cleaner.rb
│   └── request_helpers.rb
├── models/                    ← model validations, scopes, associations
│   └── {resource}_spec.rb
├── services/                  ← service object logic in isolation
│   └── {resource}_service_spec.rb
├── requests/                  ← integration (full HTTP request cycle)
│   └── api/v1/{resource}_spec.rb
├── queries/                   ← query object specs
│   └── {resource}_query_spec.rb
├── policies/                  ← authorization specs (Pundit)
│   └── {resource}_policy_spec.rb
└── factories/                 ← FactoryBot definitions
    └── {resource}.rb
```

**Naming:** `describe "#method_name"` + `context "when condition"` + `it "expected result"`

```ruby
# ✅ descriptive, follows RSpec convention
RSpec.describe UserService do
  describe "#create_user" do
    context "when input is valid" do
      it "creates a user and returns it" do
        ...
      end
    end

    context "when email is duplicate" do
      it "raises ConflictError" do
        ...
      end
    end
  end
end

# ❌ too vague
RSpec.describe UserService do
  it "works" do
    ...
  end
end
```

**Pattern:** Given (arrange) → When (act) → Then (assert).

```ruby
RSpec.describe "POST /api/v1/users", type: :request do
  context "when input is valid" do
    it "returns 201 with user data" do
      # Given
      params = { user: { email: "test@example.com", name: "Test" } }

      # When
      post "/api/v1/users", params: params, as: :json

      # Then
      expect(response).to have_http_status(:created)
      expect(json_body["email"]).to eq("test@example.com")
    end
  end
end
```

---

## 3. Fixtures & Factories

### FactoryBot

```ruby
# spec/factories/users.rb
FactoryBot.define do
  factory :user do
    email { Faker::Internet.unique.email }
    name { Faker::Name.name }
    active { true }

    trait :admin do
      role { :admin }
    end

    trait :inactive do
      active { false }
    end
  end
end
```

**Usage:**

```ruby
let(:user) { create(:user) }
let(:admin) { create(:user, :admin) }
let(:users) { create_list(:user, 3) }

# build (no DB hit) for unit tests
let(:user) { build(:user) }
```

### Request Helpers

```ruby
# spec/support/request_helpers.rb
module RequestHelpers
  def json_body
    JSON.parse(response.body)
  end

  def auth_headers(user)
    token = generate_jwt(user)  # adapt to auth method
    { "Authorization" => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include RequestHelpers, type: :request
end
```

### Database Cleaning

```ruby
# spec/support/database_cleaner.rb
RSpec.configure do |config|
  config.use_transactional_fixtures = true
  # Each test runs in a transaction that rolls back automatically
end
```

**Rules:**
- Use FactoryBot for all test data creation — not raw `Model.create` repeated across tests.
- Use `build` (no DB hit) for unit tests, `create` for integration tests.
- Use traits for common variations — not separate factories.
- Define shared config in `spec/support/`. Test-specific `let` blocks stay in the spec file.
- Never share mutable state between tests — each test gets a fresh transaction.

---

## 4. Mocking Rules

### Service / External Mocking

```ruby
# Mock external services
allow(PaymentGateway).to receive(:charge).and_return(
  OpenStruct.new(transaction_id: "txn_123", success: true)
)

# Verify calls
expect(PaymentGateway).to have_received(:charge).with(amount: 1000, currency: "usd")
```

### Instance Doubles (type-safe mocks)

```ruby
# ✅ instance_double verifies method exists
let(:service) { instance_double(UserService) }
allow(service).to receive(:create_user).and_return(user)

# ❌ plain double — no type verification
let(:service) { double("UserService") }
```

**What to mock:**
- External API calls (payment, email, third-party).
- Time-dependent logic (`Time.current`, `Date.today`).
  - Use `travel_to` (ActiveSupport) for time freezing.
- Non-deterministic outputs (UUIDs, random values) when asserting exact values.

**What NOT to mock:**
- Database in request specs — use real test DB with transaction rollback.
- ActiveRecord validations — let them run to catch schema regressions.
- Rails middleware / request cycle — test through full request specs.
- Pundit policies — test real policies with real request specs.

```ruby
# ✅ Time freezing with ActiveSupport
it "sets expiry to 30 days from now" do
  travel_to Time.zone.parse("2025-01-01 12:00:00") do
    token = service.generate_token(user)
    expect(token.expires_at).to eq(Time.zone.parse("2025-01-31 12:00:00"))
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
bundle exec rspec spec/models/
bundle exec rspec spec/requests/
bundle exec rspec spec/services/

# Run single file
bundle exec rspec spec/services/user_service_spec.rb

# Run single example (by line number)
bundle exec rspec spec/services/user_service_spec.rb:25

# Run by tag
bundle exec rspec --tag integration

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

# spec/rails_helper.rb
RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!

  # Filter slow tests
  config.filter_run_excluding slow: true unless ENV["RUN_SLOW"]
end
```

**SimpleCov setup:**

```ruby
# spec/rails_helper.rb (top of file, before any other require)
if ENV["COVERAGE"]
  require "simplecov"
  SimpleCov.start "rails" do
    add_filter "/spec/"
    add_filter "/config/"
    add_filter "/db/"
  end
end
```

**Rules:**
- All tests must pass before committing.
- Request specs that need external services use `:integration` tag.
- Use `--order rand` to catch test interdependencies.
- Use `instance_double` over plain `double` for type-safe mocks.
