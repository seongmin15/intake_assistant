# Testing — BullMQ

> This skill defines testing rules for the **{{ name }}** service (BullMQ / TypeScript).
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
- Edge cases: empty payloads, large data, duplicate job execution (idempotency).
- Failure cases: external service down, invalid payload, timeout, retry exhaustion.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: worker completes successfully.
- Edge cases: empty payloads, large data, duplicate job execution (idempotency).
- Failure cases: external service down, invalid payload, timeout, retry exhaustion.
- Security cases: injection via job data, unauthorized data access, payload tampering.
{% endif %}

---

## 2. Test Structure

```
tests/
├── setup.ts                   ← global setup (Redis, DB connections)
├── helpers/
│   ├── queue.ts               ← test queue/worker helpers
│   └── factory.ts             ← test data factories
├── unit/                      ← service/repository tests (no Redis)
│   └── {domain}.service.test.ts
├── integration/               ← worker tests with real Redis
│   └── {domain}.worker.test.ts
└── e2e/                       ← full flow: enqueue → process → verify
    └── {flow}.test.ts
```

**Naming:** `describe("{WorkerName}") → it("should {expected} when {condition}")`

```typescript
describe("EmailWorker", () => {
  it("should send email when valid job data", async () => {...});
  it("should throw when user not found", async () => {...});
  it("should be idempotent on duplicate execution", async () => {...});
});
```

---

## 3. Unit Testing (Without Redis)

Test the processor function in isolation by calling it directly without BullMQ infrastructure.

```typescript
import { EmailService } from "@/services/email.service";

describe("EmailService", () => {
  let service: EmailService;
  let mockRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      save: jest.fn(),
    } as any;
    service = new EmailService(mockRepo);
  });

  it("should send welcome email for valid user", async () => {
    mockRepo.findById.mockResolvedValue({ id: "1", email: "test@test.com" });

    const result = await service.sendWelcome("1", "default");
    expect(result.sent).toBe(true);
  });

  it("should throw when user not found", async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.sendWelcome("999", "default")).rejects.toThrow("User not found");
  });
});
```

---

## 4. Integration Testing (With Redis)

Use a real Redis instance (via Docker or `ioredis-mock`) for integration tests.

```typescript
import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

describe("EmailWorker (integration)", () => {
  let queue: Queue;
  let worker: Worker;
  let connection: IORedis;

  beforeAll(() => {
    connection = new IORedis({ host: "localhost", port: 6379, maxRetriesPerRequest: null });
    queue = new Queue("test-email-queue", { connection });
  });

  afterAll(async () => {
    await worker?.close();
    await queue.obliterate({ force: true });
    await queue.close();
    await connection.quit();
  });

  it("should process job successfully", async () => {
    const completed = new Promise<void>((resolve) => {
      worker = new Worker(
        "test-email-queue",
        async (job: Job) => {
          expect(job.data.userId).toBe("user-1");
          return { sent: true };
        },
        { connection },
      );
      worker.on("completed", () => resolve());
    });

    await queue.add("sendEmail", { userId: "user-1", template: "welcome" });
    await completed;
  });

  it("should retry on failure and eventually move to failed", async () => {
    let attempts = 0;
    const failed = new Promise<void>((resolve) => {
      worker = new Worker(
        "test-email-queue",
        async () => {
          attempts++;
          throw new Error("Service unavailable");
        },
        { connection },
      );
      worker.on("failed", (job) => {
        if (job?.attemptsMade === 3) resolve();
      });
    });

    await queue.add("sendEmail", { userId: "user-1" }, {
      attempts: 3, backoff: { type: "fixed", delay: 100 },
    });
    await failed;
    expect(attempts).toBe(3);
  });
});
```

---

## 5. Mocking Rules

**What to mock:**
- External API calls (email, payment, third-party) in unit tests.
- Redis/BullMQ in unit tests — test service logic directly.
- Time-dependent logic (`Date.now()`).

**What NOT to mock:**
- Redis in integration tests — use a real Redis instance.
- Job serialization — let BullMQ serialize/deserialize to catch issues.
- Zod validation — let it run to catch schema regressions.
- Service layer in integration tests.

```typescript
// Mock external dependency
jest.mock("@/services/smtp.client", () => ({
  sendMail: jest.fn().mockResolvedValue({ messageId: "msg-123" }),
}));
```

---

## 6. Test Execution

```bash
# All tests
npm test

# Unit tests only
npm test -- tests/unit/

# Integration tests (requires Redis)
npm test -- tests/integration/

# Coverage
npm test -- --coverage

# Single file
npm test -- tests/unit/email.service.test.ts

# Watch mode
npm test -- --watch
```

**Rules:**
- Unit tests run without external dependencies (no Redis, no DB).
- Integration tests require Redis — use Docker in CI.
- Use `queue.obliterate()` in `afterAll` to clean up test queues.
- All tests must pass before committing.
