# Framework — Vue

> This skill defines Vue-specific patterns for the **{{ name }}** service.
> Rendering: **{{ rendering_strategy }}** | State: **{{ state_management }}** | CSS: **{{ css_strategy }}**
> Read this before building or modifying any UI logic.

---

## 1. Application Bootstrap

```typescript
// main.ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import App from "./app/App.vue";
import { router } from "./app/router";

const app = createApp(App);

app.use(createPinia());       // 1. State management
app.use(VueQueryPlugin);      // 2. Data fetching
app.use(router);              // 3. Routing

app.config.errorHandler = (err, instance, info) => {
  console.error("Global error:", err, info);
  // report to error tracking service
};

app.mount("#app");
```

**Plugin registration order:** Pinia → Vue Query → Router → other plugins.

**Global error handler:** Register `app.config.errorHandler` to catch unhandled errors in components.

---

## 2. Routing

```typescript
// app/router.ts
import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: () => import("@/pages/Layout.vue"),
      children: [
        { path: "", component: () => import("@/pages/Home/index.vue") },
        { path: "users", component: () => import("@/pages/Users/index.vue") },
        { path: "users/:id", component: () => import("@/pages/UserDetail/index.vue") },
        {
          path: "settings",
          component: () => import("@/pages/Settings/index.vue"),
          meta: { requiresAuth: true },
        },
      ],
    },
    { path: "/login", component: () => import("@/pages/Login/index.vue") },
  ],
});

export { router };
```

**Navigation guards for auth:**

```typescript
router.beforeEach((to, from) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }
});
```

**Rules:**
- Define all routes in `app/router.ts` — one source of truth.
- Use lazy imports (`() => import(...)`) for all page components.
- Use `meta` fields for route-level metadata (auth, roles, breadcrumbs).
- Use layout routes via nested `<RouterView>`.

---

## 3. Data Fetching

**Use Vue Query (`@tanstack/vue-query`) for all server state.** Do not store API data in Pinia.

```typescript
// services/userApi.ts
export const userApi = {
  getById: (id: string) =>
    fetch(`/api/v1/users/${id}`).then((r) => r.json()) as Promise<User>,

  list: (params: UserListParams) =>
    fetch(`/api/v1/users?${new URLSearchParams(params)}`).then((r) => r.json()),

  create: (data: CreateUserRequest) =>
    fetch("/api/v1/users", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    }).then((r) => r.json()),
};

// composables/useUser.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";

export function useUser(id: MaybeRef<string>) {
  const resolvedId = toRef(id);
  return useQuery({
    queryKey: ["users", resolvedId],
    queryFn: () => userApi.getById(resolvedId.value),
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
- API functions in `services/`. Composables in `composables/`. Components call composables only.
- Query keys: `[resource, ...identifiers]` — use `Ref` for reactive identifiers.
- Invalidate related queries on mutation success.
- Handle loading/error states in every component that fetches data.

---

## 4. State Management

{% if state_management %}
**Global state: {{ state_management }}**
{% endif %}

### State category decision tree

```
Is it from an API?  → Vue Query (server state)
Is it local to one component? → ref() / reactive()
Is it shared across unrelated components? → Pinia store
Is it derived from other state? → computed()
```

**Pinia store pattern:**

```typescript
// stores/user.ts
import { defineStore } from "pinia";

export const useUserStore = defineStore("user", () => {
  // Use setup syntax (Composition API style)
  const currentUser = ref<User | null>(null);
  const isAuthenticated = computed(() => currentUser.value !== null);

  function setUser(user: User) {
    currentUser.value = user;
  }

  function logout() {
    currentUser.value = null;
  }

  return { currentUser, isAuthenticated, setUser, logout };
});
```

**Rules:**
- Use Pinia setup syntax (`defineStore` with function) — consistent with Composition API.
- Never duplicate server data in Pinia. Vue Query IS the cache.
- Pinia is for client-only state: UI preferences, auth status, wizard step.
- Keep stores small and focused — one store per domain concern.

---

## 5. Component Patterns

### Template syntax rules

```vue
<template>
  <!-- ✅ v-bind shorthand -->
  <UserCard :user="user" :is-highlighted="isActive" @select="handleSelect" />

  <!-- ✅ v-for with key -->
  <li v-for="item in items" :key="item.id">{{ item.name }}</li>

  <!-- ✅ v-if/v-else on separate elements -->
  <LoadingSpinner v-if="isLoading" />
  <ErrorMessage v-else-if="error" :error="error" />
  <UserList v-else :users="data" />
</template>
```

### Form handling

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";

const schema = toTypedSchema(z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
}));

const { handleSubmit, errors, defineField } = useForm({ validationSchema: schema });
const [name, nameAttrs] = defineField("name");
const [email, emailAttrs] = defineField("email");

const createUser = useCreateUser();
const onSubmit = handleSubmit((values) => createUser.mutate(values));
</script>

<template>
  <form @submit.prevent="onSubmit">
    <input v-model="name" v-bind="nameAttrs" />
    <span v-if="errors.name">{{ errors.name }}</span>
    <button type="submit" :disabled="createUser.isPending.value">Create</button>
  </form>
</template>
```

### v-model pattern

```vue
<!-- Parent -->
<SearchInput v-model="searchQuery" />

<!-- Child: SearchInput.vue -->
<script setup lang="ts">
const model = defineModel<string>();
</script>
<template>
  <input :value="model" @input="model = ($event.target as HTMLInputElement).value" />
</template>
```

---

## 6. Styling

{% if css_strategy %}
**CSS strategy: {{ css_strategy }}**
{% endif %}

{% if css_strategy == "tailwind" %}
**Rules:**
- Use Tailwind utility classes directly in templates.
- Extract repeated patterns to components, not to CSS classes.
- Use dynamic classes with array syntax or computed.

```vue
<template>
  <button :class="['px-4 py-2 rounded', isActive ? 'bg-blue-500 text-white' : 'bg-gray-200']">
    {{ label }}
  </button>
</template>
```
{% endif %}
{% if css_strategy == "css_modules" %}
**Rules:**
- Use `<style module>` for CSS modules in SFCs.
- Access classes via `$style.className` in template.
- No global CSS except for resets and CSS custom properties.
{% endif %}

**Default: `<style scoped>`** — Always use scoped styles in SFCs unless using Tailwind or CSS modules.

---

## 7. Performance

- **Lazy loading:** Use dynamic imports for route components.
- **`v-once`:** Use for content that never changes after initial render.
- **`v-memo`:** Use for expensive list items that rarely update.
- **`shallowRef` / `shallowReactive`:** Use for large data structures where deep reactivity is unnecessary.
- **`<KeepAlive>`:** Use for tabs/routes where re-mounting is expensive.
- **List rendering:** Always provide `:key`. Virtualize lists over 100 items (`@tanstack/vue-virtual`).

---

## 8. Accessibility

{% if accessibility_level %}
**Target: {{ accessibility_level }}**
{% endif %}

**Minimum rules (all levels):**
- Use semantic HTML (`button`, `nav`, `main`, `form`) — not `div` with `@click`.
- All interactive elements must be keyboard-accessible.
- All images must have `alt` text.
- Form inputs must have associated labels.
- Color must not be the only way to convey information.

---

## 9. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Destructuring `reactive()` | Loses reactivity | Use `ref()` or `toRefs()` |
| Mutating props directly | Vue warning, data flow breaks | Emit events, use `v-model` |
| Missing `:key` in `v-for` | Incorrect DOM reuse | Always use stable unique ID |
| `watch` for derived state | Unnecessary complexity | Use `computed()` |
| Storing server data in Pinia | Stale data, cache duplication | Use Vue Query for server state |
| Options API in new code | Inconsistent codebase | Use `<script setup>` Composition API |
| Deeply nested provide/inject | Hard to trace data flow | Use Pinia stores for shared state |
| Missing cleanup in composables | Memory leaks | Use `onUnmounted` or `watchEffect` auto-cleanup |
