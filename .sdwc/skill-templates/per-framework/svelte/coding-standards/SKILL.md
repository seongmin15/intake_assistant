# Coding Standards — Svelte

> This skill defines coding rules for the **{{ name }}** service (Svelte / TypeScript).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── routes/                   ← SvelteKit file-based routing
│   │   ├── +layout.svelte        ← root layout
│   │   ├── +page.svelte          ← home page
│   │   ├── users/
│   │   │   ├── +page.svelte
│   │   │   ├── +page.ts          ← load function
│   │   │   └── [id]/
│   │   │       ├── +page.svelte
│   │   │       └── +page.ts
│   │   └── settings/
│   │       └── +page.svelte
│   ├── lib/                      ← shared library ($lib alias)
│   │   ├── components/           ← shared/reusable components
│   │   │   └── {ComponentName}/
│   │   │       ├── {ComponentName}.svelte
│   │   │       └── {ComponentName}.test.ts
│   │   ├── services/             ← API call functions
│   │   │   └── {resource}Api.ts
│   │   ├── stores/               ← Svelte stores
│   │   │   └── {resource}.ts
│   │   ├── types/                ← shared TypeScript types
│   │   └── utils/                ← pure utility functions
│   ├── app.html                  ← HTML template
│   └── app.d.ts                  ← global type declarations
├── tests/
│   └── e2e/
├── static/                       ← static assets
├── package.json
├── svelte.config.js
└── tsconfig.json
```

**Rules:**
- One component per `.svelte` file. File name matches component name (PascalCase).
- Use SvelteKit file-based routing (`src/routes/`).
- Shared code lives in `src/lib/` — accessible via `$lib` alias.
- Colocate tests with components in `src/lib/components/`.
- Route-specific components stay in their route folder.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `UserProfile.svelte` |
| Route files | SvelteKit convention | `+page.svelte`, `+layout.svelte` |
| Stores | camelCase | `userStore.ts` |
| Utility functions | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `User`, `CreateUserRequest` |
| Constants | UPPER_SNAKE | `MAX_PAGE_SIZE` |
| Event names | lowercase | `on:click`, `on:select` |
| Props | camelCase | `userName`, `isActive` |

---

## 3. TypeScript Rules

**Rule: strict mode enabled.** No `any` unless absolutely unavoidable (and documented).

**Svelte 5 runes syntax (if using Svelte 5):**

```svelte
<script lang="ts">
  interface Props {
    user: User;
    isHighlighted?: boolean;
  }

  let { user, isHighlighted = false }: Props = $props();
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>
```

**Svelte 4 syntax (if using Svelte 4):**

```svelte
<script lang="ts">
  export let user: User;
  export let isHighlighted: boolean = false;
</script>
```

**Rules:**
- Use `interface` for object shapes, `type` for unions and intersections.
- Export shared types from `$lib/types/`.
- Always declare prop types explicitly.

---

## 4. Import Order

Group imports in this order, separated by blank lines:

```typescript
// 1. Svelte core
import { onMount, onDestroy } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/stores";

// 2. Third-party libraries
import { z } from "zod";

// 3. Internal — $lib alias
import { Button } from "$lib/components/Button";
import { userApi } from "$lib/services/userApi";
import { userStore } from "$lib/stores/user";

// 4. Relative — local to current module
import UserCard from "./UserCard.svelte";
import type { PageData } from "./$types";
```

**Rules:**
- Use `$lib` alias for all shared code imports.
- Use `$app/*` for SvelteKit built-in modules.
- Separate `import type` from value imports.

---

## 5. Component Patterns

### Reactivity

```svelte
<script lang="ts">
  // Svelte 5 runes
  let count = $state(0);
  let doubled = $derived(count * 2);

  $effect(() => {
    console.log("Count changed:", count);
  });

  // Svelte 4 reactive declarations
  // $: doubled = count * 2;
</script>
```

**Rules:**
- Prefer `$derived` over `$effect` for synchronous computations.
- `$effect` is for side effects only (DOM manipulation, logging, external subscriptions).
- Never mutate state inside `$derived`.

### Events and bindings

```svelte
<!-- ✅ Event forwarding -->
<button onclick={() => dispatch("select", user.id)}>Select</button>

<!-- ✅ Two-way binding -->
<input bind:value={searchQuery} />

<!-- ❌ Avoid complex inline handlers -->
<button onclick={() => { doThis(); doThat(); doMore(); }}>Bad</button>
```

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ESLint** | Linter | `eslint.config.js` |
| **Prettier** | Formatter | `.prettierrc` |
| **prettier-plugin-svelte** | Svelte formatting | via Prettier |
| **svelte-check** | Type checking | `tsconfig.json` |

**Commands:**

```bash
eslint src/ --fix            # lint
prettier --write src/        # format
svelte-check                 # type check + Svelte diagnostics
```

**Rules:**
- Run lint + format before every commit.
- Use `eslint-plugin-svelte` for Svelte-specific lint rules.
- `svelte-check` catches both TypeScript errors and Svelte-specific issues.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| `any` type | Use proper types or `unknown` with type guard |
| `$effect` for derived state | Use `$derived` or reactive declarations |
| Business logic in components | Extract to services or stores |
| Direct DOM manipulation | Use `bind:`, actions, or `use:` directives |
| Global mutable state | Use Svelte stores |
| `console.log` in production | Use structured logger (→ skills/common/observability/) |
| Deeply nested components | Use slots and composition |
| Blocking `+page.ts` loads | Use streaming with promises in `load` |
