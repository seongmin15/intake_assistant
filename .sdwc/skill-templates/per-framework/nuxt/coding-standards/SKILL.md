# Coding Standards — Nuxt

> This skill defines coding rules for the **{{ name }}** service (Nuxt / TypeScript).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── app/                          ← Nuxt app directory
│   ├── app.vue                   ← root component
│   ├── error.vue                 ← error page
│   └── router.options.ts         ← router config overrides
├── pages/                        ← file-based routing
│   ├── index.vue                 ← /
│   ├── users/
│   │   ├── index.vue             ← /users
│   │   └── [id].vue              ← /users/:id
│   └── settings.vue              ← /settings
├── components/                   ← auto-imported components
│   └── {ComponentName}/
│       ├── {ComponentName}.vue
│       └── {ComponentName}.test.ts
├── composables/                  ← auto-imported composables (use*)
│   └── useAuth.ts
├── server/                       ← Nitro server (API routes, middleware)
│   ├── api/
│   │   └── v1/
│   │       └── users/
│   │           ├── index.get.ts
│   │           └── index.post.ts
│   ├── middleware/
│   └── utils/
├── stores/                       ← Pinia stores
│   └── user.ts
├── types/                        ← shared TypeScript types
├── utils/                        ← auto-imported utility functions
├── plugins/                      ← Nuxt plugins
├── middleware/                    ← route middleware
├── layouts/                      ← layout components
│   └── default.vue
├── public/                       ← static assets
├── nuxt.config.ts
└── tsconfig.json
```

**Rules:**
- One component per `.vue` file. File name matches component name (PascalCase).
- Use `<script setup lang="ts">` for all components — Composition API only.
- **Auto-imports are enabled by default.** Components, composables, and utils are auto-imported — no manual import statements needed for these.
- Colocate tests with components.
- Server-side code lives in `server/` — automatically handled by Nitro.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `UserProfile.vue` |
| Pages | kebab-case or index | `users/index.vue`, `[id].vue` |
| Composables | camelCase with `use` prefix | `useAuth.ts` |
| Pinia stores | camelCase with `use` + `Store` suffix | `useUserStore.ts` |
| Server API routes | `{resource}.{method}.ts` | `users.get.ts`, `users.post.ts` |
| Utility functions | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `User`, `CreateUserRequest` |
| Constants | UPPER_SNAKE | `MAX_PAGE_SIZE` |
| Middleware | kebab-case | `auth.ts` |

---

## 3. TypeScript Rules

**Rule: strict mode enabled.** No `any` unless absolutely unavoidable (and documented).

Nuxt auto-generates types. Run `nuxi prepare` to generate `.nuxt/` types.

**Props typing:**

```vue
<script setup lang="ts">
interface UserCardProps {
  user: User;
  isHighlighted?: boolean;
}

const props = withDefaults(defineProps<UserCardProps>(), {
  isHighlighted: false,
});
</script>
```

**Server API route typing:**

```typescript
// server/api/v1/users/index.get.ts
export default defineEventHandler(async (event): Promise<User[]> => {
  // typed return value
  return await db.user.findMany();
});
```

**Rules:**
- Use `interface` for object shapes, `type` for unions and intersections.
- Leverage Nuxt's auto-generated types (`.nuxt/types/`).
- API response types are inferred by `useFetch` / `$fetch` from server routes.

---

## 4. Import Order

Nuxt auto-imports most modules. For explicitly imported items, group in this order:

```typescript
// 1. Vue core (auto-imported, but explicit when needed)
import { ref, computed } from "vue";

// 2. Nuxt composables (auto-imported in most cases)
import { useAsyncData } from "#app";

// 3. Third-party libraries
import { z } from "zod";

// 4. Internal — explicit imports (non-auto-imported)
import type { User } from "~/types/user";

// 5. Relative — local to current module
import UserCard from "./components/UserCard.vue";
```

**Rules:**
- Rely on auto-imports for Vue APIs, Nuxt composables, components, and utils.
- Use `~/` alias (= project root) for explicit imports.
- Separate `import type` from value imports.
- Only import explicitly when auto-import doesn't apply or for clarity.

---

## 5. Component Patterns

### Auto-imported components

```vue
<!-- No import needed — components/ are auto-imported -->
<template>
  <UserCard :user="user" @select="handleSelect" />
  <BaseButton>Click me</BaseButton>
</template>
```

**Nested component naming:** `components/base/Button.vue` → `<BaseButton />`

### Layouts

```vue
<!-- layouts/default.vue -->
<template>
  <nav>...</nav>
  <main><slot /></main>
  <footer>...</footer>
</template>
```

```vue
<!-- pages/settings.vue — using a specific layout -->
<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "auth",
});
</script>
```

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ESLint** | Linter | `eslint.config.js` |
| **Prettier** | Formatter | `.prettierrc` |
| **@nuxt/eslint** | Nuxt-specific rules | via ESLint config |
| **vue-tsc** | Type checking | `tsconfig.json` |

**Commands:**

```bash
eslint . --fix               # lint
prettier --write .           # format
nuxi typecheck               # type check (Nuxt-aware)
```

**Rules:**
- Run lint + format before every commit.
- Use `@nuxt/eslint` for Nuxt + Vue + TypeScript rules in one config.
- `nuxi typecheck` is preferred over `vue-tsc` — it understands Nuxt auto-imports.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Options API in new code | Use `<script setup>` Composition API |
| `any` type | Use proper types or `unknown` |
| Manual imports for auto-imported modules | Let auto-import handle it |
| `$fetch` in lifecycle hooks without `useAsyncData` | Use `useAsyncData` or `useFetch` for SSR |
| Direct API calls in components | Use composables or server routes |
| Mutating props | Emit events, use `v-model` |
| Skipping `definePageMeta` for middleware/layout | Always declare route metadata explicitly |
| `console.log` in production | Use structured logger (→ skills/common/observability/) |
