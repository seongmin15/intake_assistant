# Framework — Svelte

> This skill defines Svelte/SvelteKit-specific patterns for the **{{ name }}** service.
> Rendering: **{{ rendering_strategy }}** | State: **{{ state_management }}** | CSS: **{{ css_strategy }}**
> Read this before building or modifying any UI logic.

---

## 1. Application Bootstrap

SvelteKit uses file-based routing. The app entry point is the root layout.

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { QueryClientProvider, QueryClient } from "@tanstack/svelte-query";
  import { AuthProvider } from "$lib/components/AuthProvider";
  import "../app.css";

  const queryClient = new QueryClient();
  let { children } = $props();
</script>

<QueryClientProvider client={queryClient}>
  <AuthProvider>
    {@render children()}
  </AuthProvider>
</QueryClientProvider>
```

**Error handling:**

```svelte
<!-- src/routes/+error.svelte -->
<script lang="ts">
  import { page } from "$app/stores";
</script>

<h1>{$page.status}</h1>
<p>{$page.error?.message}</p>
```

**`hooks.server.ts` for server-side middleware:**

```typescript
// src/hooks.server.ts
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  // Auth check, logging, etc.
  const session = await getSession(event.cookies);
  event.locals.user = session?.user ?? null;
  return resolve(event);
};
```

---

## 2. Routing & Load Functions

### File-based routing

```
src/routes/
├── +page.svelte              → /
├── +layout.svelte            → shared layout
├── users/
│   ├── +page.svelte          → /users
│   ├── +page.ts              → load data for /users
│   └── [id]/
│       ├── +page.svelte      → /users/:id
│       └── +page.ts          → load data for /users/:id
├── settings/
│   └── +page.svelte          → /settings
└── login/
    └── +page.svelte          → /login
```

### Load functions

```typescript
// src/routes/users/+page.ts
import type { PageLoad } from "./$types";
import { userApi } from "$lib/services/userApi";

export const load: PageLoad = async ({ fetch }) => {
  const users = await userApi.list(fetch);
  return { users };
};
```

```svelte
<!-- src/routes/users/+page.svelte -->
<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

{#each data.users as user}
  <UserCard {user} />
{/each}
```

### Protected routes

```typescript
// src/routes/settings/+page.server.ts
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, "/login");
  }
  return { user: locals.user };
};
```

**Rules:**
- Use `+page.ts` for universal (SSR + client) loads. Use `+page.server.ts` for server-only loads.
- Auth checks go in `+page.server.ts` or `+layout.server.ts`.
- Pass SvelteKit's `fetch` to API functions for SSR/client consistency.
- Use `error()` and `redirect()` helpers from `@sveltejs/kit`.

---

## 3. Data Fetching

**For SvelteKit pages, use `load` functions.** For client-side interactions, use Svelte Query.

```typescript
// lib/services/userApi.ts
export const userApi = {
  getById: (fetchFn: typeof fetch, id: string) =>
    fetchFn(`/api/v1/users/${id}`).then((r) => r.json()) as Promise<User>,

  list: (fetchFn: typeof fetch) =>
    fetchFn("/api/v1/users").then((r) => r.json()) as Promise<User[]>,

  create: (data: CreateUserRequest) =>
    fetch("/api/v1/users", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    }).then((r) => r.json()),
};
```

**Client-side mutations with Svelte Query:**

```typescript
import { createMutation, useQueryClient } from "@tanstack/svelte-query";

const queryClient = useQueryClient();
const createUser = createMutation({
  mutationFn: userApi.create,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
});
```

**Rules:**
- Initial data comes from `load` functions (SSR-friendly).
- Client-side mutations and polling use Svelte Query.
- API functions accept `fetch` parameter for SvelteKit SSR compatibility.
- Handle loading/error states in every component.

---

## 4. State Management

{% if state_management %}
**Global state: {{ state_management }}**
{% endif %}

### State category decision tree

```
Is it page data? → SvelteKit load function
Is it from a mutation? → Svelte Query
Is it local to one component? → $state()
Is it shared across components? → Svelte store (writable/readable)
Is it derived? → $derived() or derived store
```

**Svelte store pattern:**

```typescript
// lib/stores/auth.ts
import { writable, derived } from "svelte/store";

function createAuthStore() {
  const { subscribe, set, update } = writable<User | null>(null);

  return {
    subscribe,
    login: (user: User) => set(user),
    logout: () => set(null),
  };
}

export const authStore = createAuthStore();
export const isAuthenticated = derived(authStore, ($auth) => $auth !== null);
```

**Rules:**
- Use SvelteKit `load` for page data — it handles SSR, streaming, and invalidation.
- Svelte stores for client-only shared state (auth, UI preferences).
- Keep stores small and focused.
- Use `derived` stores for computed values.

---

## 5. Component Patterns

### Slots and snippets

```svelte
<!-- Svelte 5 snippets -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    header: Snippet;
    children: Snippet;
    footer?: Snippet;
  }

  let { header, children, footer }: Props = $props();
</script>

<div class="card">
  <div class="header">{@render header()}</div>
  <div class="body">{@render children()}</div>
  {#if footer}
    <div class="footer">{@render footer()}</div>
  {/if}
</div>
```

### Form handling

```svelte
<script lang="ts">
  import { enhance } from "$app/forms";

  let { form } = $props();
</script>

<!-- SvelteKit form actions (progressive enhancement) -->
<form method="POST" action="?/create" use:enhance>
  <input name="name" required />
  {#if form?.errors?.name}
    <span class="error">{form.errors.name}</span>
  {/if}
  <button type="submit">Create</button>
</form>
```

```typescript
// src/routes/users/+page.server.ts
import type { Actions } from "./$types";
import { fail } from "@sveltejs/kit";

export const actions: Actions = {
  create: async ({ request }) => {
    const data = await request.formData();
    const name = data.get("name");
    if (!name) return fail(400, { errors: { name: "Name is required" } });
    // create user...
    return { success: true };
  },
};
```

**Rules:**
- Use SvelteKit form actions with `use:enhance` for progressive enhancement.
- Server-side validation in form actions. Client-side validation for UX.
- Return `fail()` with error details for validation errors.

---

## 6. Styling

{% if css_strategy %}
**CSS strategy: {{ css_strategy }}**
{% endif %}

{% if css_strategy == "tailwind" %}
**Rules:**
- Use Tailwind utility classes directly in Svelte templates.
- Extract repeated patterns to components, not to CSS classes.
- Use `class:` directive for conditional classes.

```svelte
<button
  class="px-4 py-2 rounded"
  class:bg-blue-500={isActive}
  class:bg-gray-200={!isActive}
>
  {label}
</button>
```
{% endif %}

**Default: `<style>` in `.svelte` files is scoped by default.** No extra configuration needed.

---

## 7. Performance

- **Code splitting:** SvelteKit automatically code-splits by route.
- **Preloading:** Use `data-sveltekit-preload-data` on links for instant navigation.
- **Streaming:** Return promises in `load` to stream non-critical data.
- **SSR vs CSR:** Use `export const ssr = false` only when necessary (e.g., canvas-heavy pages).
- **List rendering:** Use `{#key}` blocks and unique keys in `{#each}`. Virtualize large lists.
- **Image optimization:** Use `@sveltejs/enhanced-img` for automatic optimization.

---

## 8. Accessibility

{% if accessibility_level %}
**Target: {{ accessibility_level }}**
{% endif %}

**Minimum rules (all levels):**
- Use semantic HTML (`button`, `nav`, `main`, `form`) — not `div` with `on:click`.
- All interactive elements must be keyboard-accessible.
- All images must have `alt` text.
- Form inputs must have associated labels.
- Svelte provides compile-time a11y warnings — never ignore them.

---

## 9. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Mixing Svelte 4 and 5 syntax | Inconsistent reactivity model | Choose one version and be consistent |
| `$effect` for derived values | Unnecessary side effects | Use `$derived` |
| Forgetting SvelteKit `fetch` | SSR/client mismatch | Pass `fetch` from `load` to API functions |
| Not using `use:enhance` | Full page reloads on form submit | Add `use:enhance` for progressive enhancement |
| Blocking `load` functions | Slow page transitions | Use promises and streaming for non-critical data |
| Client-side auth checks only | Security bypass via direct URL | Always check auth in `+page.server.ts` |
| Ignoring a11y warnings | Accessibility issues | Treat Svelte a11y warnings as errors |
| Mutating `$page` store | Unexpected behavior | `$page` is read-only; navigate with `goto()` |
