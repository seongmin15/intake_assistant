# Testing — NestJS

> This skill defines testing rules for the **{{ name }}** service (NestJS / TypeScript).
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
- Security cases: injection attempts, token tampering, privilege escalation, IDOR, guard bypass.
{% endif %}

---

## 2. Test Structure

```
test/
├── unit/                      ← service/repository tests with mocked deps
│   └── {domain}.service.spec.ts
├── integration/               ← controller tests with real DI container
│   └── {domain}.controller.spec.ts
└── e2e/                       ← full HTTP tests
    └── {resource}.e2e-spec.ts
```

**Naming:** `describe("{ClassName}") → describe("{method}") → it("should ...")`

```typescript
describe("UserService", () => {
  describe("findById", () => {
    it("should return user when found", async () => {...});
    it("should throw NotFoundException when not found", async () => {...});
  });
});
```

---

## 3. Unit Testing with Test Module

NestJS provides `Test.createTestingModule()` for creating isolated test modules with mocked dependencies.

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { UserService } from "./user.service";
import { UserRepository } from "./user.repository";

describe("UserService", () => {
  let service: UserService;
  let repository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UserService);
    repository = module.get(UserRepository);
  });

  it("should return user when found", async () => {
    const mockUser = { id: "1", email: "test@example.com", name: "Test" };
    repository.findById.mockResolvedValue(mockUser);

    const result = await service.findById("1");
    expect(result).toEqual(mockUser);
  });

  it("should throw NotFoundException when not found", async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findById("999")).rejects.toThrow(NotFoundException);
  });
});
```

---

## 4. E2E Testing

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";

describe("UserController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/v1/users", () => {
    it("should return 201 when valid data", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/users")
        .send({ email: "test@example.com", name: "Test User" });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe("test@example.com");
    });

    it("should return 400 when email is invalid", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/users")
        .send({ email: "not-an-email", name: "Test" });

      expect(response.status).toBe(400);
    });
  });
});
```

---

## 5. Mocking Rules

**What to mock:**
- External API calls (payment, email, third-party).
- Time-dependent logic.
- File storage operations.
- Queue dispatch calls.

**What NOT to mock:**
- NestJS DI container — use `Test.createTestingModule()`.
- class-validator validation — let it run in e2e tests.
- Guards and pipes in e2e tests — test real behavior.
- Database in e2e tests — use test DB with cleanup.

**Override providers in test module:**

```typescript
const module = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideProvider(PaymentService)
  .useValue({ charge: jest.fn().mockResolvedValue({ id: "txn_123" }) })
  .compile();
```

---

## 6. Test Execution

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov

# Watch mode
npm run test:watch

# Single file
npm run test -- --testPathPattern=user.service
```

**package.json scripts (NestJS default):**

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  }
}
```

**Rules:**
- Use NestJS `Test.createTestingModule()` — not manual instantiation.
- E2E tests must apply the same global pipes/guards as production.
- All tests must pass before committing.
