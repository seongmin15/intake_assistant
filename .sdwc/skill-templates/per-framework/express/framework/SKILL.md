# Framework — Express

> This skill defines Express-specific patterns for the **{{ name }}** service.
> Auth: **{{ auth.method }}** | API style: **{{ api_style }}**
> Read this before building or modifying any application logic.

---

## 1. Application Bootstrap

### App factory

```typescript
// app.ts
import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { routes } from "@/routes";
import { errorMiddleware } from "@/middleware/error.middleware";
import { requestLoggingMiddleware } from "@/middleware/logging.middleware";

export function createApp(): Express {
  const app = express();

  // Middleware order matters
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(requestLoggingMiddleware);

  // Routes
  app.use("/api/v1", routes);

  // Error handling — MUST be last
  app.use(errorMiddleware);

  return app;
}
```

### Server entry point

```typescript
// index.ts
import { createApp } from "@/app";
import { initDatabase } from "@/config/database";
import { logger } from "@/config/logger";

async function main() {
  await initDatabase();
  const app = createApp();
  const port = process.env.PORT ?? 3000;

  app.listen(port, () => {
    logger.info({ port }, "Server started");
  });
}

main().catch((error) => {
  logger.fatal({ error }, "Failed to start server");
  process.exit(1);
});
```

**Logging setup** (→ also see skills/common/observability/):

```typescript
// config/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty" }
    : undefined,
});
```

Use `pino` for structured JSON logging. Never use `console.log()`.

---

## 2. Route Organization

### Route aggregation

```typescript
// routes/index.ts
import { Router } from "express";
import { userRoutes } from "./user.routes";
import { postRoutes } from "./post.routes";

export const routes = Router();
routes.use("/users", userRoutes);
routes.use("/posts", postRoutes);
```

### Resource routes

```typescript
// routes/user.routes.ts
import { Router } from "express";
import { UserController } from "@/controllers/user.controller";
import { UserService } from "@/services/user.service";
import { authMiddleware } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validation.middleware";
import { CreateUserSchema, UpdateUserSchema } from "@/schemas/user.schema";

const controller = new UserController(new UserService());

export const userRoutes = Router();
userRoutes.get("/", authMiddleware, controller.list);
userRoutes.get("/:userId", authMiddleware, controller.getById);
userRoutes.post("/", authMiddleware, validate(CreateUserSchema), controller.create);
userRoutes.put("/:userId", authMiddleware, validate(UpdateUserSchema), controller.update);
userRoutes.delete("/:userId", authMiddleware, controller.delete);
```

### Layer separation

```
Route (wiring) → Controller (thin) → Service (business logic) → Repository (data access)
```

- **Routes**: wire middleware + controller methods. No logic.
- **Controllers**: parse request, call service, format response. No business logic.
- **Services**: orchestrate operations, enforce business rules. No HTTP concepts (no `req`, `res`).
- **Repositories**: data access only. No business rules.

---

## 3. Request Validation (Zod)

```typescript
// schemas/user.schema.ts
import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial();

export const UserQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

// Infer types from schemas
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
```

{% if pagination == "cursor" %}
**Cursor pagination:**

```typescript
export const CursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
```
{% endif %}
{% if pagination == "offset" %}
**Offset pagination:**

```typescript
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```
{% endif %}

**Rules:**
- Define one zod schema per request type (create, update, query).
- Infer TypeScript types from schemas — don't duplicate definitions.
- Validate in middleware or at the controller entry point. Never skip validation.

---

## 4. Auth Pattern

**Method: {{ auth.method }}**

All authentication is handled via middleware.

```typescript
// middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "@/config/errors";

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      throw new AppError("UNAUTHORIZED", "Missing authentication token", 401);
    }
    const user = await verifyToken(token);  // adapt to auth method
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function extractToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}
```

**Extending Express Request type:**

```typescript
// types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: string };
    }
  }
}
```

**Role-based authorization middleware:**

```typescript
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError("FORBIDDEN", "Insufficient permissions", 403));
      return;
    }
    next();
  };
}
```

**Rules:**
- Auth middleware sets `req.user` — downstream code reads it.
- Unauthenticated routes simply omit the auth middleware from the chain.
- Authorization (role checks) is a separate middleware from authentication.
- Never put auth logic in controllers or services.

---

## 5. Error Handling

### Domain Errors

```typescript
// config/errors.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super("NOT_FOUND", `${resource} '${id}' not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super("VALIDATION_ERROR", "Validation failed", 422, details);
  }
}
```

### Global Error Middleware

```typescript
// middleware/error.middleware.ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "@/config/errors";
import { logger } from "@/config/logger";

export function errorMiddleware(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: "Validation failed", details: err.issues },
    });
    return;
  }

  // Unexpected error
  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
}
```

{% if error_response_format %}
**Error response format: {{ error_response_format }}**
{% endif %}

**Rules:**
- Services throw domain errors (`AppError` subclasses). Never throw generic `Error`.
- Error middleware is the only place HTTP responses are formed for errors.
- Log unexpected errors at ERROR level with full stack trace.
- Never expose internal details to the client.

---

## 6. Database & ORM

{% if databases %}
### Connection management

```typescript
// config/database.ts
import { DataSource } from "typeorm";

export const dataSource = new DataSource({
  type: "postgres",  // adapt to DB engine
  url: process.env.DATABASE_URL,
  entities: ["src/models/*.model.ts"],
  migrations: ["src/migrations/*.ts"],
  synchronize: false,  // never in production
  logging: process.env.NODE_ENV === "development",
});

export async function initDatabase() {
  await dataSource.initialize();
}
```

### Repository pattern

```typescript
// repositories/user.repository.ts
import { dataSource } from "@/config/database";
import { User } from "@/models/user.model";

export class UserRepository {
  private repo = dataSource.getRepository(User);

  async findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }
}
```

### Transaction management

```typescript
import { dataSource } from "@/config/database";

class OrderService {
  async createOrder(data: CreateOrderInput): Promise<Order> {
    return dataSource.transaction(async (manager) => {
      const order = manager.create(Order, data);
      await manager.save(order);
      await this.updateInventory(manager, order);
      return order;
    });
  }
}
```

**Rules:**
- Never use `synchronize: true` in production — use migrations.
- Use repository pattern for data access. Services call repositories, not the DB directly.
- Wrap multi-step writes in transactions.
{% endif %}

---

## 7. Graceful Shutdown

```typescript
// index.ts
const server = app.listen(port, () => { ... });

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(async () => {
    await dataSource.destroy();
    logger.info("Server closed");
    process.exit(0);
  });
  // Force close after timeout
  setTimeout(() => process.exit(1), 10000);
});
```

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Business logic in controllers | Fat controllers, hard to test | Move to `services/` |
| Missing error middleware | Unhandled errors crash server | Register global error handler |
| Swallowing errors in `try/catch` | Silent failures | Always `next(error)` or rethrow |
| Using `any` type | Type safety lost | Use `unknown` + type guards |
| `console.log()` for logging | Unstructured, not JSON | Use `pino` structured logger |
| No request validation | Invalid data reaches services | Validate with zod at entry points |
| Missing `async` error handling | Unhandled promise rejections | Use `express-async-errors` or wrap handlers |
| No graceful shutdown | Connections dropped, data loss | Handle SIGTERM, close DB, drain requests |
