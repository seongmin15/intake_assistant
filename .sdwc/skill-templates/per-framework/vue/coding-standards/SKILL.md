# Coding Standards — Vue

> This skill defines coding rules for the **{{ name }}** service (Vue / TypeScript).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── app/                      ← app root (App.vue, router, plugins)
│   │   ├── App.vue
│   │   ├── router.ts
│   │   └── plugins/
│   ├── pages/                    ← page-level components (one per route)
│   │   └── {PageName}/
│   │       ├── index.vue
│   │       ├── components/       ← page-scoped components
│   │       └── composables/      ← page-scoped composables
│   ├── components/               ← shared/reusable components
│   │   └── {ComponentName}/
│   │       ├── {ComponentName}.vue
│   │       └── {ComponentName}.test.ts
│   ├── composables/              ← shared composables (use* functions)
│   ├── services/                 ← API call functions
│   │   └── {resource}Api.ts
│   ├── stores/                   ← Pinia stores
│   │   └── {resource}.ts
│   ├── types/                    ← shared TypeScript types
│   ├── utils/                    ← pure utility functions
│   └── constants/                ← app-wide constants
├── tests/
│   ├── e2e/
│   └── setup.ts
├── public/
├── package.json
└── tsconfig.json
```

**Rules:**
- One component per `.vue` file. File name matches component name (PascalCase).
- Use `<script setup lang="ts">` for all components — Composition API only, no Options API.
- Colocate tests with components.
- Page-scoped composables stay in the page folder. Promote to `src/composables/` only when shared by 2+ pages.
- `services/` contains only API call functions — no UI logic, no state management.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `UserProfile.vue` |
| Composables | camelCase with `use` prefix | `useAuth.ts`, `useUserList.ts` |
| Pinia stores | camelCase with `use` + `Store` suffix | `useUserStore.ts` |
| Utility functions | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `User`, `CreateUserRequest` |
| Constants | UPPER_SNAKE | `MAX_PAGE_SIZE` |
| Props/emits | camelCase in script, kebab-case in template | `userName` / `user-name` |
| Event emits | kebab-case verb | `update:modelValue`, `item-selected` |

**Component file naming:**
- Component: `UserProfile.vue`
- Composable: `useUserProfile.ts`
- Store: `useUserStore.ts`
- Type: `userProfile.types.ts`
- Test: `UserProfile.test.ts`

---

## 3. TypeScript Rules

**Rule: strict mode enabled.** No `any` unless absolutely unavoidable (and documented).

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

**Props typing with `defineProps`:**

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

**Emits typing with `defineEmits`:**

```vue
<script setup lang="ts">
const emit = defineEmits<{
  select: [userId: string];
  "update:modelValue": [value: string];
}>();
</script>
```

**Rules:**
- Use `interface` for object shapes, `type` for unions and intersections.
- Export shared types from `types/`. Colocate component-specific types in the `.vue` file or a sibling `.types.ts`.
- API response types live in `services/`.

---

## 4. Import Order

Group imports in this order, separated by blank lines:

```typescript
// 1. Vue core
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

// 2. Third-party libraries
import { useQuery } from "@tanstack/vue-query";

// 3. Internal — absolute path from src/
import { useAuth } from "@/composables/useAuth";
import { userApi } from "@/services/userApi";
import { useUserStore } from "@/stores/user";

// 4. Relative — local to current module
import UserCard from "./components/UserCard.vue";
import type { UserListProps } from "./types";
```

**Rules:**
- Use path aliases (`@/` = `src/`) for all non-relative imports.
- Separate `import type` from value imports.
- Vue component imports use default import (SFC convention).

---

## 5. Component Patterns

### Single File Components with `<script setup>`

```vue
<script setup lang="ts">
// All composition logic here
</script>

<template>
  <!-- Template here -->
</template>

<style scoped>
/* Scoped styles here */
</style>
```

**Block order:** `<script setup>` → `<template>` → `<style scoped>`.

### Composables

- Name with `use` prefix. Return reactive state and methods.
- Composables should do one thing — compose multiple composables if needed.

```typescript
// composables/useUser.ts
export function useUser(id: MaybeRef<string>) {
  const resolvedId = toRef(id);
  return useQuery({
    queryKey: ["users", resolvedId],
    queryFn: () => userApi.getById(resolvedId.value),
  });
}
```

### Reactivity rules

- Use `ref()` for primitives, `reactive()` for complex objects (but prefer `ref` for consistency).
- Never destructure `reactive()` — it loses reactivity. Use `toRefs()` if needed.
- Use `computed()` for derived state. Never use `watch` for synchronous derivations.

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ESLint** | Linter | `eslint.config.js` |
| **Prettier** | Formatter | `.prettierrc` |
| **vue-tsc** | Type checking | `tsconfig.json` |

**Commands:**

```bash
eslint src/ --fix            # lint
prettier --write src/        # format
vue-tsc --noEmit             # type check
```

**Rules:**
- Run lint + format before every commit.
- ESLint plugins: `eslint-plugin-vue`, `@typescript-eslint`.
- Use `eslint-plugin-vue` recommended rules (`plugin:vue/vue3-recommended`).

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Options API in new code | Use `<script setup>` Composition API |
| `any` type | Use proper types or `unknown` with type guard |
| Destructuring `reactive()` | Use `ref()` or `toRefs()` |
| Business logic in components | Extract to composables or services |
| `watch` for derived state | Use `computed()` |
| Direct store mutation from components | Use store actions |
| Mutating props | Emit events to parent, use `v-model` |
| `console.log` in production | Use structured logger (→ skills/common/observability/) |
