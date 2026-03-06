# Framework — Next.js

> This skill defines Next.js-specific patterns for the **{{ name }}** service.
> Rendering: **{{ rendering_strategy }}** | State: **{{ state_management }}** | CSS: **{{ css_strategy }}**
> Read this before building or modifying any UI logic.

---

## 1. Application Bootstrap

```typescript
// app/layout.tsx — Root Layout (Server Component)
import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "{{ name }}",
  description: "{{ name }} service",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```typescript
// app/providers.tsx — Client-side providers
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Error handling (route-level):**

```typescript
// app/error.tsx
"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

```typescript
// app/not-found.tsx
export default function NotFound() {
  return <h1>404 — Page not found</h1>;
}
```

**Rules:**
- Root layout is a Server Component — `Providers` wrapper is a separate `"use client"` component.
- Every route segment can have its own `error.tsx`, `loading.tsx`, `not-found.tsx`.
- `metadata` export for SEO — use `generateMetadata` for dynamic pages.

---

## 2. Routing (App Router)

### File-based routing

```
src/app/
├── page.tsx                → /
├── layout.tsx              → shared layout
├── loading.tsx             → loading UI
├── error.tsx               → error boundary
├── not-found.tsx           → 404
├── users/
│   ├── page.tsx            → /users
│   └── [id]/
│       ├── page.tsx        → /users/:id
│       └── loading.tsx     → loading for this segment
├── settings/
│   └── page.tsx            → /settings
├── login/
│   └── page.tsx            → /login
└── api/
    └── v1/
        └── users/
            └── route.ts    → API route handler
```

### Protected routes (middleware)

```typescript
// middleware.ts (project root)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth-token");
  if (!token && request.nextUrl.pathname.startsWith("/settings")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/settings/:path*", "/admin/:path*"],
};
```

**Rules:**
- Use middleware for auth checks — runs on the edge before any rendering.
- Use route groups `(group)` for layout organization without affecting URL.
- Use `loading.tsx` per route segment for streaming/suspense boundaries.
- All routes in `app/` directory — one source of truth.

---

## 3. Data Fetching

### Server Components (primary pattern)

```typescript
// app/users/page.tsx — Server Component
import { userApi } from "@/services/userApi";

export default async function UsersPage() {
  const users = await userApi.list();
  return <UserList users={users} />;
}
```

### Data access layer

```typescript
// services/userApi.ts
import { cache } from "react";

export const userApi = {
  getById: cache(async (id: string): Promise<User> => {
    const res = await fetch(`${process.env.API_URL}/users/${id}`, {
      next: { tags: [`user-${id}`] },
    });
    if (!res.ok) throw new Error("Failed to fetch user");
    return res.json();
  }),

  list: cache(async (): Promise<User[]> => {
    const res = await fetch(`${process.env.API_URL}/users`, {
      next: { revalidate: 60 },  // ISR: revalidate every 60s
    });
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  }),
};
```

### Client-side data (React Query)

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ["users", "search", query],
    queryFn: () => fetch(`/api/v1/users?q=${query}`).then((r) => r.json()),
    enabled: query.length > 0,
  });
}
```

**Rules:**
- **Server Components:** Fetch data directly. Use `cache()` for request deduplication.
- **Client Components:** Use React Query for interactive data (search, pagination, mutations).
- Use `next: { revalidate: N }` for ISR. Use `next: { tags: [...] }` for on-demand revalidation.
- Never fetch data in Client Components when Server Components can provide it.

---

## 4. Server Actions

```typescript
// app/users/actions.ts
"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function createUser(formData: FormData) {
  const parsed = CreateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await db.user.create({ data: parsed.data });
  revalidateTag("users");
  redirect("/users");
}
```

```typescript
// Usage in Client Component
"use client";

import { createUser } from "./actions";
import { useActionState } from "react";

export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(createUser, null);

  return (
    <form action={formAction}>
      <input name="name" />
      {state?.errors?.name && <span>{state.errors.name}</span>}
      <button type="submit" disabled={isPending}>Create</button>
    </form>
  );
}
```

**Rules:**
- Always validate input with zod in Server Actions — client-side validation is for UX only.
- Use `revalidateTag()` or `revalidatePath()` to invalidate cached data after mutations.
- Server Actions are always POST — they are not accessible via GET.
- Return errors as structured objects, not thrown exceptions.

---

## 5. State Management

{% if state_management %}
**Global state: {{ state_management }}**
{% endif %}

### State category decision tree

```
Is it initial page data? → Server Component (async fetch)
Is it from a mutation? → Server Action + revalidate
Is it client search/filter? → React Query
Is it local to one component? → useState
Is it shared client-only state? → Global store
Is it derived? → Compute inline or useMemo
```

**Rules:**
- Server state: Server Components + fetch cache. No client store duplication.
- Mutations: Server Actions + revalidation. React Query for optimistic updates.
- Client-only state (UI preferences, sidebar): minimal global store.

---

## 6. Styling

{% if css_strategy %}
**CSS strategy: {{ css_strategy }}**
{% endif %}

{% if css_strategy == "tailwind" %}
**Rules:**
- Use Tailwind utility classes directly in JSX.
- Extract repeated patterns to components, not to CSS classes.
- Use `clsx` or `cn` for conditional classes.
- Tailwind works in both Server and Client Components.
{% endif %}
{% if css_strategy == "css_modules" %}
**Rules:**
- One `.module.css` per component, colocated.
- Use camelCase for class names.
- CSS Modules work in both Server and Client Components.
{% endif %}

---

## 7. Performance

- **Server Components:** Default to server rendering — zero client-side JS for static content.
- **Streaming:** Use `loading.tsx` and `<Suspense>` for progressive page loading.
- **Image optimization:** Use `next/image` — automatic lazy loading, responsive sizing, format optimization.
- **Code splitting:** Automatic per-route. Use `dynamic()` for heavy client components.
- **ISR:** Use `revalidate` for incremental static regeneration.
- **Parallel routes:** Use `@folder` convention for parallel data fetching.
- **Prefetching:** `<Link>` automatically prefetches routes in viewport.

```typescript
import dynamic from "next/dynamic";

const HeavyChart = dynamic(() => import("@/components/HeavyChart"), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});
```

---

## 8. Accessibility

{% if accessibility_level %}
**Target: {{ accessibility_level }}**
{% endif %}

**Minimum rules (all levels):**
- Use semantic HTML (`button`, `nav`, `main`, `form`).
- All interactive elements must be keyboard-accessible.
- All `next/image` must have `alt` text.
- Form inputs must have associated labels.
- Color must not be the only way to convey information.

---

## 9. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| `"use client"` at page level | Entire page becomes client bundle | Push client boundary to leaf components |
| Importing server code in client | Build error or data leak | Use `server-only` package to enforce |
| Not handling `loading.tsx` | Blank screen during data fetch | Add `loading.tsx` per route segment |
| Fetching in client when server works | Unnecessary API calls, larger bundle | Use Server Components for initial data |
| Missing input validation in Server Actions | Security vulnerability | Always validate with zod server-side |
| Using `router.push` in Server Components | Server Components have no router | Use `redirect()` from `next/navigation` |
| Stale data after mutation | Cache not invalidated | Use `revalidateTag()` / `revalidatePath()` |
| Large `layout.tsx` providers | Re-renders entire subtree | Keep providers minimal, split by concern |
