# Coding Standards — React

> This skill defines coding rules for the **intake-assistant-web** service (React / TypeScript).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
intake-assistant-web/
├── src/
│   ├── app/                      ← app root (router, providers, global layout)
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── pages/                    ← page-level components (one per route)
│   │   └── {PageName}/
│   │       ├── index.tsx
│   │       ├── components/       ← page-scoped components
│   │       └── hooks/            ← page-scoped hooks
│   ├── components/               ← shared/reusable components
│   │   └── {ComponentName}/
│   │       ├── index.tsx
│   │       ├── {ComponentName}.tsx
│   │       └── {ComponentName}.test.tsx
│   ├── hooks/                    ← shared custom hooks
│   ├── services/                 ← API call functions
│   │   └── {resource}Api.ts
│   ├── stores/                   ← global state management
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
- One component per file. File name matches component name (PascalCase).
- Colocate tests with components (`Button.test.tsx` next to `Button.tsx`).
- Page-scoped components/hooks stay in the page folder. Promote to `src/components/` or `src/hooks/` only when shared by 2+ pages.
- `services/` contains only API call functions — no UI logic, no state management.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Hooks | camelCase with `use` prefix | `useAuth.ts`, `useUserList.ts` |
| Utility functions | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `User`, `CreateUserRequest` |
| Constants | UPPER_SNAKE | `MAX_PAGE_SIZE` |
| CSS classes (Tailwind) | kebab-case via utility | `className="flex items-center"` |
| Event handlers | `handle` + event | `handleClick`, `handleSubmit` |
| Boolean props/state | `is`/`has`/`should` prefix | `isLoading`, `hasError` |

**Component file naming:**
- Component: `UserProfile.tsx`
- Hook: `useUserProfile.ts`
- Type: `userProfile.types.ts`
- Test: `UserProfile.test.tsx`

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

**Type definition rules:**
- Use `interface` for object shapes that may be extended. Use `type` for unions, intersections, and primitives.
- Export types from `types/` for shared types. Colocate component-specific types in the component file.
- API response types live in `services/`.

```typescript
// ✅
interface User {
  id: string;
  email: string;
  name: string;
}

type Status = "active" | "inactive" | "pending";

// ❌ avoid
const user: any = fetchUser();
```

**Props typing:**

```typescript
interface UserCardProps {
  user: User;
  onSelect: (userId: string) => void;
  isHighlighted?: boolean;  // optional with ? not | undefined
}

export function UserCard({ user, onSelect, isHighlighted = false }: UserCardProps) {
  ...
}
```

---

## 4. Import Order

Group imports in this order, separated by blank lines:

```typescript
// 1. React / framework
import { useState, useEffect } from "react";

// 2. Third-party libraries
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";

// 3. Internal — absolute path from src/
import { Button } from "@/components/Button";
import { useAuth } from "@/hooks/useAuth";
import { userApi } from "@/services/userApi";

// 4. Relative — local to current module
import { UserCard } from "./components/UserCard";
import type { UserListProps } from "./types";
```

**Rules:**
- Use path aliases (`@/` = `src/`) for all non-relative imports.
- Separate `import type` from value imports.
- Never use barrel files (`index.ts` re-exports) for deep nesting — keep import paths explicit.

---

## 5. Component Patterns

### Functional components only — no class components.

```typescript
// ✅ named export (preferred)
export function UserProfile({ userId }: UserProfileProps) {
  ...
}

// ❌ avoid default exports for components
export default function UserProfile() { ... }
```

### Hooks usage rules

- Call hooks only at the top level. Never inside conditions, loops, or callbacks.
- Extract complex logic into custom hooks (`use{Feature}`).
- Custom hooks should do one thing — compose multiple hooks if needed.

### State management

**Global state: zustand**

- Local state (`useState`) for component-scoped UI state.
- Global store for state shared across unrelated components.
- Server state (React Query / SWR) for data fetched from APIs — do NOT duplicate in global store.

### Event handling

```typescript
// ✅ handler defined in component
function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  // ...
}

// ❌ inline arrow in JSX for complex logic
<form onSubmit={(e) => { e.preventDefault(); doThis(); doThat(); doMore(); }}>
```

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ESLint** | Linter | `.eslintrc.cjs` or `eslint.config.js` |
| **Prettier** | Formatter | `.prettierrc` |

**Commands:**

```bash
eslint src/ --fix            # lint
prettier --write src/        # format
tsc --noEmit                 # type check
```

**Rules:**
- Run lint + format before every commit.
- ESLint plugins: `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`.
- Prettier: double quotes, trailing commas, 100 char line width.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| `any` type | Use proper types or `unknown` with type guard |
| Props drilling through 3+ levels | Use context, global store, or composition |
| Business logic in components | Extract to hooks or services |
| `useEffect` for derived state | Use `useMemo` or compute inline |
| Fetching in `useEffect` manually | Use React Query / SWR |
| Index as key in dynamic lists | Use stable unique ID |
| Direct DOM manipulation | Use refs or state-driven rendering |
| `console.log` for production logging | Use structured logger (→ skills/common/observability/) |
