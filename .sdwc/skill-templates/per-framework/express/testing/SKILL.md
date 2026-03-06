# Testing — Express

> This skill defines testing rules for the **{{ name }}** service (Express / TypeScript).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify the main success scenario for each endpoint/function.
- Confirm correct status codes and response shapes.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: main success scenario.
- Edge cases: boundary values, empty inputs, max-length inputs, pagination limits.
- Failure cases: invalid input (422), unauthorized (401), not found (404), conflict (409).
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: main success scenario.
- Edge cases: boundary values, empty inputs, max-length inputs, pagination limits.
- Failure cases: invalid input (422), unauthorized (401), not found (404), conflict (409).
- Security cases: injection attempts, token tampering, privilege escalation, IDOR, rate limit bypass.
{% endif %}

The number of test cases per function is not fixed — judge by the function's complexity and branching.

---

## 2. Test Structure

```
tests/
├── setup.ts                   ← global test setup (DB, app instance)
├── helpers/                   ← test utilities (factory, auth helper)
│   ├── factory.ts
│   └── auth.ts
├── unit/                      ← service/repository logic in isolation
│   └── {module}.test.ts
├── integration/               ← endpoint tests with real DB
│   └── {resource}.api.test.ts
└── e2e/                       ← full workflow tests
    └── {flow}.test.ts
```

**Naming:** `describe("{action}") → it("should {expected behavior} when {condition}")`

```typescript
// ✅ clear intent
describe("POST /api/v1/users", () => {
  it("should return 201 when valid data is provided", async () => {...});
  it("should return 422 when email is invalid", async () => {...});
  it("should return 409 when email already exists", async () => {...});
});

// ❌ too vague
describe("users", () => {
  it("works", async () => {...});
});
```

**Pattern:** Arrange → Act → Assert.

```typescript
it("should return 201 when valid data is provided", async () => {
  // Arrange
  const payload = { email: "test@example.com", name: "Test User" };

  // Act
  const response = await request(app).post("/api/v1/users").send(payload);

  // Assert
  expect(response.status).toBe(201);
  expect(response.body.email).toBe("test@example.com");
});
```

---

## 3. Fixtures & Factories

### App instance for testing

```typescript
// tests/setup.ts
import { createApp } from "@/app";

let app: Express;

beforeAll(async () => {
  app = await createApp({ testMode: true });
});

afterAll(async () => {
  await cleanupDatabase();
});

export { app };
```

### Factory pattern

```typescript
// tests/helpers/factory.ts
import { randomUUID } from "node:crypto";

export function buildUser(overrides: Partial<CreateUserInput> = {}) {
  return {
    email: `user-${randomUUID()}@test.com`,
    name: "Test User",
    ...overrides,
  };
}

export async function createUser(overrides: Partial<CreateUserInput> = {}) {
  const data = buildUser(overrides);
  return await userRepository.create(data);
}
```

### Auth helper

```typescript
// tests/helpers/auth.ts
export function authHeader(userId: string): Record<string, string> {
  const token = generateTestToken({ sub: userId });
  return { Authorization: `Bearer ${token}` };
}
```

**Rules:**
- Use factory functions for test data — not hardcoded objects repeated across tests.
- Each test must be independent — clean up or use transactions.
- Use `supertest` (`request(app)`) for HTTP-level testing.

---

## 4. Mocking Rules

**What to mock:**
- External API calls (payment gateways, email services, third-party APIs).
- Time-dependent logic (`Date.now()`).
- File system and storage operations.
- Queue/worker dispatch (`.add()` calls).

**What NOT to mock:**
- Database in integration tests — use a real test DB with cleanup.
- Zod validation — let it run to catch schema regressions.
- Express middleware chain — test through the full request cycle.
- Error middleware — test real error responses.

```typescript
// Mock external service
import { jest } from "@jest/globals";

jest.mock("@/services/payment.service", () => ({
  PaymentService: jest.fn().mockImplementation(() => ({
    charge: jest.fn().mockResolvedValue({ transactionId: "txn_123" }),
  })),
}));
```

**For dependency injection mocking:**

```typescript
// Inject mock service directly
const mockUserService = {
  getById: jest.fn().mockResolvedValue({ id: "1", name: "Test" }),
};
const controller = new UserController(mockUserService as any);
```

---

## 5. Test Execution

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific category
npm test -- tests/unit/
npm test -- tests/integration/

# Run single file
npm test -- tests/unit/user.service.test.ts

# Watch mode (development)
npm test -- --watch
```

**package.json scripts:**

```json
{
  "scripts": {
    "test": "jest --runInBand",
    "test:unit": "jest tests/unit/",
    "test:integration": "jest tests/integration/",
    "test:coverage": "jest --coverage"
  }
}
```

**jest.config.ts:**

```typescript
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  setupFilesAfterSetup: ["<rootDir>/tests/setup.ts"],
};
```

**Rules:**
- Use `--runInBand` for integration tests (sequential, avoids DB conflicts).
- Unit tests can run in parallel.
- All tests must pass before committing.
