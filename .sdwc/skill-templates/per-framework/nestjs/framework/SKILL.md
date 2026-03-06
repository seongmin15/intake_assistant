# Framework — NestJS

> This skill defines NestJS-specific patterns for the **{{ name }}** service.
> Auth: **{{ auth.method }}** | API style: **{{ api_style }}**
> Read this before building or modifying any application logic.

---

## 1. Application Bootstrap

```typescript
// main.ts
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug"],
  });

  // Global prefix
  app.setGlobalPrefix("api/v1");

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // strip unknown properties
      forbidNonWhitelisted: true, // throw on unknown properties
      transform: true,           // auto-transform payloads to DTO instances
    }),
  );

  // CORS
  app.enableCors();

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`Server running on port ${port}`, "Bootstrap");
}

bootstrap();
```

### Root module

```typescript
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        url: config.get<string>("DATABASE_URL"),
        entities: [__dirname + "/modules/**/entities/*.entity{.ts,.js}"],
        migrations: [__dirname + "/migrations/*{.ts,.js}"],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    UserModule,
    PostModule,
  ],
})
export class AppModule {}
```

**Logging** (→ also see skills/common/observability/):

Use NestJS built-in `Logger` or integrate `nestjs-pino` for structured JSON logging:

```typescript
import { LoggerModule } from "nestjs-pino";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: { level: process.env.LOG_LEVEL ?? "info" },
    }),
  ],
})
export class AppModule {}
```

---

## 2. Module System

### Feature module

```typescript
// modules/users/user.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
```

### Cross-module dependency

```typescript
// modules/orders/order.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    UserModule,  // imports UserService via UserModule.exports
  ],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
```

**Rules:**
- Each module owns its entities, controllers, services, and DTOs.
- Only `export` what other modules need — minimize public surface.
- Avoid circular dependencies. If needed, use `forwardRef()` sparingly.
- Global modules (`@Global()`) only for truly cross-cutting concerns (config, logging).

---

## 3. Guards — Authentication & Authorization

### Auth Guard

```typescript
// common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request.headers.authorization);

    if (!token) throw new UnauthorizedException("Missing token");

    try {
      const payload = await this.verifyToken(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }

  private extractToken(header?: string): string | null {
    if (!header?.startsWith("Bearer ")) return null;
    return header.slice(7);
  }
}
```

### Roles Guard

```typescript
// common/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>("roles", context.getHandler());
    if (!roles) return true;

    const request = context.switchToHttp().getRequest();
    return roles.includes(request.user?.role);
  }
}

// common/decorators/roles.decorator.ts
export const Roles = (...roles: string[]) => SetMetadata("roles", roles);
```

**Usage:**

```typescript
@Controller("api/v1/users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  @Post()
  @Roles("admin")
  async create(@Body() dto: CreateUserDto) { ... }

  @Get(":id")
  async findOne(@Param("id") id: string) { ... }  // any authenticated user
}
```

**Rules:**
- Apply `JwtAuthGuard` at controller or method level — not globally (health checks need to be public).
- Authorization (roles) is a separate guard from authentication.
- Use custom decorators for metadata (`@Roles()`, `@Public()`).

---

## 4. Pipes — Validation & Transformation

**Global `ValidationPipe` handles all DTO validation automatically.**

For custom transformations:

```typescript
// common/pipes/parse-uuid.pipe.ts
@Injectable()
export class ParseUUIDPipe implements PipeTransform {
  transform(value: string): string {
    if (!isUUID(value)) {
      throw new BadRequestException(`Invalid UUID: ${value}`);
    }
    return value;
  }
}

// Usage
@Get(":id")
async findOne(@Param("id", ParseUUIDPipe) id: string) { ... }
```

---

## 5. Exception Filters

### Global exception filter

```typescript
// common/filters/http-exception.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const { status, body } = this.buildResponse(exception);

    if (status >= 500) {
      this.logger.error({ exception, path: request.url }, "Unhandled exception");
    }

    response.status(status).json(body);
  }

  private buildResponse(exception: unknown) {
    if (exception instanceof HttpException) {
      return {
        status: exception.getStatus(),
        body: { error: exception.getResponse() },
      };
    }
    return {
      status: 500,
      body: { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
    };
  }
}
```

{% if error_response_format %}
**Error response format: {{ error_response_format }}**
{% endif %}

**Register globally in `main.ts`:**

```typescript
app.useGlobalFilters(new AllExceptionsFilter());
```

**Rules:**
- Use NestJS built-in exceptions (`NotFoundException`, `ConflictException`, etc.) in services.
- Global exception filter ensures consistent error response format.
- Never expose stack traces or internal details to the client.

---

## 6. Interceptors

### Logging interceptor

```typescript
// common/interceptors/logging.interceptor.ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.log(`${request.method} ${request.url} ${duration}ms`);
      }),
    );
  }
}
```

### Response transformation interceptor

```typescript
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, { data: T }> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<{ data: T }> {
    return next.handle().pipe(map((data) => ({ data })));
  }
}
```

---

## 7. Database & TypeORM

{% if databases %}
### Entity definition

```typescript
// modules/users/entities/user.entity.ts
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 100 })
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];
}
```

### Repository pattern

```typescript
@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }
}
```

### Migrations

```bash
npx typeorm migration:generate -d src/config/database.config.ts -n MigrationName
npx typeorm migration:run -d src/config/database.config.ts
```

**Rules:**
- Never use `synchronize: true` in production.
- Always review generated migrations before committing.
- Repository handles data access; service handles business logic.
{% endif %}

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Business logic in controllers | Fat controllers | Move to services |
| Manual instantiation | Bypasses DI, untestable | Use `@Injectable()` + constructor injection |
| Circular module deps | Runtime errors | Refactor or use `forwardRef()` sparingly |
| Missing `ValidationPipe` | Unvalidated input reaches services | Enable globally in `main.ts` |
| `synchronize: true` in prod | Data loss risk | Use migrations |
| Exposing entities as responses | Tight coupling, over-exposure | Use DTOs for responses |
| `console.log()` | Unstructured logs | Use NestJS `Logger` or `nestjs-pino` |
| Global guards for everything | Blocks health checks | Apply at controller/method level |
