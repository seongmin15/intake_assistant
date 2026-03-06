# Coding Standards — NestJS

> This skill defines coding rules for the **{{ name }}** service (NestJS / TypeScript).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── main.ts                        ← bootstrap (NestFactory.create)
│   ├── app.module.ts                  ← root module
│   ├── modules/                       ← feature modules (one per domain)
│   │   └── {domain}/
│   │       ├── {domain}.module.ts
│   │       ├── {domain}.controller.ts
│   │       ├── {domain}.service.ts
│   │       ├── {domain}.repository.ts
│   │       ├── dto/                   ← data transfer objects
│   │       │   ├── create-{domain}.dto.ts
│   │       │   └── update-{domain}.dto.ts
│   │       ├── entities/              ← TypeORM entities
│   │       │   └── {domain}.entity.ts
│   │       └── guards/               ← module-specific guards (if any)
│   ├── common/                        ← shared across modules
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── filters/
│   │   ├── pipes/
│   │   └── types/
│   └── config/                        ← app configuration
│       ├── config.module.ts
│       └── database.config.ts
├── test/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── tsconfig.json
├── nest-cli.json
├── package.json
└── Dockerfile
```

**Rules:**
- One module per domain (e.g., `modules/users/`, `modules/posts/`).
- Each module encapsulates its controller, service, repository, DTOs, and entities.
- Dependency flow: controller → service → repository. Never the reverse.
- `common/` holds cross-cutting concerns: guards, interceptors, filters, decorators.
- Never import directly between feature modules — use the module's `exports` array.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case with suffix | `user.controller.ts`, `create-user.dto.ts` |
| Classes | PascalCase with suffix | `UserController`, `UserService`, `UserModule` |
| Interfaces | PascalCase with `I` prefix (optional) | `IUserRepository` |
| Methods | camelCase | `findById`, `createUser` |
| Constants | UPPER_SNAKE | `MAX_PAGE_SIZE` |
| Route paths | kebab-case plural | `/api/v1/user-profiles` |
| DTO classes | PascalCase with action prefix | `CreateUserDto`, `UpdateUserDto` |
| Entity classes | PascalCase singular | `User`, `Post`, `OrderItem` |
| Guard classes | PascalCase + `Guard` | `JwtAuthGuard`, `RolesGuard` |
| Interceptor classes | PascalCase + `Interceptor` | `LoggingInterceptor` |
| Filter classes | PascalCase + `Filter` | `HttpExceptionFilter` |
| Decorator functions | camelCase | `@CurrentUser()`, `@Roles()` |

**DTO naming pattern:**
- `Create{Resource}Dto` — POST request body
- `Update{Resource}Dto` — PUT/PATCH request body (use `PartialType()`)
- `{Resource}ResponseDto` — response shape

---

## 3. TypeScript Rules

**Strict mode is mandatory.** Same `tsconfig.json` rules as Express.

**Use class-validator + class-transformer for DTOs:**

```typescript
import { IsEmail, IsString, MaxLength, MinLength, IsOptional } from "class-validator";

export class CreateUserDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
```

**Rules:**
- Never use `any`. Use `unknown` and narrow with type guards.
- Use class-validator decorators for all DTOs.
- Use `PartialType()` and `PickType()` from `@nestjs/mapped-types` to derive DTOs.
- Enable `ValidationPipe` globally in `main.ts`.

---

## 4. Import Order

Group imports in this order, separated by blank lines:

```typescript
// 1. Node.js built-ins
import { randomUUID } from "node:crypto";

// 2. NestJS core
import { Controller, Get, Post, Body, Param, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

// 3. Third-party
import { Repository } from "typeorm";

// 4. Local — relative imports within module, absolute for cross-module
import { UserService } from "./user.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
```

**Rules:**
- Within a module: relative imports are acceptable.
- Cross-module: import from the module's public API.
- Never use wildcard imports.

---

## 5. NestJS-specific Patterns

### Module encapsulation

```typescript
// modules/users/user.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService],  // only export what other modules need
})
export class UserModule {}
```

### Constructor injection

```typescript
// NestJS DI — always use constructor injection
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly configService: ConfigService,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException(`User '${id}' not found`);
    return user;
  }
}
```

### Controller pattern

```typescript
@Controller("api/v1/users")
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<UserResponseDto> {
    return this.userService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(dto);
  }
}
```

**Rules:**
- Controllers are thin — parse request, call service, return response.
- Services hold business logic. No HTTP concepts (no `Request`, `Response`).
- Use NestJS exceptions (`NotFoundException`, `ConflictException`) in services.
- Use decorators for metadata, not logic.

---

## 6. Linting & Formatting

| Tool | Purpose | Config file |
|------|---------|-------------|
| **ESLint** | Linter | `eslint.config.js` (flat config) |
| **Prettier** | Formatter | `.prettierrc` |
| **tsc** | Type checking | `tsconfig.json` |

```bash
npx eslint .
npx prettier --write .
npx tsc --noEmit
```

**Rules:**
- Run eslint + prettier + tsc before every commit.
- Use TSDoc (`/** */`) for all public classes, methods, and DTOs.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Business logic in controllers | Move to services |
| Direct module-to-module imports | Use module exports + DI |
| Using `any` type | Use `unknown` + type guards |
| Manual instantiation (`new Service()`) | Use NestJS DI (`@Injectable()`) |
| Circular module dependencies | Refactor to shared module or use `forwardRef()` sparingly |
| Fat DTOs with logic | DTOs = data shape + validation only |
| Missing `ValidationPipe` | Enable globally in `main.ts` |
| `console.log()` for logging | Use NestJS `Logger` or `pino` (→ skills/common/observability/) |
| Ignoring module boundaries | Respect encapsulation via `exports` |
