# Framework — Rails

> This skill defines Ruby on Rails-specific patterns for the **{{ name }}** service.
> Auth: **{{ auth.method }}** | API style: **{{ api_style }}**
> Read this before building or modifying any application logic.

---

## 1. Application Bootstrap

### Configuration

```ruby
# config/application.rb
module ServiceName
  class Application < Rails::Application
    config.load_defaults 7.1
    config.api_only = true                # API-only mode (no views/assets)

    # Autoload service objects, query objects, etc.
    config.autoload_paths += %w[
      app/services
      app/queries
      app/errors
    ]

    # Timezone and locale
    config.time_zone = "UTC"
    config.active_record.default_timezone = :utc

    # Structured JSON logging
    config.log_formatter = ::Logger::Formatter.new
  end
end
```

### Middleware stack (API-only)

Rails API mode includes a minimal middleware stack. Add only what is needed:

```ruby
# config/application.rb
config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "*"  # restrict in production
    resource "*", headers: :any, methods: %i[get post put patch delete options]
  end
end

# config/initializers/logging.rb — request logging middleware
Rails.application.config.middleware.insert_after ActionDispatch::RequestId, RequestLoggingMiddleware
```

**Middleware order** (outermost first):
1. `Rack::Cors` — CORS handling
2. `ActionDispatch::RequestId` — assigns unique request ID
3. `RequestLoggingMiddleware` — structured request/response logging
4. Rails default stack

### Logging setup (→ also see skills/common/observability/)

```ruby
# config/initializers/logging.rb
require "lograge"

Rails.application.configure do
  config.lograge.enabled = true
  config.lograge.formatter = Lograge::Formatters::Json.new
  config.lograge.custom_payload do |controller|
    {
      request_id: controller.request.request_id,
      user_id: controller.current_user&.id
    }
  end
end
```

Use `Rails.logger` everywhere — never `puts` or `p`.

---

## 2. Routing & Controller Organization

### Route definitions

```ruby
# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :users, only: %i[index show create update destroy] do
        member do
          post :activate
        end
        collection do
          get :search
        end
      end
      resources :posts, only: %i[index show create update destroy]
    end
  end

  # Health checks (public, outside API namespace)
  get "health", to: "health#show"
  get "ready", to: "health#ready"
end
```

### Controller structure

```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  include Pundit::Authorization

  before_action :authenticate_user!

  rescue_from Errors::ApplicationError, with: :handle_app_error
  rescue_from ActiveRecord::RecordNotFound, with: :handle_not_found
  rescue_from Pundit::NotAuthorizedError, with: :handle_forbidden

  private

  def authenticate_user!
    # → see §4 Auth Pattern
  end

  def current_user
    @current_user
  end

  def handle_app_error(error)
    render json: { error: { code: error.code, message: error.message } },
           status: error.http_status
  end

  def handle_not_found(error)
    render json: { error: { code: "NOT_FOUND", message: error.message } },
           status: :not_found
  end

  def handle_forbidden(_error)
    render json: { error: { code: "FORBIDDEN", message: "Not authorized" } },
           status: :forbidden
  end
end
```

### Layer separation

```
Controller (thin) → Service (business logic) → Model / Query (data access)
```

- **Controllers**: parse params, call service, render response. No business logic.
- **Services**: orchestrate operations, enforce business rules. No HTTP concepts (no `render`, no `response`).
- **Models**: schema, validations, associations, scopes. No orchestration.

```ruby
# ✅ Controller is thin
class Api::V1::UsersController < ApplicationController
  def create
    service = UserService.new
    user = service.create_user(**create_params.to_h.symbolize_keys)
    render json: UserSerializer.new(user), status: :created
  end

  def show
    user = User.find(params[:id])
    authorize user
    render json: UserSerializer.new(user)
  end

  private

  def create_params
    params.require(:user).permit(:email, :name, :bio)
  end
end

# ✅ Service handles business logic
class UserService
  def create_user(email:, name:, bio: nil)
    raise Errors::ConflictError, "Email already taken" if User.exists?(email: email)
    User.create!(email: email, name: name, bio: bio)
  end
end
```

---

## 3. Request & Response

### Serializers (ActiveModelSerializers or Alba)

```ruby
# app/serializers/user_serializer.rb
class UserSerializer < ActiveModel::Serializer
  attributes :id, :email, :name, :bio, :created_at

  # Conditional attributes
  attribute :admin_notes, if: :admin?

  def admin?
    scope&.admin?
  end
end

# app/serializers/user_list_serializer.rb (minimal for lists)
class UserListSerializer < ActiveModel::Serializer
  attributes :id, :email, :name, :created_at
end
```

**Serializer naming pattern:**

| Serializer | Purpose |
|------------|---------|
| `{Resource}Serializer` | Default / detail response |
| `{Resource}ListSerializer` | List response (fewer fields) |

{% if pagination == "cursor" %}
**Cursor pagination (Pagy):**

```ruby
# app/controllers/concerns/paginatable.rb
module Paginatable
  extend ActiveSupport::Concern

  private

  def paginate(collection)
    pagy, records = pagy_cursor(collection, after: params[:cursor])
    {
      items: records,
      next_cursor: pagy.next,
      has_more: pagy.next.present?
    }
  end
end
```
{% endif %}
{% if pagination == "offset" %}
**Offset pagination (Pagy):**

```ruby
# app/controllers/concerns/paginatable.rb
module Paginatable
  extend ActiveSupport::Concern
  include Pagy::Backend

  private

  def paginate(collection, items: 20)
    pagy, records = pagy(collection, items: items)
    {
      items: records,
      total: pagy.count,
      page: pagy.page,
      pages: pagy.pages
    }
  end
end
```
{% endif %}

**Response rules:**
- Always render through serializers — never `render json: model.as_json`.
- Use separate serializers for list vs detail endpoints.
- Controllers select the serializer explicitly: `render json: user, serializer: UserListSerializer`.

---

## 4. Auth Pattern

**Method: {{ auth.method }}**

All authentication is handled in `ApplicationController` via `before_action`.

```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  before_action :authenticate_user!

  private

  def authenticate_user!
    token = request.headers["Authorization"]&.split(" ")&.last
    raise Errors::UnauthorizedError, "Missing token" unless token

    payload = decode_token(token)  # adapt to auth method
    @current_user = User.find_by(id: payload["user_id"])
    raise Errors::UnauthorizedError, "Invalid token" unless @current_user
  end

  def current_user
    @current_user
  end
end
```

**Authorization (Pundit):**

```ruby
# app/policies/user_policy.rb
class UserPolicy < ApplicationPolicy
  def show?
    true  # any authenticated user
  end

  def update?
    record.id == user.id || user.admin?
  end

  def destroy?
    user.admin?
  end
end
```

**Applying in controllers:**

```ruby
# Protected (default — before_action :authenticate_user!)
class Api::V1::UsersController < ApplicationController
  def show
    user = User.find(params[:id])
    authorize user         # Pundit policy check
    render json: UserSerializer.new(user)
  end
end

# Public endpoint — skip auth
class HealthController < ApplicationController
  skip_before_action :authenticate_user!

  def show
    render json: { status: "ok" }
  end
end
```

**Rules:**
- Every endpoint is protected by default via `before_action :authenticate_user!`.
- Explicitly `skip_before_action` for public endpoints.
- Use Pundit policies for authorization — never inline role checks in controllers.
- For testing, mock auth in request helpers (→ testing skill §3).

---

## 5. Error Handling

### Domain Exceptions

```ruby
# app/errors/application_error.rb
module Errors
  class ApplicationError < StandardError
    attr_reader :code, :http_status

    def initialize(message, code: "INTERNAL_ERROR", http_status: :internal_server_error)
      @code = code
      @http_status = http_status
      super(message)
    end
  end

  class NotFoundError < ApplicationError
    def initialize(resource, resource_id = nil)
      msg = resource_id ? "#{resource} '#{resource_id}' not found" : "#{resource} not found"
      super(msg, code: "NOT_FOUND", http_status: :not_found)
    end
  end

  class ConflictError < ApplicationError
    def initialize(message)
      super(message, code: "CONFLICT", http_status: :conflict)
    end
  end

  class ValidationError < ApplicationError
    def initialize(message)
      super(message, code: "VALIDATION_ERROR", http_status: :unprocessable_entity)
    end
  end

  class UnauthorizedError < ApplicationError
    def initialize(message = "Unauthorized")
      super(message, code: "UNAUTHORIZED", http_status: :unauthorized)
    end
  end

  class ForbiddenError < ApplicationError
    def initialize(message = "Forbidden")
      super(message, code: "FORBIDDEN", http_status: :forbidden)
    end
  end
end
```

### Global Exception Handling

```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  rescue_from Errors::ApplicationError do |error|
    Rails.logger.warn("AppError: #{error.code} — #{error.message}")
    render json: { error: { code: error.code, message: error.message } },
           status: error.http_status
  end

  rescue_from ActiveRecord::RecordNotFound do |error|
    render json: { error: { code: "NOT_FOUND", message: error.message } },
           status: :not_found
  end

  rescue_from ActiveRecord::RecordInvalid do |error|
    render json: { error: { code: "VALIDATION_ERROR", message: error.record.errors.full_messages.join(", ") } },
           status: :unprocessable_entity
  end

  rescue_from ActionController::ParameterMissing do |error|
    render json: { error: { code: "BAD_REQUEST", message: error.message } },
           status: :bad_request
  end
end
```

{% if error_response_format %}
**Error response format: {{ error_response_format }}**
{% endif %}

**Rules:**
- Services raise domain exceptions (`Errors::*`) — never render HTTP responses.
- Only controllers and the global handler convert to HTTP responses.
- Use `rescue_from` in `ApplicationController` for consistent error formatting.
- Log unexpected exceptions at ERROR level with full backtrace.
- Never expose internal details (stack traces, SQL errors) to the client.

---

## 6. Database & ActiveRecord

{% if databases %}
### Model Definition

```ruby
# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true
end

# app/models/user.rb
class User < ApplicationRecord
  # --- Associations ---
  has_many :posts, dependent: :destroy

  # --- Validations ---
  validates :email, presence: true, uniqueness: true, length: { maximum: 255 }
  validates :name, presence: true, length: { minimum: 1, maximum: 100 }

  # --- Scopes ---
  scope :active, -> { where(active: true) }
  scope :recent, -> { order(created_at: :desc) }

  # --- Enums ---
  enum :role, { member: "member", admin: "admin" }, default: :member
end
```

### Migrations

```bash
rails generate migration CreateUsers email:string name:string active:boolean
rails db:migrate
rails db:rollback STEP=1
rails db:migrate:status
```

```ruby
# db/migrate/20250101000000_create_users.rb
class CreateUsers < ActiveRecord::Migration[7.1]
  def change
    create_table :users, id: :uuid do |t|
      t.string :email, null: false, limit: 255
      t.string :name, null: false, limit: 100
      t.boolean :active, null: false, default: true
      t.timestamps
    end

    add_index :users, :email, unique: true
  end
end
```

**Rules:**
- Always review auto-generated migrations before committing.
- Use `change` method for reversible migrations. Use `up`/`down` only when `change` is not possible.
- Never edit applied migrations — create new ones instead.
- Use UUID primary keys if the project requires it (configure in model generator).

### Query Optimization

```ruby
# ✅ Eager load to avoid N+1
User.includes(:posts).where(active: true)

# ✅ Select only needed fields
User.select(:id, :email, :name).where(active: true)

# ✅ Batch processing for large datasets
User.find_each(batch_size: 1000) { |user| process(user) }
```

### Transaction Management

```ruby
class OrderService
  def create_order(user:, items:)
    ActiveRecord::Base.transaction do
      order = Order.create!(user: user, status: :pending)
      items.each { |item| order.order_items.create!(item) }
      InventoryService.new.reserve(items)
      order
    end
  rescue ActiveRecord::RecordInvalid => e
    raise Errors::ValidationError, e.record.errors.full_messages.join(", ")
  end
end
```

**Rules:**
- Services manage transactions with `ActiveRecord::Base.transaction`.
- Read operations don't need explicit transactions.
- Use `lock!` or `with_lock` for concurrent write scenarios.
- Use `find_each` for iterating over large datasets — never `.all.each`.
{% endif %}

---

## 7. Background Jobs

**For background work, delegate to a worker service or use ActiveJob:**

```ruby
# For lightweight async work within the same service
class WelcomeEmailJob < ApplicationJob
  queue_as :default

  def perform(user_id)
    user = User.find(user_id)
    UserMailer.welcome(user).deliver_now
  end
end

# In service layer
class UserService
  def create_user(email:, name:)
    user = User.create!(email: email, name: name)
    WelcomeEmailJob.perform_later(user.id)
    user
  end
end
```

**Rules:**
- Always pass IDs to jobs, not full objects (objects are serialized/deserialized).
- Use `perform_later` (async) by default. Use `perform_now` only in tests or critical synchronous paths.
- For long-running or complex jobs, delegate to a dedicated worker service (Sidekiq → see sidekiq skill).
- Jobs must be idempotent — they may be retried on failure.

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Business logic in controllers | Fat controllers, hard to test | Move to `app/services/` |
| Business logic in models | God objects, circular deps | Models = schema + validations; services = logic |
| N+1 queries | Slow list endpoints | Use `includes` / `preload` / `eager_load` |
| `.all.each` on large tables | Memory exhaustion | Use `find_each` with batch size |
| Callbacks for business logic | Hidden side effects, hard to debug | Explicit service calls; callbacks for audit/cache only |
| `save(validate: false)` | Data integrity issues | Fix validations or create a separate bypass flow |
| Missing `dependent:` on associations | Orphaned records | Always specify `:destroy`, `:nullify`, or `:restrict_with_error` |
| Mutable class variables | Shared state across requests | Use `RequestStore` or instance variables |
| Hardcoded secrets | Security risk | Use `Rails.application.credentials` or env vars |
| `puts` / `p` for logging | Unstructured, lost in production | Use `Rails.logger` (→ skills/common/observability/) |
