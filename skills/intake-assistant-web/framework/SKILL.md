# Framework — React

> This skill defines React-specific patterns for the **intake-assistant-web** service.
> Rendering: **spa** | State: **zustand** | CSS: **tailwind**
> Read this before building or modifying any UI logic.

---

## 1. Application Bootstrap

```typescript
// app/App.tsx
import { Providers } from "./providers";
import { AppRouter } from "./router";

export function App() {
  return (
    <Providers>
      <AppRouter />
    </Providers>
  );
}
```

**Provider nesting order** (outermost → innermost):

```typescript
// app/providers.tsx
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>  {/* 1. Data fetching */}
      <AuthProvider>                             {/* 2. Auth context */}
        <ThemeProvider>                          {/* 3. Theme/UI */}
          {children}
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

**Error boundary:** Wrap the app root in an error boundary to catch render errors gracefully.

```typescript
<ErrorBoundary fallback={<ErrorPage />}>
  <AppRouter />
</ErrorBoundary>
```

---

## 2. Routing

```typescript
// app/router.tsx
import { createBrowserRouter, RouterProvider } from "react-router-dom";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "users", element: <UsersPage /> },
      { path: "users/:id", element: <UserDetailPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  { path: "/login", element: <LoginPage /> },
]);
```

**Protected routes:**

```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
}

// Usage
{ path: "settings", element: <ProtectedRoute><SettingsPage /></ProtectedRoute> }
```

**Rules:**
- Define all routes in `app/router.tsx` — one source of truth.
- Use layout routes for shared layouts (sidebar, header).
- Lazy-load pages that are not on the critical path.

---

## 3. Data Fetching

**Use React Query for all server state.** Do not store API data in global state.

```typescript
// services/userApi.ts
export const userApi = {
  getById: (id: string) =>
    fetch(`/api/v1/users/${id}`).then((r) => r.json()) as Promise<User>,

  list: (params: UserListParams) =>
    fetch(`/api/v1/users?${new URLSearchParams(params)}`).then((r) => r.json()),

  create: (data: CreateUserRequest) =>
    fetch("/api/v1/users", { method: "POST", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } }).then((r) => r.json()),
};

// hooks/useUser.ts
export function useUser(id: string) {
  return useQuery({
    queryKey: ["users", id],
    queryFn: () => userApi.getById(id),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
```

**Rules:**
- API functions in `services/`. Hooks in `hooks/`. Components call hooks only.
- Query keys: `[resource, ...identifiers]` (e.g., `["users", userId]`).
- Invalidate related queries on mutation success.
- Handle loading/error states in every component that fetches data.

---

## 4. State Management

**Global state: zustand**

### State category decision tree

```
Is it from an API?  → React Query (server state)
Is it local to one component? → useState
Is it shared across unrelated components? → Global store
Is it derived from other state? → Compute inline or useMemo
```

**Rules:**
- Never duplicate server data in global state. React Query IS the cache.
- Global store is for client-only state: UI preferences, sidebar open/closed, wizard step.
- Keep global store slices small and focused.

```typescript
// stores/uiStore.ts
import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
```

---

## 5. Component Patterns

### Composition over config

```typescript
// ✅ Composition — flexible, testable
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>{content}</Card.Body>
</Card>

// ❌ Config props — rigid, hard to extend
<Card title="Title" body={content} showFooter={true} footerAlign="right" />
```

### Form handling

```typescript
// Use a form library for complex forms (react-hook-form recommended)
import { useForm } from "react-hook-form";

function CreateUserForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateUserRequest>();
  const createUser = useCreateUser();

  const onSubmit = (data: CreateUserRequest) => createUser.mutate(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("name", { required: "Name is required" })} />
      {errors.name && <span>{errors.name.message}</span>}
      <button type="submit" disabled={createUser.isPending}>Create</button>
    </form>
  );
}
```

### Loading & error states

Every component that fetches data must handle three states:

```typescript
function UserPage() {
  const { data, isLoading, error } = useUser(userId);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <UserProfile user={data} />;
}
```

---

## 6. Styling

**CSS strategy: tailwind**

**Rules:**
- Use Tailwind utility classes directly in JSX.
- Extract repeated patterns to components, not to CSS classes.
- Use `clsx` or `cn` for conditional classes.

```typescript
import { clsx } from "clsx";

<button className={clsx("px-4 py-2 rounded", isActive && "bg-blue-500 text-white", !isActive && "bg-gray-200")}>
```

---

## 7. Performance

- **Lazy loading:** Use `React.lazy()` for route-level code splitting.
- **Memoization:** Use `useMemo` / `useCallback` only when there's a measured performance problem. Don't pre-optimize.
- **List rendering:** Use stable keys. Virtualize lists over 100 items (`@tanstack/react-virtual`).
- **Images:** Use lazy loading (`loading="lazy"`) and appropriate sizes.
- **Re-renders:** Avoid creating new objects/arrays in render. Extract to constants or `useMemo`.

---

## 8. Accessibility


**Minimum rules (all levels):**
- Use semantic HTML (`button`, `nav`, `main`, `form`) — not `div` with onClick.
- All interactive elements must be keyboard-accessible.
- All images must have `alt` text.
- Form inputs must have associated labels.
- Color must not be the only way to convey information.

---

## 9. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| State update after unmount | Memory leak warning | Use cleanup in useEffect, or abort controllers |
| Stale closure in useEffect | Handler uses outdated state | Add correct dependencies, or use ref |
| Prop drilling 3+ levels | Tight coupling | Use composition, context, or global store |
| Uncontrolled → controlled | React warning on input | Choose one pattern and be consistent |
| Missing error boundaries | White screen on error | Wrap route segments in ErrorBoundary |
| Fetching without cancellation | Race conditions | Use React Query (handles this automatically) |
