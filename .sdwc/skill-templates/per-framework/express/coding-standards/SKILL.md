# Coding Standards — Express

> This skill defines coding rules for the **{{ name }}** service (Express / TypeScript).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── index.ts                      ← entry point (server start)
│   ├── app.ts                        ← Express app instance + middleware
│   ├── routes/                       ← route definitions (thin layer)
│   │   ├── index.ts                  ← route aggregation
│   │   └── {resource}.routes.ts
│   ├── controllers/                  ← request handling (parse → call service → respond)
│   │   └── {resource}.controller.ts
│   ├── services/                     ← business logic
│   │   └── {resource}.service.ts
│   ├── repositories/                 ← data access (DB queries)
│   │   └── {resource}.repository.ts
│   ├── models/                       ← ORM models / DB schemas
│   │   └── {resource}.model.ts
│   ├── schemas/                      ← zod validation schemas
│   │   └── {resource}.schema.ts
│   ├── middleware/                    ← Express middleware
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validation.middleware.ts
│   ├── types/                        ← shared TypeScript types
│   │   └── {domain}.types.ts
│   ├── config/                       ← app configuration
│   │   ├── index.ts
│   │   └── database.ts
│   └── utils/                        ← pure utility functions
│       └── {utility}.ts
├── tests/
│   ├── setup.ts                      ← test setup (global fixtures)
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── tsconfig.json
├── package.json
└── Dockerfile
```

**Rules:**
- One route file per resource (e.g., `users.routes.ts`, `posts.routes.ts`).
- Controllers are thin — they parse requests, call services, and format responses. No business logic.
- Dependency flow: routes → controllers → services → repositories. Never the reverse.
- `config/` holds environment parsing only — no business logic.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case or dot-separated | `user.service.ts`, `auth.middleware.ts` |
| Classes | PascalCase | `UserService`, `UserController` |
| Interfaces | PascalCase with `I` prefix (optional) | `IUserRepository` or `UserRepository` |
| Functions | camelCase | `getUserById`, `createUser` |
| Constants | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Route paths | kebab-case plural | `/api/v1/user-profiles` |
| Path parameters | camelCase | `/users/:userId` |
| Zod schemas | PascalCase with suffix | `CreateUserSchema`, `UpdateUserSchema` |
| Type aliases | PascalCase | `UserResponse`, `PaginatedResult<T>` |
| Enums | PascalCase, members UPPER_SNAKE | `enum Status { ACTIVE = "active" }` |

**Schema naming pattern:**
- `Create{Resource}Schema` — request body for POST
- `Update{Resource}Schema` — request body for PUT/PATCH
- `{Resource}Response` — response type
- `{Resource}QuerySchema` — query parameters

---

## 3. TypeScript Rules

**Strict mode is mandatory.** `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src",
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

**Rules:**
- Never use `any`. Use `unknown` and narrow with type guards.
- Prefer `interface` for object shapes, `type` for unions/intersections.
- Use zod for runtime validation, infer types from schemas:

```typescript
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  bio: z.string().optional(),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;
```

- Avoid type assertions (`as`). Use type guards instead.
- Use generic types for reusable patterns (`PaginatedResult<T>`).

---

## 4. Import Order

Group imports in this order, separated by blank lines:

```typescript
// 1. Node.js built-ins
import { randomUUID } from "node:crypto";
import path from "node:path";

// 2. Third-party
import express from "express";
import { z } from "zod";

// 3. Local — absolute paths from src root
import { UserService } from "@/services/user.service";
import { CreateUserSchema } from "@/schemas/user.schema";
import { AppError } from "@/config/errors";
```

**Rules:**
- Use path aliases (`@/` → `src/`) configured in `tsconfig.json`.
- Never use relative imports going up more than one level (`../../`).
- Use `node:` prefix for Node.js built-ins (e.g., `node:crypto`, `node:path`).

**tsconfig.json path alias:**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

---

## 5. Express-specific Patterns

### Middleware chain

```typescript
// app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();

// 1. Security headers
app.use(helmet());
// 2. CORS
app.use(cors());
// 3. Body parsing
app.use(express.json({ limit: "10mb" }));
// 4. Request logging
app.use(requestLoggingMiddleware);
// 5. Routes
app.use("/api/v1", routes);
// 6. Error handling (must be last)
app.use(errorMiddleware);
```

### Controller pattern

```typescript
// controllers/user.controller.ts
export class UserController {
  constructor(private userService: UserService) {}

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.getById(req.params.userId);
      res.json(user);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = CreateUserSchema.parse(req.body);
      const user = await this.userService.create(data);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  };
}
```

### Validation middleware

```typescript
// middleware/validation.middleware.ts
import { z, ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({ error: { code: "VALIDATION_ERROR", details: error.issues } });
        return;
      }
      next(error);
    }
  };
}
```

**Rules:**
- Always pass errors to `next(error)` — never swallow them.
- Validation can live in middleware or at controller level. Be consistent within the project.
- Use arrow function properties on controllers to preserve `this` binding.

---

## 6. Linting & Formatting

| Tool | Purpose | Config file |
|------|---------|-------------|
| **ESLint** | Linter | `eslint.config.js` (flat config) |
| **Prettier** | Formatter | `.prettierrc` |
| **tsc** | Type checking | `tsconfig.json` |

**ESLint configuration (flat config):**

```javascript
// eslint.config.js
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
);
```

**Commands:**

```bash
npx eslint .
npx prettier --write .
npx tsc --noEmit
```

**Rules:**
- Run eslint + prettier + tsc before every commit.
- Use TSDoc (`/** */`) for all public functions, classes, and interfaces.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in controllers | Move to `services/` layer |
| Using `any` type | Use `unknown` + type guards |
| Catching errors without `next()` | Always forward errors to error middleware |
| Callback-style async | Use async/await throughout |
| Global mutable state | Inject via constructor or function parameters |
| Hardcoded config values | Use `config/` with environment variables |
| Missing error middleware | Always register global error handler last |
| `console.log()` for logging | Use structured logger (→ skills/common/observability/) |
| Relative imports (`../../`) | Use path aliases (`@/`) |
| No request validation | Use zod schemas for all inputs |
