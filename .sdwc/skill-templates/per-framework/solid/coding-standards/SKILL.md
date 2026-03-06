# Coding Standards — Solid

> This skill defines coding rules for the **{{ name }}** service (SolidJS / TypeScript).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── app/                      ← app root
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── pages/                    ← page-level components (one per route)
│   │   └── {PageName}/
│   │       ├── index.tsx
│   │       ├── components/       ← page-scoped components
│   │       └── hooks/            ← page-scoped primitives
│   ├── components/               ← shared/reusable components
│   │   └── {ComponentName}/
│   │       ├── {ComponentName}.tsx
│   │       └── {ComponentName}.test.tsx
│   ├── primitives/               ← shared reactive primitives (like hooks)
│   ├── services/                 ← API call functions
│   │   └── {resource}Api.ts
│   ├── stores/                   ← global state (createStore)
│   ├── types/                    ← shared TypeScript types
│   ├── utils/                    ← pure utility functions
│   └── constants/                ← app-wide constants
├── tests/
│   ├── e2e/
│   └── setup.ts
├── public/
├── package.json
├── vite.config.ts
└── tsconfig.json
```

**Rules:**
- One component per file. File name matches component name (PascalCase).
- Colocate tests with components.
- Shared reactive logic in `primitives/` (Solid's equivalent of hooks — `create*` functions).
- Page-scoped components stay in the page folder. Promote when shared by 2+ pages.
- `services/` contains only API call functions.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Primitives (hooks) | camelCase with `create` or `use` prefix | `createAuth.ts`, `useUserList.ts` |
| Utility functions | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `User`, `CreateUserRequest` |
| Constants | UPPER_SNAKE | `MAX_PAGE_SIZE` |
| Signals | camelCase, getter/setter pair | `const [count, setCount] = createSignal(0)` |
| Event handlers | `handle` + event | `handleClick`, `handleSubmit` |
| Boolean signals | `is`/`has` prefix | `const [isLoading, setIsLoading]` |

---

## 3. TypeScript Rules

**Rule: strict mode enabled.** No `any` unless absolutely unavoidable (and documented).

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "jsx": "preserve",
    "jsxImportSource": "solid-js"
  }
}
```

**Props typing:**

```typescript
interface UserCardProps {
  user: User;
  onSelect: (userId: string) => void;
  isHighlighted?: boolean;
}

export function UserCard(props: UserCardProps) {
  // Access props.user, NOT destructure
  return <div>{props.user.name}</div>;
}
```

**Critical rule: Never destructure props.** Destructuring breaks Solid's reactive tracking. Always access via `props.field`.

---

## 4. Import Order

Group imports in this order, separated by blank lines:

```typescript
// 1. Solid core
import { createSignal, createEffect, createMemo, Show, For } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";

// 2. Third-party libraries
import { createQuery } from "@tanstack/solid-query";

// 3. Internal — absolute path from src/
import { Button } from "@/components/Button";
import { createAuth } from "@/primitives/createAuth";
import { userApi } from "@/services/userApi";

// 4. Relative — local to current module
import { UserCard } from "./components/UserCard";
import type { UserPageProps } from "./types";
```

**Rules:**
- Use path aliases (`@/` = `src/`).
- Separate `import type` from value imports.

---

## 5. Component Patterns

### Functional components — no classes, no VDOM diffing

```typescript
// ✅ named export
export function UserProfile(props: UserProfileProps) {
  // Component body runs ONCE (not on every render like React)
  const [editing, setEditing] = createSignal(false);
  const name = createMemo(() => props.user.name.toUpperCase());

  return (
    <div>
      <h1>{name()}</h1>  {/* Call signal as function */}
      <Show when={editing()} fallback={<span>View mode</span>}>
        <EditForm user={props.user} />
      </Show>
    </div>
  );
}
```

### Critical Solid rules

- **Signals are functions:** Always call signals: `count()` not `count`.
- **No destructuring props:** `props.user` not `const { user } = props`.
- **Component body runs once:** Setup logic runs once, not per-render. Only signal reads inside JSX are reactive.
- **Use control flow components:** `<Show>`, `<For>`, `<Switch>`/`<Match>` instead of ternaries and `.map()`.

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ESLint** | Linter | `eslint.config.js` |
| **eslint-plugin-solid** | Solid-specific rules | via ESLint config |
| **Prettier** | Formatter | `.prettierrc` |

**Commands:**

```bash
eslint src/ --fix            # lint
prettier --write src/        # format
tsc --noEmit                 # type check
```

**Rules:**
- Run lint + format before every commit.
- `eslint-plugin-solid` catches Solid-specific mistakes (prop destructuring, missing signal calls).
- Enable `solid/reactivity` rule to catch reactivity breaks.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Destructuring props | Access via `props.field` or use `splitProps()` |
| Forgetting `()` on signal reads | Always call signals: `count()` |
| `Array.map()` for lists | Use `<For each={list()}>` for optimized rendering |
| Ternary for conditional | Use `<Show when={...}>` |
| `any` type | Use proper types or `unknown` |
| `createEffect` for derived state | Use `createMemo()` |
| React patterns (useState, useEffect) | Use Solid primitives (createSignal, createEffect) |
| `console.log` in production | Use structured logger (→ skills/common/observability/) |
