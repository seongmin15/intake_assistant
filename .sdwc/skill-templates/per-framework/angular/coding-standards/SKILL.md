# Coding Standards — Angular

> This skill defines coding rules for the **{{ name }}** service (Angular / TypeScript).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── app/
│   │   ├── core/                     ← singleton services, guards, interceptors
│   │   │   ├── services/
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   └── core.module.ts        ← (NgModule) or provided in root
│   │   ├── shared/                   ← reusable components, directives, pipes
│   │   │   ├── components/
│   │   │   ├── directives/
│   │   │   ├── pipes/
│   │   │   └── shared.module.ts
│   │   ├── features/                 ← feature modules (lazy-loaded)
│   │   │   └── {feature-name}/
│   │   │       ├── components/
│   │   │       ├── services/
│   │   │       ├── models/
│   │   │       ├── {feature-name}.component.ts
│   │   │       └── {feature-name}.routes.ts
│   │   ├── app.component.ts
│   │   ├── app.config.ts
│   │   └── app.routes.ts
│   ├── assets/
│   ├── environments/
│   │   ├── environment.ts
│   │   └── environment.prod.ts
│   └── styles/
├── angular.json
├── package.json
└── tsconfig.json
```

**Rules:**
- Use **standalone components** (Angular 17+). Avoid NgModules for new code.
- Feature folders are lazy-loaded via route configuration.
- `core/` for app-wide singletons (auth service, HTTP interceptors). `shared/` for reusable UI.
- One component/service/pipe per file.
- Colocate feature-specific services within the feature folder.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Components | kebab-case file, PascalCase class | `user-profile.component.ts` → `UserProfileComponent` |
| Services | kebab-case file, PascalCase class | `auth.service.ts` → `AuthService` |
| Directives | kebab-case file, camelCase selector | `highlight.directive.ts` → `appHighlight` |
| Pipes | kebab-case file, camelCase name | `format-date.pipe.ts` → `formatDate` |
| Interfaces/Models | PascalCase | `User`, `CreateUserRequest` |
| Constants | UPPER_SNAKE | `MAX_PAGE_SIZE` |
| Guards | kebab-case file | `auth.guard.ts` |
| Interceptors | kebab-case file | `error.interceptor.ts` |

**Selector prefixes:** All component selectors use the app prefix: `app-user-profile`.

---

## 3. TypeScript Rules

**Rule: strict mode enabled.** No `any` unless absolutely unavoidable (and documented).

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  },
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictTemplates": true
  }
}
```

**Rules:**
- Enable `strictTemplates` — catches template type errors at compile time.
- Use `interface` for data models, `type` for unions and intersections.
- Explicitly type all service method return values.
- Use `inject()` function (Angular 14+) instead of constructor injection for cleaner code.

```typescript
// ✅ Modern inject()
export class UserService {
  private http = inject(HttpClient);
}

// ❌ Avoid constructor injection for new code
export class UserService {
  constructor(private http: HttpClient) {}
}
```

---

## 4. Import Order

Group imports in this order, separated by blank lines:

```typescript
// 1. Angular core
import { Component, inject, signal } from "@angular/core";
import { RouterLink, Router } from "@angular/router";
import { HttpClient } from "@angular/common/http";

// 2. Angular CDK / Material
import { MatButtonModule } from "@angular/material/button";

// 3. Third-party libraries
import { Observable, map, switchMap } from "rxjs";

// 4. Internal — core/shared
import { AuthService } from "@core/services/auth.service";
import { SpinnerComponent } from "@shared/components/spinner.component";

// 5. Relative — feature-local
import { UserCardComponent } from "./components/user-card.component";
import type { User } from "./models/user";
```

**Rules:**
- Use path aliases (`@core/`, `@shared/`, `@features/`) configured in `tsconfig.json`.
- Separate `import type` from value imports.

---

## 5. Component Patterns

### Standalone components (default)

```typescript
@Component({
  selector: "app-user-card",
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    <div class="user-card">
      <h3>{{ user().name }}</h3>
      <button mat-button (click)="onSelect()">Select</button>
    </div>
  `,
})
export class UserCardComponent {
  user = input.required<User>();
  selected = output<string>();

  onSelect() {
    this.selected.emit(this.user().id);
  }
}
```

### Signals (Angular 17+)

- Use `signal()` for local state, `computed()` for derived state.
- Use `input()` and `output()` for component I/O (signal-based).
- Use `effect()` for side effects only.

### Dependency injection

- Use `inject()` function, not constructor injection.
- Services in `core/` are `providedIn: 'root'`. Feature services are provided in feature routes.

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ESLint** | Linter | `eslint.config.js` |
| **@angular-eslint** | Angular-specific rules | via ESLint config |
| **Prettier** | Formatter | `.prettierrc` |

**Commands:**

```bash
ng lint                      # Angular-aware lint
prettier --write src/        # format
tsc --noEmit                 # type check
```

**Rules:**
- Run lint + format before every commit.
- Use `@angular-eslint/recommended` as base config.
- Enable template linting with `@angular-eslint/template`.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| `any` type | Use proper types or `unknown` |
| NgModules for new code | Use standalone components |
| Constructor injection | Use `inject()` function |
| Manual subscribe in components | Use `async` pipe or `toSignal()` |
| Business logic in components | Extract to services |
| Shared mutable state | Use signals or RxJS with proper scoping |
| Direct DOM manipulation | Use template bindings, directives, or `Renderer2` |
| `console.log` in production | Use structured logger (→ skills/common/observability/) |
