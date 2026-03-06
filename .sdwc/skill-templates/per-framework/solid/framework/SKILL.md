# Framework — Solid

> This skill defines SolidJS-specific patterns for the **{{ name }}** service.
> Rendering: **{{ rendering_strategy }}** | State: **{{ state_management }}** | CSS: **{{ css_strategy }}**
> Read this before building or modifying any UI logic.

---

## 1. Application Bootstrap

```typescript
// index.tsx
import { render } from "solid-js/web";
import { Router } from "@solidjs/router";
import App from "./app/App";

render(
  () => (
    <Router>
      <App />
    </Router>
  ),
  document.getElementById("root")!,
);
```

```typescript
// app/App.tsx
import { QueryClientProvider, QueryClient } from "@tanstack/solid-query";
import { AuthProvider } from "@/primitives/createAuth";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Routes rendered here */}
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

**Error boundary:**

```typescript
import { ErrorBoundary } from "solid-js";

<ErrorBoundary fallback={(err) => <ErrorPage error={err} />}>
  <AppRoutes />
</ErrorBoundary>
```

---

## 2. Routing

```typescript
// app/router.tsx
import { Route, Router } from "@solidjs/router";
import { lazy } from "solid-js";

const HomePage = lazy(() => import("@/pages/Home"));
const UsersPage = lazy(() => import("@/pages/Users"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const LoginPage = lazy(() => import("@/pages/Login"));

export function AppRoutes() {
  return (
    <>
      <Route path="/" component={HomePage} />
      <Route path="/users" component={UsersPage} />
      <Route path="/users/:id" component={lazy(() => import("@/pages/UserDetail"))} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/login" component={LoginPage} />
    </>
  );
}
```

**Protected routes:**

```typescript
function ProtectedRoute(props: { children: JSX.Element }) {
  const auth = useAuth();
  const navigate = useNavigate();

  createEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login", { replace: true });
    }
  });

  return <Show when={auth.isAuthenticated()}>{props.children}</Show>;
}
```

**Rules:**
- Use `lazy()` for code splitting — Solid's equivalent of React.lazy.
- Define all routes in a central router file.
- Use `useNavigate()` for programmatic navigation.
- Use `useParams()` for dynamic route parameters.

---

## 3. Reactivity System

### Core primitives

```typescript
// Signal — reactive value
const [count, setCount] = createSignal(0);
count();          // read (tracks dependency)
setCount(5);      // write
setCount(c => c + 1);  // update

// Memo — derived value (cached)
const doubled = createMemo(() => count() * 2);

// Effect — side effect
createEffect(() => {
  console.log("Count changed:", count());
  // Auto-tracks all signal reads inside
});
```

### Critical reactivity rules

1. **Signal reads are tracked only inside reactive contexts** (JSX, `createEffect`, `createMemo`).
2. **Component body runs once.** Reactivity happens through signal reads in JSX.
3. **Never destructure props** — it breaks tracking. Use `props.field`.
4. **Use `splitProps()`** to separate props you consume from those you forward.

```typescript
import { splitProps } from "solid-js";

function Button(props: ButtonProps & JSX.HTMLAttributes<HTMLButtonElement>) {
  const [local, rest] = splitProps(props, ["variant", "children"]);
  return <button class={local.variant} {...rest}>{local.children}</button>;
}
```

---

## 4. Data Fetching

### createResource (built-in)

```typescript
import { createResource, Suspense } from "solid-js";

const [user, { refetch }] = createResource(
  () => params.id,           // source signal
  (id) => userApi.getById(id),  // fetcher
);

// In JSX
<Suspense fallback={<Spinner />}>
  <Show when={user()} fallback={<div>No user</div>}>
    {(u) => <UserProfile user={u()} />}
  </Show>
</Suspense>
```

### Solid Query (for complex cases)

```typescript
import { createQuery, createMutation } from "@tanstack/solid-query";

function useUser(id: () => string) {
  return createQuery(() => ({
    queryKey: ["users", id()],
    queryFn: () => userApi.getById(id()),
  }));
}

function useCreateUser() {
  const queryClient = useQueryClient();
  return createMutation(() => ({
    mutationFn: userApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  }));
}
```

**Rules:**
- `createResource` for simple fetch-on-mount patterns.
- Solid Query for complex caching, mutations, invalidation.
- Wrap data-fetching components in `<Suspense>` for loading states.
- Handle error states with `<ErrorBoundary>` or `<Show when={!query.error}>`.

---

## 5. State Management

{% if state_management %}
**Global state: {{ state_management }}**
{% endif %}

### State category decision tree

```
Is it from an API? → createResource or Solid Query
Is it local to one component? → createSignal
Is it shared across components? → createStore + Context
Is it derived? → createMemo
```

### Stores for complex shared state

```typescript
import { createStore } from "solid-js/store";

const [state, setState] = createStore({
  user: null as User | null,
  preferences: { theme: "light" as "light" | "dark" },
});

// Nested updates — fine-grained reactivity
setState("preferences", "theme", "dark");
setState("user", { id: "1", name: "Alice" });
```

### Context for dependency injection

```typescript
const AuthContext = createContext<AuthStore>();

export function AuthProvider(props: { children: JSX.Element }) {
  const [state, setState] = createStore({ user: null, isAuthenticated: false });
  const store = { state, login: (u: User) => setState({ user: u, isAuthenticated: true }) };
  return <AuthContext.Provider value={store}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

**Rules:**
- `createSignal` for primitives, `createStore` for objects/arrays.
- Stores enable fine-grained reactivity on nested properties.
- Use Context for DI — not for global state that could be a module-level store.

---

## 6. Control Flow Components

```typescript
// Conditional rendering
<Show when={user()} fallback={<Spinner />}>
  {(u) => <UserProfile user={u()} />}
</Show>

// List rendering (keyed, optimized)
<For each={users()}>
  {(user) => <UserCard user={user} />}
</For>

// Index-based list (for primitives)
<Index each={items()}>
  {(item, index) => <li>{index}: {item()}</li>}
</Index>

// Switch/Match
<Switch fallback={<DefaultView />}>
  <Match when={status() === "loading"}><Spinner /></Match>
  <Match when={status() === "error"}><ErrorView /></Match>
  <Match when={status() === "success"}><SuccessView /></Match>
</Switch>
```

**Rules:**
- **Always use `<For>`** for lists — it tracks items by reference, not index.
- Use `<Index>` only for primitive arrays where items change value but not identity.
- Use `<Show>` with callback form `{(item) => ...}` to narrow types.
- Use `<Switch>`/`<Match>` for multi-branch conditions.

---

## 7. Styling

{% if css_strategy %}
**CSS strategy: {{ css_strategy }}**
{% endif %}

{% if css_strategy == "tailwind" %}
**Rules:**
- Use Tailwind utility classes directly in JSX.
- Use `classList` for conditional classes.

```typescript
<button classList={{ "bg-blue-500 text-white": isActive(), "bg-gray-200": !isActive() }}>
  {label}
</button>
```
{% endif %}
{% if css_strategy == "css_modules" %}
**Rules:**
- Import CSS modules: `import styles from "./Component.module.css"`.
- Use `class={styles.className}` in JSX.
{% endif %}

---

## 8. Performance

Solid is inherently performant due to fine-grained reactivity (no VDOM diffing).

- **No unnecessary re-renders:** Only signal-reading DOM nodes update.
- **`lazy()`:** Use for route-level code splitting.
- **`<Suspense>`:** Use for async boundaries — enables streaming SSR.
- **`batch()`:** Group multiple signal writes to avoid intermediate updates.
- **`untrack()`:** Read signals without creating dependencies.
- **`<For>` over `.map()`:** `<For>` reuses DOM nodes; `.map()` recreates them.

---

## 9. Accessibility

{% if accessibility_level %}
**Target: {{ accessibility_level }}**
{% endif %}

**Minimum rules (all levels):**
- Use semantic HTML.
- All interactive elements must be keyboard-accessible.
- All images must have `alt` text.
- Form inputs must have associated labels.

---

## 10. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Destructuring props | Breaks reactivity tracking | Use `props.field` or `splitProps()` |
| Forgetting `()` on signals | Value never reads/updates | Always call: `count()` not `count` |
| Using `.map()` for lists | Recreates DOM on every update | Use `<For each={...}>` |
| `createEffect` for derived values | Side effect when memo suffices | Use `createMemo()` |
| React mental model | Components re-run on every render | Components run once; only signals update |
| Accessing resource before loaded | Undefined value | Use `<Show when={resource()}>` |
| Mutating store directly | Bypasses reactivity | Use `setState()` / `produce()` |
| Missing `<Suspense>` | Unhandled loading states | Wrap async components in `<Suspense>` |
