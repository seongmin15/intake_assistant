# Framework — BullMQ

> This skill defines BullMQ-specific patterns for the **{{ name }}** service.
> Read this before building or modifying any worker logic.

---

## 1. Application Bootstrap

### Worker entry point

```typescript
// index.ts
import { initDatabase } from "@/config/database";
import { logger } from "@/config/logger";
import { startWorkers } from "@/workers";

async function main() {
  await initDatabase();
  const workers = startWorkers();
  logger.info({ workerCount: workers.length }, "Workers started");

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received");
    await Promise.all(workers.map((w) => w.close()));
    logger.info("All workers closed");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.fatal({ error }, "Failed to start workers");
  process.exit(1);
});
```

### Redis connection

```typescript
// config/redis.ts
import IORedis from "ioredis";

export const redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,  // required by BullMQ
});
```

**Logging** (→ also see skills/common/observability/):

```typescript
// config/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});
```

---

## 2. Queue & Worker Design

{% for wkr in workers %}
### {{ wkr.name }}

**Responsibility:** {{ wkr.responsibility }}
**Trigger:** {{ wkr.trigger_type }}{{ " — `" ~ wkr.trigger_config ~ "`" if wkr.trigger_config else "" }}
{% if wkr.concurrency %}**Concurrency:** {{ wkr.concurrency }}{% endif %}
{% if wkr.retry_policy %}**Retry:** {{ wkr.retry_policy }}{% endif %}
{% if wkr.timeout %}**Timeout:** {{ wkr.timeout }}{% endif %}
**Idempotent:** {{ wkr.idempotent }}{{ " — " ~ wkr.idempotent_strategy if wkr.idempotent_strategy else "" }}

{% endfor %}

### Queue definition pattern

```typescript
// queues/{domain}.queue.ts
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

### Worker definition pattern

```typescript
// workers/{domain}.worker.ts
import { Worker, Job } from "bullmq";
import { redisConnection } from "@/config/redis";
import { logger } from "@/config/logger";

export function createEmailWorker(): Worker {
  const worker = new Worker(
    "email-queue",
    async (job: Job) => {
      // 1. Validate payload
      const data = SendEmailJobSchema.parse(job.data);

      // 2. Log start
      logger.info({ jobId: job.id, jobName: job.name }, "Job started");

      // 3. Delegate to service
      const result = await emailService.process(data);

      // 4. Log completion
      logger.info({ jobId: job.id, result }, "Job completed");
      return result;
    },
    {
      connection: redisConnection,
      concurrency: 5,
    },
  );

  // Event handlers
  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Job failed");
  });

  worker.on("stalled", (jobId) => {
    logger.warn({ jobId }, "Job stalled");
  });

  return worker;
}
```

---

## 3. Job Types & Producers

### Type-safe job definitions

```typescript
// jobs/email.jobs.ts
import { z } from "zod";
import { emailQueue } from "@/queues/email.queue";

// Schema
export const SendEmailJobSchema = z.object({
  userId: z.string().uuid(),
  template: z.string(),
  metadata: z.record(z.string()).optional(),
});
export type SendEmailJobData = z.infer<typeof SendEmailJobSchema>;

// Producer function
export async function enqueueSendEmail(data: SendEmailJobData): Promise<string> {
  const validated = SendEmailJobSchema.parse(data);
  const job = await emailQueue.add("sendEmail", validated);
  return job.id!;
}

// Bulk producer
export async function enqueueBulkEmails(items: SendEmailJobData[]): Promise<void> {
  const jobs = items.map((data) => ({
    name: "sendEmail",
    data: SendEmailJobSchema.parse(data),
  }));
  await emailQueue.addBulk(jobs);
}
```

**Rules:**
- Every job type has a zod schema + inferred TypeScript type.
- Producer functions validate data before enqueuing.
- Bulk operations use `addBulk()` for efficiency.

---

## 4. Retry & Error Handling

### Retry configuration

```typescript
// Per-queue defaults
const queueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },  // 1s, 2s, 4s
  },
};

// Per-job override
await queue.add("criticalJob", data, {
  attempts: 5,
  backoff: { type: "exponential", delay: 2000 },
});
```

### Error classification

```typescript
// In worker processor
async function processJob(job: Job): Promise<void> {
  try {
    await doWork(job.data);
  } catch (error) {
    if (isTransientError(error)) {
      // BullMQ will retry automatically
      throw error;
    }
    if (isPermanentError(error)) {
      // Move to DLQ / log and don't retry
      logger.error({ jobId: job.id, error }, "Permanent failure, skipping retries");
      throw new UnrecoverableError(error.message);
    }
    throw error;  // unknown errors: let retry policy decide
  }
}
```

### Dead letter queue

```typescript
// Listen for failed jobs after all retries exhausted
worker.on("failed", async (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    logger.error({ jobId: job.id, data: job.data, err }, "Job moved to DLQ");
    await deadLetterQueue.add("failed-job", {
      originalQueue: "email-queue",
      originalJobId: job.id,
      data: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });
  }
});
```

---

## 5. Scheduled & Repeatable Jobs

{% for wkr in workers %}
{% if wkr.trigger_type == "cron" %}
### Cron: {{ wkr.name }}

```typescript
await queue.add("{{ wkr.name }}", {}, {
  repeat: { pattern: "{{ wkr.trigger_config }}" },
  {% if wkr.overlap_policy %}
  // Overlap policy: {{ wkr.overlap_policy }}
  {% endif %}
});
```
{% endif %}
{% endfor %}

### Repeatable job management

```typescript
// Add repeatable job
await queue.add("dailyReport", {}, {
  repeat: { pattern: "0 9 * * *" },  // every day at 9 AM
  jobId: "daily-report",             // stable ID prevents duplicates
});

// List repeatable jobs
const repeatableJobs = await queue.getRepeatableJobs();

// Remove repeatable job
await queue.removeRepeatableByKey(repeatableJobs[0].key);
```

**Rules:**
- Use stable `jobId` for repeatable jobs to prevent duplicates on restart.
- Cron jobs produce work that workers consume — the cron just enqueues, the worker processes.

---

## 6. Concurrency & Rate Limiting

```typescript
// Worker-level concurrency
const worker = new Worker("queue", processor, {
  concurrency: 10,  // 10 parallel jobs per worker instance
});

// Queue-level rate limiting
const worker = new Worker("queue", processor, {
  limiter: {
    max: 100,       // max 100 jobs
    duration: 60000, // per 60 seconds
  },
});
```

### Batch processing

```typescript
// Not built-in — implement in processor
async function processBatch(job: Job<{ items: string[] }>) {
  const { items } = job.data;
  const batchSize = 50;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await processBatchChunk(batch);
    await job.updateProgress(Math.floor((i / items.length) * 100));
  }
}
```

---

## 7. Idempotency

```typescript
// Option 1: Use jobId for deduplication
await queue.add("processOrder", { orderId: "order-123" }, {
  jobId: "process-order-123",  // same ID = job not added if exists
});

// Option 2: Check in worker
async function processOrder(job: Job) {
  const existing = await orderRepo.findProcessed(job.data.orderId);
  if (existing) {
    logger.info({ orderId: job.data.orderId }, "Already processed, skipping");
    return existing;
  }
  // ... process
}
```

---

## 8. Graceful Shutdown

```typescript
// Already in bootstrap (§1), but key details:
async function shutdown(workers: Worker[]) {
  // 1. Stop accepting new jobs
  // 2. Wait for current jobs to finish (BullMQ handles this on close)
  await Promise.all(workers.map((w) => w.close()));
  // 3. Close Redis connections
  await redisConnection.quit();
}
```

BullMQ `worker.close()` waits for active jobs to finish. Set a timeout in your deployment orchestrator (e.g., `terminationGracePeriodSeconds` in Kubernetes).

---

## 9. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Business logic in workers | Fat workers, hard to test | Delegate to `services/` |
| No payload validation | Invalid data causes runtime errors | Validate with zod in worker |
| Missing `maxRetriesPerRequest: null` | BullMQ connection fails | Set in Redis config |
| No `removeOnComplete/Fail` | Redis memory grows unbounded | Set retention limits |
| Sharing Redis connection | Queue and worker block each other | Use separate connections |
| Non-serializable job data | Jobs fail silently | Pass only JSON-serializable data |
| No graceful shutdown | Jobs interrupted, data loss | Handle SIGTERM, close workers |
| Missing event handlers | Failures go unnoticed | Listen to `failed`, `stalled`, `error` |
