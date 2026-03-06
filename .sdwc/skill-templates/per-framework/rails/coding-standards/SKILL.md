# Coding Standards — Rails

> This skill defines coding rules for the **{{ name }}** service (Ruby on Rails).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── app/
│   ├── controllers/
│   │   ├── application_controller.rb
│   │   └── api/
│   │       └── v1/
│   │           └── {resource}_controller.rb
│   ├── models/                        ← ActiveRecord models
│   │   ├── application_record.rb
│   │   └── {resource}.rb
│   ├── services/                      ← business logic (POROs)
│   │   └── {resource}_service.rb
│   ├── serializers/                   ← response shaping
│   │   └── {resource}_serializer.rb
│   ├── policies/                      ← authorization (Pundit)
│   │   └── {resource}_policy.rb
│   ├── validators/                    ← custom validators
│   │   └── {name}_validator.rb
│   ├── queries/                       ← complex query objects
│   │   └── {resource}_query.rb
│   └── errors/                        ← domain exception classes
│       └── application_error.rb
├── config/
│   ├── routes.rb
│   ├── database.yml
│   ├── environments/
│   │   ├── development.rb
│   │   ├── test.rb
│   │   └── production.rb
│   └── initializers/
├── db/
│   ├── migrate/
│   ├── schema.rb
│   └── seeds.rb
├── lib/
│   └── tasks/                         ← custom Rake tasks
├── spec/                              ← RSpec tests
│   ├── rails_helper.rb
│   ├── spec_helper.rb
│   ├── controllers/
│   ├── models/
│   ├── services/
│   ├── requests/                      ← integration (request specs)
│   └── factories/
├── Gemfile
├── Gemfile.lock
└── Dockerfile
```

**Rules:**
- Follow Rails conventions — if Rails has an opinion, follow it.
- One controller per resource under `api/v1/`. Namespace API controllers.
- Business logic lives in `app/services/`, not in controllers or models.
- Controllers are thin — they parse params, call services, render responses.
- Models define schema, validations, associations, and scopes. No orchestration logic.
- `app/queries/` for complex queries that span multiple models or need raw SQL.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files & directories | snake_case | `user_service.rb` |
| Classes & modules | PascalCase | `UserService`, `Api::V1::UsersController` |
| Methods & variables | snake_case | `find_active_users` |
| Constants | UPPER_SNAKE | `MAX_PAGE_SIZE = 50` |
| Predicate methods | trailing `?` | `active?`, `admin?` |
| Dangerous methods | trailing `!` | `save!`, `destroy!` |
| Database tables | snake_case plural | `user_profiles` |
| Model classes | PascalCase singular | `UserProfile` |
| Controllers | PascalCase plural + suffix | `UsersController` |
| Route paths | kebab-case or snake_case plural | `/api/v1/user-profiles` |
| Serializers | PascalCase singular + suffix | `UserSerializer` |
| Services | PascalCase + suffix | `CreateUserService`, `UserService` |
| Policies | PascalCase singular + suffix | `UserPolicy` |

**Service naming pattern:**
- Single-action service: `Create{Resource}Service`, `Update{Resource}Service` — has one public method (`call`).
- Multi-action service: `{Resource}Service` — groups related operations.

**Controller action mapping:**

| Action | HTTP | Path | Method |
|--------|------|------|--------|
| index | GET | /resources | `index` |
| show | GET | /resources/:id | `show` |
| create | POST | /resources | `create` |
| update | PATCH/PUT | /resources/:id | `update` |
| destroy | DELETE | /resources/:id | `destroy` |

---

## 3. Type Safety & Documentation

Ruby is dynamically typed. Compensate with discipline:

**YARD documentation** for all public methods:

```ruby
# @param user_id [String] UUID of the user
# @return [User] the found user
# @raise [Errors::NotFoundError] if user does not exist
def find_user(user_id)
  user = User.find_by(id: user_id)
  raise Errors::NotFoundError.new("User", user_id) unless user
  user
end
```

**Enforce via convention:**
- Always use keyword arguments for methods with 2+ parameters.
- Use `freeze` on string constants: `STATUS_ACTIVE = "active".freeze`.
- Prefer symbols over strings for hash keys in internal code.
- Use `Hash` / `Array` type annotations in YARD for complex params.

```ruby
# ✅ keyword arguments — clear at call site
def create_user(email:, name:, role: :member)
  ...
end

# ❌ positional arguments — unclear at call site
def create_user(email, name, role = :member)
  ...
end
```

**Optional — Sorbet (gradual typing):**
If the team adopts Sorbet, use `typed: strict` for service objects and `typed: false` for Rails boilerplate.

---

## 4. Require & Autoloading

Rails uses **Zeitwerk** autoloader. Do not manually `require` app code.

```ruby
# ✅ Zeitwerk resolves automatically
# app/services/user_service.rb → UserService
# app/services/payments/charge_service.rb → Payments::ChargeService

# ❌ Never manually require app code
require_relative "../services/user_service"  # wrong
```

**Rules:**
- File path must match class name: `app/services/user_service.rb` → `UserService`.
- Nested modules match directory structure: `app/services/payments/charge_service.rb` → `Payments::ChargeService`.
- `require` is only for gems or `lib/` code not autoloaded by Zeitwerk.
- Add custom autoload paths in `config/application.rb` if needed:

```ruby
# config/application.rb
config.autoload_paths += %w[app/services app/queries app/errors]
```

**Gem imports — in Gemfile, not inline:**

```ruby
# Gemfile (grouped)
# 1. Rails & core
gem "rails", "~> 7.1"
gem "puma", "~> 6.0"

# 2. Database
gem "pg"

# 3. API & serialization
gem "active_model_serializers"
gem "pundit"
gem "pagy"

# 4. Utilities
gem "bcrypt"

group :development, :test do
  gem "rspec-rails"
  gem "factory_bot_rails"
  gem "rubocop-rails", require: false
end
```

---

## 5. Rails Patterns

### Strong Parameters

```ruby
class Api::V1::UsersController < ApplicationController
  private

  def create_params
    params.require(:user).permit(:email, :name, :bio)
  end

  def update_params
    params.require(:user).permit(:name, :bio)
  end
end
```

**Rules:**
- Define separate `*_params` methods for create and update — never reuse the same permit list.
- Never use `params.permit!` (permits everything).
- Whitelist explicitly — if a field is not in `permit`, it is silently dropped.

### Scopes & Query Objects

```ruby
# app/models/user.rb
class User < ApplicationRecord
  scope :active, -> { where(active: true) }
  scope :created_after, ->(date) { where("created_at > ?", date) }
end

# app/queries/active_users_query.rb — for complex queries
class ActiveUsersQuery
  def initialize(relation = User.all)
    @relation = relation
  end

  def call(since:, role: nil)
    result = @relation.active.created_after(since)
    result = result.where(role: role) if role
    result.order(created_at: :desc)
  end
end
```

### Concerns — use sparingly

```ruby
# app/models/concerns/soft_deletable.rb
module SoftDeletable
  extend ActiveSupport::Concern

  included do
    scope :kept, -> { where(deleted_at: nil) }
    default_scope { kept }
  end

  def soft_delete
    update!(deleted_at: Time.current)
  end
end
```

**Rules:**
- Concerns are for shared behavior across models (e.g., timestamps, soft-delete). Not for splitting a fat model into multiple files.
- If a concern is used by only one model, it should be a plain method on that model.

---

## 6. Linting & Formatting

| Tool | Purpose | Config file |
|------|---------|-------------|
| **RuboCop** | Linter + formatter | `.rubocop.yml` |
| **rubocop-rails** | Rails-specific rules | `.rubocop.yml` (require) |
| **rubocop-rspec** | RSpec-specific rules | `.rubocop.yml` (require) |

**RuboCop configuration baseline:**

```yaml
# .rubocop.yml
require:
  - rubocop-rails
  - rubocop-rspec

AllCops:
  TargetRubyVersion: 3.3
  NewCops: enable
  Exclude:
    - "db/schema.rb"
    - "db/migrate/*"
    - "bin/**/*"
    - "vendor/**/*"

Style/StringLiterals:
  EnforcedStyle: double_quotes

Layout/LineLength:
  Max: 120

Metrics/MethodLength:
  Max: 20

Style/Documentation:
  Enabled: false           # YARD docs are enforced by review, not cop

Rails/HasManyOrHasOneDependent:
  Enabled: true
```

**Commands:**

```bash
rubocop                    # lint
rubocop -A                 # auto-fix safe corrections
rubocop --only Layout      # run layout cops only
```

**Rules:**
- Run `rubocop` before every commit.
- Auto-fix with `-A` for safe corrections. Review `-a` (unsafe) corrections manually.
- YARD documentation: all public methods in services, controllers, and model scopes.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in controllers | Move to `app/services/` |
| Fat models with orchestration logic | Models = schema + validations + scopes; logic → services |
| Callbacks for business logic (`after_create`) | Explicit service calls; callbacks for simple side effects only |
| `find_by_sql` in controllers | Use scopes or `app/queries/` |
| Skip validations (`save(validate: false)`) | Fix the validation or use a separate flow |
| Global state via class variables | Use `RequestStore` or pass via method parameters |
| Hardcoded config values | Use `Rails.application.credentials` or env vars |
| N+1 queries | Use `includes`, `preload`, or `eager_load` |
| Relative requires for app code | Let Zeitwerk autoload |
| `puts` / `p` for logging | Use `Rails.logger` with structured logging (→ skills/common/observability/) |
