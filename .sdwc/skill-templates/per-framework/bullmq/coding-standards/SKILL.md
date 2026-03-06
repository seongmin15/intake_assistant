# Coding Standards — BullMQ

> This skill defines coding rules for the **{{ name }}** service (BullMQ / TypeScript).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── index.ts                      ← entry point (worker startup)
│   ├── queues/                       ← queue definitions
│   │   ├── index.ts                  ← queue registry
│   │   └── {domain}.queue.ts
│   ├── workers/                      ← worker/processor definitions
│   │   ├── index.ts                  ← worker registry
│   │   └── {domain}.worker.ts
│   ├── jobs/                         ← job type definitions + producers
│   │   └── {domain}.jobs.ts
│   ├── services/                     ← business logic
│   │   └── {domain}.service.ts
│   ├── repositories/                 ← data access
│   │   └── {domain}.repository.ts
│   ├── models/                       ← ORM models / DB schemas
│   │   └── {domain}.model.ts
│   ├── schemas/                      ← zod schemas for job payloads
│   │   └── {domain}.schema.ts
│   ├── types/                        ← shared TypeScript types
│   │   └── {domain}.types.ts
│   ├── config/                       ← app configuration
│   │   ├── index.ts
│   │   ├── redis.ts
│   │   └── database.ts
│   └── utils/
├── tests/
│   ├── setup.ts
│   ├── unit/
│   └── integration/
├── tsconfig.json
├── package.json
└── Dockerfile
```

**Rules:**
- One queue per domain (e.g., `email.queue.ts`, `report.queue.ts`).
- Workers are thin — they validate the job payload and call services. Business logic lives in `services/`.
- Dependency flow: workers → services → repositories. Never the reverse.
- Job payload types and producer functions go in `jobs/`.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Queue files | `{domain}.queue.ts` | `email.queue.ts` |
| Worker files | `{domain}.worker.ts` | `email.worker.ts` |
| Job files | `{domain}.jobs.ts` | `email.jobs.ts` |
| Queue names | kebab-case | `email-queue`, `report-queue` |
| Job names | camelCase | `sendWelcomeEmail`, `generateReport` |
| Worker classes | PascalCase + `Worker` | `EmailWorker` |
| Service classes | PascalCase | `EmailService` |
| Job payload types | PascalCase + `JobData` | `SendEmailJobData` |
| Constants | UPPER_SNAKE | `MAX_RETRY_COUNT` |

---

## 3. TypeScript Rules

**Strict mode is mandatory.** Same strict `tsconfig.json` as Express/NestJS.

**Use zod for job payload validation:**

```typescript
import { z } from "zod";

export const SendEmailJobSchema = z.object({
  userId: z.string().uuid(),
  template: z.string().default("default"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

export type SendEmailJobData = z.infer<typeof SendEmailJobSchema>;
```

**Rules:**
- Never use `any`. All job data must be typed.
- Validate job payloads with zod inside the worker before processing.
- Job payloads must be JSON-serializable.
- Use generic types for reusable patterns.

---

## 4. Import Order

Same as Express — group by: Node.js built-ins → Third-party (bullmq, ioredis) → Local (`@/`).

```typescript
// 1. Node.js built-ins
import { randomUUID } from "node:crypto";

// 2. Third-party
import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

// 3. Local
import { EmailService } from "@/services/email.service";
import { SendEmailJobSchema } from "@/schemas/email.schema";
```

**Rules:**
- Use path aliases (`@/` → `src/`).
- Never use relative imports going up more than one level.

---

## 5. BullMQ-specific Patterns

### Queue definition

```typescript
// queues/email.queue.ts
import { Queue } from "bullmq";
import { redisConnection } from "@/config/redis";

export const emailQueue = new Queue("email-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});
```

### Job producer

```typescript
// jobs/email.jobs.ts
import { emailQueue } from "@/queues/email.queue";
import { SendEmailJobData } from "@/schemas/email.schema";

export async function enqueueSendEmail(data: SendEmailJobData): Promise<string> {
  const job = await emailQueue.add("sendWelcomeEmail", data, {
    priority: data.priority === "high" ? 1 : data.priority === "normal" ? 5 : 10,
  });
  return job.id!;
}
```

### Worker processor

```typescript
// workers/email.worker.ts
import { Worker, Job } from "bullmq";
import { redisConnection } from "@/config/redis";
import { SendEmailJobSchema, SendEmailJobData } from "@/schemas/email.schema";
import { EmailService } from "@/services/email.service";
import { logger } from "@/config/logger";

const emailService = new EmailService();

export const emailWorker = new Worker(
  "email-queue",
  async (job: Job<SendEmailJobData>) => {
    const data = SendEmailJobSchema.parse(job.data);
    logger.info({ jobId: job.id, userId: data.userId }, "Processing email job");

    const result = await emailService.sendWelcome(data.userId, data.template);
    return result;
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },  // rate limit: 10 jobs/sec
  },
);
```

**Rules:**
- Workers validate job data before processing — never trust the payload blindly.
- Workers are thin: validate → call service → return result.
- Always set `attempts` and `backoff` for retry behavior.
- Always set `removeOnComplete` and `removeOnFail` to prevent Redis memory bloat.

---

## 6. Linting & Formatting

| Tool | Purpose | Config file |
|------|---------|-------------|
| **ESLint** | Linter | `eslint.config.js` |
| **Prettier** | Formatter | `.prettierrc` |
| **tsc** | Type checking | `tsconfig.json` |

```bash
npx eslint .
npx prettier --write .
npx tsc --noEmit
```

**Docstrings:** TSDoc (`/** */`) for all public functions, classes, and job types.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in workers | Delegate to `services/` |
| Non-serializable job data | Pass IDs or plain objects, not class instances |
| No job payload validation | Validate with zod in worker |
| Missing retry config | Set `attempts` + `backoff` on all queues |
| No `removeOnComplete` | Redis fills up | Set retention limits |
| Global mutable state in workers | Each job invocation is independent |
| `console.log()` for logging | Use structured logger (→ skills/common/observability/) |
| Blocking Redis connection | Use separate connections for queue and worker |
| Using `any` for job data | Type all payloads with zod + inferred types |
