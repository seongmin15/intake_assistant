# Framework — Angular

> This skill defines Angular-specific patterns for the **{{ name }}** service.
> Rendering: **{{ rendering_strategy }}** | State: **{{ state_management }}** | CSS: **{{ css_strategy }}**
> Read this before building or modifying any UI logic.

---

## 1. Application Bootstrap

```typescript
// main.ts
import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";

bootstrapApplication(AppComponent, appConfig);
```

```typescript
// app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { routes } from "./app.routes";
import { errorInterceptor } from "@core/interceptors/error.interceptor";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([errorInterceptor])),
  ],
};
```

```typescript
// app/app.component.ts
@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
```

**Rules:**
- Use `bootstrapApplication` with standalone components — no `AppModule`.
- Configure providers in `appConfig` using `provide*` functions.
- Register HTTP interceptors with `withInterceptors()`.

---

## 2. Routing

```typescript
// app/app.routes.ts
import { Routes } from "@angular/router";
import { authGuard } from "@core/guards/auth.guard";

export const routes: Routes = [
  {
    path: "",
    loadComponent: () => import("./features/home/home.component").then((m) => m.HomeComponent),
  },
  {
    path: "users",
    loadChildren: () => import("./features/users/users.routes").then((m) => m.USERS_ROUTES),
  },
  {
    path: "settings",
    loadComponent: () => import("./features/settings/settings.component").then((m) => m.SettingsComponent),
    canActivate: [authGuard],
  },
  { path: "login", loadComponent: () => import("./features/login/login.component").then((m) => m.LoginComponent) },
  { path: "**", redirectTo: "" },
];
```

**Functional guards (Angular 15+):**

```typescript
// core/guards/auth.guard.ts
import { inject } from "@angular/core";
import { Router, type CanActivateFn } from "@angular/router";
import { AuthService } from "@core/services/auth.service";

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(["/login"]);
};
```

**Rules:**
- Lazy-load all feature routes via `loadComponent` or `loadChildren`.
- Use functional guards (`CanActivateFn`) — not class-based guards.
- Define child routes in feature-level `*.routes.ts` files.
- Use `createUrlTree` for guard redirects.

---

## 3. Data Fetching & HTTP

### HttpClient with typed responses

```typescript
// core/services/user.service.ts
@Injectable({ providedIn: "root" })
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = "/api/v1/users";

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  getById(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  create(data: CreateUserRequest): Observable<User> {
    return this.http.post<User>(this.apiUrl, data);
  }
}
```

### HTTP Interceptors

```typescript
// core/interceptors/error.interceptor.ts
import { HttpInterceptorFn } from "@angular/common/http";
import { catchError, throwError } from "rxjs";

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401) {
        // redirect to login
      }
      return throwError(() => error);
    }),
  );
};
```

**Rules:**
- Type all HTTP responses: `http.get<User[]>(url)`.
- Use functional interceptors (`HttpInterceptorFn`), not class-based.
- Handle errors in interceptors for cross-cutting concerns (401, 500).
- Handle loading/error states in components.

---

## 4. State Management — Signals & RxJS

### Signals (local & shared state)

```typescript
// Angular 17+ signals
@Injectable({ providedIn: "root" })
export class UIStateService {
  sidebarOpen = signal(true);
  theme = signal<"light" | "dark">("light");

  toggleSidebar() {
    this.sidebarOpen.update((v) => !v);
  }
}
```

### RxJS (async streams, HTTP)

```typescript
// In component — convert Observable to Signal
export class UsersComponent {
  private userService = inject(UserService);

  users = toSignal(this.userService.getUsers(), { initialValue: [] });
  // or use async pipe in template
}
```

### State category decision tree

```
Is it from HTTP? → Service + Observable (or toSignal)
Is it local to one component? → signal()
Is it shared across components? → Injectable service with signals
Is it derived? → computed()
Is it a complex async stream? → RxJS operators
```

{% if state_management %}
**Global state: {{ state_management }}**
{% endif %}

**Rules:**
- Prefer signals over BehaviorSubject for simple state.
- Use `toSignal()` to bridge Observables into signal-based components.
- Use RxJS for complex async flows (debounce, switchMap, combineLatest).
- Never subscribe manually in components — use `async` pipe or `toSignal()`.
- Unsubscribe patterns: `takeUntilDestroyed()` or `DestroyRef`.

---

## 5. Component Patterns

### Template-driven interactions

```typescript
@Component({
  selector: "app-user-list",
  standalone: true,
  imports: [CommonModule, UserCardComponent, SpinnerComponent],
  template: `
    @if (loading()) {
      <app-spinner />
    } @else if (error()) {
      <p class="error">{{ error() }}</p>
    } @else {
      @for (user of users(); track user.id) {
        <app-user-card [user]="user" (selected)="onSelect($event)" />
      } @empty {
        <p>No users found.</p>
      }
    }
  `,
})
export class UserListComponent {
  // ...
}
```

### Built-in control flow (Angular 17+)

- Use `@if` / `@else` instead of `*ngIf`.
- Use `@for` with `track` instead of `*ngFor` with `trackBy`.
- Use `@switch` instead of `[ngSwitch]`.

### Forms — Reactive Forms

```typescript
export class CreateUserComponent {
  private fb = inject(FormBuilder);

  form = this.fb.group({
    name: ["", [Validators.required, Validators.minLength(2)]],
    email: ["", [Validators.required, Validators.email]],
  });

  onSubmit() {
    if (this.form.valid) {
      this.userService.create(this.form.getRawValue()).subscribe();
    }
  }
}
```

**Rules:**
- Use Reactive Forms for all forms. Avoid template-driven forms.
- Validate on submit. Show errors after field is touched.
- Use `getRawValue()` to include disabled fields.

---

## 6. Styling

{% if css_strategy %}
**CSS strategy: {{ css_strategy }}**
{% endif %}

{% if css_strategy == "tailwind" %}
**Rules:**
- Use Tailwind utility classes in component templates.
- Component styles (`styleUrl`) for component-specific overrides only.
- Use `@apply` sparingly — prefer utility classes in template.
{% endif %}

**Default:** Angular components have **view encapsulation** (scoped styles) by default. Use `styleUrl` or inline `styles` per component.

---

## 7. Performance

- **Lazy loading:** All feature routes use `loadComponent` / `loadChildren`.
- **OnPush change detection:** Use `ChangeDetectionStrategy.OnPush` for all components when using signals.
- **`@defer`:** Use for lazy-loading heavy components within a template.
- **`track` in `@for`:** Always provide a track expression for list rendering.
- **Image optimization:** Use `NgOptimizedImage` directive for automatic lazy loading and sizing.
- **Bundle analysis:** Use `ng build --stats-json` + `webpack-bundle-analyzer`.

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
```

---

## 8. Accessibility

{% if accessibility_level %}
**Target: {{ accessibility_level }}**
{% endif %}

**Minimum rules (all levels):**
- Use semantic HTML and ARIA attributes where needed.
- All interactive elements must be keyboard-accessible.
- All images must have `alt` text.
- Form inputs must have associated labels.
- Use Angular CDK a11y utilities (`FocusTrap`, `LiveAnnouncer`).

---

## 9. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Manual subscribe without cleanup | Memory leaks | Use `async` pipe, `toSignal()`, or `takeUntilDestroyed()` |
| NgModules for new components | Outdated pattern | Use standalone components |
| Constructor injection | Verbose, less flexible | Use `inject()` function |
| `*ngIf` / `*ngFor` | Deprecated pattern | Use `@if` / `@for` control flow |
| Not using OnPush | Unnecessary change detection | Enable `ChangeDetectionStrategy.OnPush` |
| Complex logic in templates | Hard to test | Extract to signals or computed |
| Circular dependencies | Build errors | Restructure services, use injection tokens |
| Missing `track` in `@for` | Poor list rendering performance | Always provide track expression |
