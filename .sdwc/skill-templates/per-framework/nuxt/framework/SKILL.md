# Framework — Nuxt

> This skill defines Nuxt-specific patterns for the **{{ name }}** service.
> Rendering: **{{ rendering_strategy }}** | State: **{{ state_management }}** | CSS: **{{ css_strategy }}**
> Read this before building or modifying any UI logic.

---

## 1. Application Bootstrap

```vue
<!-- app/app.vue — Root Component -->
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

**Plugins (for global setup):**

```typescript
// plugins/vue-query.ts
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";

export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = new QueryClient();
  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient });
});
```

**Error handling:**

```vue
<!-- error.vue (root level) -->
<script setup lang="ts">
const props = defineProps<{ error: { statusCode: number; message: string } }>();

function handleClear() {
  clearError({ redirect: "/" });
}
</script>

<template>
  <div>
    <h1>{{ error.statusCode }}</h1>
    <p>{{ error.message }}</p>
    <button @click="handleClear">Go Home</button>
  </div>
</template>
```

**`nuxt.config.ts` essentials:**

```typescript
export default defineNuxtConfig({
  devtools: { enabled: true },
  typescript: { strict: true },
  modules: ["@pinia/nuxt"],
});
```

---

## 2. Routing & Middleware

### File-based routing

```
pages/
├── index.vue               → /
├── users/
│   ├── index.vue            → /users
│   └── [id].vue             → /users/:id
├── settings.vue             → /settings
└── login.vue                → /login
```

### Route middleware

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated.value && to.path !== "/login") {
    return navigateTo("/login");
  }
});
```

```vue
<!-- pages/settings.vue — apply middleware -->
<script setup lang="ts">
definePageMeta({
  middleware: "auth",
  layout: "dashboard",
});
</script>
```

**Rules:**
- Use `definePageMeta` for route-level config (middleware, layout, keepalive).
- Named middleware in `middleware/` directory. Inline middleware for one-off cases.
- Use `navigateTo()` for programmatic navigation (SSR-safe, unlike `router.push`).

---

## 3. Data Fetching

### `useFetch` — primary pattern for page data

```vue
<script setup lang="ts">
const { data: users, status, error, refresh } = await useFetch("/api/v1/users");
</script>

<template>
  <div v-if="status === 'pending'"><LoadingSpinner /></div>
  <div v-else-if="error"><ErrorMessage :error="error" /></div>
  <UserList v-else :users="users!" />
</template>
```

### `useAsyncData` — for custom data fetching logic

```vue
<script setup lang="ts">
const { data: user } = await useAsyncData(
  `user-${route.params.id}`,
  () => $fetch(`/api/v1/users/${route.params.id}`)
);
</script>
```

### Lazy fetching (client-only)

```vue
<script setup lang="ts">
// Does not block navigation — fetches on client
const { data, status } = useLazyFetch("/api/v1/dashboard/stats");
</script>
```

**Rules:**
- `useFetch` / `useAsyncData` for SSR-compatible data fetching. They deduplicate between server and client.
- Use `useLazyFetch` for non-blocking, client-only fetches.
- Always provide a unique key to `useAsyncData` for proper caching.
- Handle `pending`, `error`, and `success` states in the template.
- Use `refresh()` to re-fetch data on demand.

---

## 4. Server Routes (Nitro)

```typescript
// server/api/v1/users/index.get.ts
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const users = await db.user.findMany({ take: Number(query.limit) || 20 });
  return users;
});

// server/api/v1/users/index.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  // Validate with zod
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, data: parsed.error.flatten() });
  }
  return await db.user.create({ data: parsed.data });
});

// server/api/v1/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw createError({ statusCode: 404, message: "User not found" });
  return user;
});
```

**Server middleware:**

```typescript
// server/middleware/log.ts
export default defineEventHandler((event) => {
  console.log(`${event.method} ${getRequestURL(event)}`);
});
```

**Rules:**
- File name encodes HTTP method: `index.get.ts`, `index.post.ts`, `[id].delete.ts`.
- Always validate request body with zod.
- Use `createError()` for HTTP error responses.
- Server utils in `server/utils/` are auto-imported in server routes.

---

## 5. State Management

{% if state_management %}
**Global state: {{ state_management }}**
{% endif %}

### State category decision tree

```
Is it page data? → useFetch / useAsyncData
Is it from a mutation? → $fetch + refresh
Is it local to one component? → ref() / reactive()
Is it shared across components? → Pinia store
Is it derived? → computed()
```

**Pinia store with Nuxt:**

```typescript
// stores/user.ts
export const useUserStore = defineStore("user", () => {
  const currentUser = ref<User | null>(null);
  const isAuthenticated = computed(() => currentUser.value !== null);

  function setUser(user: User) { currentUser.value = user; }
  function logout() { currentUser.value = null; }

  return { currentUser, isAuthenticated, setUser, logout };
});
```

**Rules:**
- Use `useFetch` / `useAsyncData` for server state — not Pinia.
- Pinia for client-only shared state: auth, UI preferences.
- Pinia stores are auto-imported with `@pinia/nuxt` module.
- Use `useState` (Nuxt) for SSR-safe shared state that needs to transfer from server to client.

---

## 6. Styling

{% if css_strategy %}
**CSS strategy: {{ css_strategy }}**
{% endif %}

{% if css_strategy == "tailwind" %}
**Rules:**
- Install `@nuxtjs/tailwindcss` module.
- Use Tailwind utility classes directly in templates.
- Extract repeated patterns to components, not to CSS classes.
{% endif %}

**Default: `<style scoped>` is scoped by default in `.vue` files.**

---

## 7. Performance

- **Auto code-splitting:** Nuxt splits by route automatically.
- **Prefetching:** `<NuxtLink>` prefetches routes in viewport.
- **SSR payloads:** Data fetched with `useFetch` is serialized to client — no duplicate requests.
- **`useLazyFetch`:** Use for non-critical data to avoid blocking navigation.
- **Image optimization:** Use `<NuxtImg>` from `@nuxt/image`.
- **Component islands:** Use `<NuxtIsland>` for server-only rendering of heavy components.
- **Payload extraction:** Nuxt extracts payloads for prerendered routes automatically.

---

## 8. Accessibility

{% if accessibility_level %}
**Target: {{ accessibility_level }}**
{% endif %}

**Minimum rules (all levels):**
- Use semantic HTML.
- All interactive elements must be keyboard-accessible.
- All images must have `alt` text.
- Form inputs must have associated labels.
- Color must not be the only way to convey information.

---

## 9. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Using `$fetch` without `useFetch` in setup | Duplicate fetches (server + client) | Use `useFetch` for SSR-safe fetching |
| Calling composables outside `<script setup>` | Nuxt context not available | Call in setup or use `callWithNuxt()` |
| Not awaiting `useFetch` in SSR | Renders without data, then re-fetches | Always `await useFetch(...)` in `<script setup>` |
| Modifying `data` from `useFetch` directly | Can break reactivity / caching | Use `transform` option or copy to local ref |
| `router.push` in server context | Crashes on server | Use `navigateTo()` (SSR-safe) |
| Missing `definePageMeta` | Middleware/layout not applied | Always declare route metadata |
| Not handling hydration mismatch | Console warnings, broken UI | Ensure server and client render same content |
| Forgetting Nitro auto-imports | `defineEventHandler` not found | `server/utils/` and Nitro utils are auto-imported |
