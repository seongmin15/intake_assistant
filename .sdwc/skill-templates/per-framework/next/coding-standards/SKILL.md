# Coding Standards — Next.js

> This skill defines coding rules for the **{{ name }}** service (Next.js / TypeScript).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── app/                      ← App Router (file-based routing)
│   │   ├── layout.tsx            ← root layout
│   │   ├── page.tsx              ← home page
│   │   ├── error.tsx             ← error boundary
│   │   ├── loading.tsx           ← loading UI
│   │   ├── users/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── api/                  ← API route handlers
│   │       └── v1/
│   │           └── users/
│   │               └── route.ts
│   ├── components/               ← shared/reusable components
│   │   └── {ComponentName}/
│   │       ├── {ComponentName}.tsx
│   │       └── {ComponentName}.test.tsx
│   ├── hooks/                    ← shared custom hooks (client only)
│   ├── services/                 ← API call functions / data access
│   │   └── {resource}Api.ts
│   ├── stores/                   ← global state management (client only)
│   ├── types/                    ← shared TypeScript types
│   ├── utils/                    ← pure utility functions
│   └── constants/                ← app-wide constants
├── tests/
│   ├── e2e/
│   └── setup.ts
├── public/
├── package.json
├── next.config.ts
└── tsconfig.json
```

**Rules:**
- One component per file. File name matches component name (PascalCase).
- **Server Components by default.** Add `"use client"` only when the component needs hooks, event handlers, or browser APIs.
- Colocate tests with components.
- Route-specific components stay in their route segment folder.
- `services/` contains data access functions — callable from both Server and Client Components.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Route files | Next.js convention | `page.tsx`, `layout.tsx`, `loading.tsx` |
| Hooks | camelCase with `use` prefix | `useAuth.ts` |
| Server actions | camelCase with action suffix | `createUserAction.ts` |
| Utility functions | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `User`, `CreateUserRequest` |
| Constants | UPPER_SNAKE | `MAX_PAGE_SIZE` |
| Event handlers | `handle` + event | `handleClick`, `handleSubmit` |
| API route files | `route.ts` | `app/api/v1/users/route.ts` |

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
- Use `interface` for object shapes, `type` for unions and intersections.
- Export shared types from `types/`.
- API response types live in `services/`.
- Use Next.js built-in types: `Metadata`, `PageProps`, `LayoutProps`.

```typescript
// app/users/[id]/page.tsx
interface UserPageProps {
  params: Promise<{ id: string }>;
}

export default async function UserPage({ params }: UserPageProps) {
  const { id } = await params;
  const user = await getUser(id);
  return <UserProfile user={user} />;
}
```

---

## 4. Import Order

Group imports in this order, separated by blank lines:

```typescript
// 1. React / Next.js
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";

// 2. Third-party libraries
import { z } from "zod";

// 3. Internal — absolute path from src/
import { Button } from "@/components/Button";
import { useAuth } from "@/hooks/useAuth";
import { userApi } from "@/services/userApi";

// 4. Relative — local to current module
import { UserCard } from "./components/UserCard";
import type { UserPageProps } from "./types";
```

**Rules:**
- Use path aliases (`@/` = `src/`) for all non-relative imports.
- Separate `import type` from value imports.
- `"use client"` or `"use server"` must be the first line in the file (before imports).

---

## 5. Server & Client Component Patterns

### Server Components (default — no directive needed)

```typescript
// app/users/page.tsx — Server Component
import { userApi } from "@/services/userApi";

export default async function UsersPage() {
  const users = await userApi.list();  // Direct data access, no API call
  return <UserList users={users} />;
}
```

### Client Components (add "use client")

```typescript
"use client";

import { useState } from "react";

export function SearchInput({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState("");
  // ...
}
```

### Decision rule

```
Does it need useState/useEffect/event handlers? → "use client"
Does it only display data? → Server Component (default)
Does it need browser APIs? → "use client"
Does it fetch data at render time? → Server Component
```

**Rules:**
- Push `"use client"` boundary as deep as possible — wrap only the interactive leaf.
- Server Components can import Client Components, but not vice versa.
- Pass Server Component output as `children` to Client Components.

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ESLint** | Linter | `eslint.config.js` |
| **Prettier** | Formatter | `.prettierrc` |
| **next lint** | Next.js-specific checks | `next.config.ts` |

**Commands:**

```bash
next lint                    # Next.js-specific lint
eslint src/ --fix            # general lint
prettier --write src/        # format
tsc --noEmit                 # type check
```

**Rules:**
- Run lint + format before every commit.
- Use `eslint-config-next` as the base ESLint config.
- Enable `@typescript-eslint` strict rules.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| `any` type | Use proper types or `unknown` |
| `"use client"` at page level | Push client boundary to leaf components |
| Fetching in Client Components when Server is possible | Use Server Components for data fetching |
| `useEffect` for data fetching | Use Server Components or React Query |
| Importing server-only code in client | Use `server-only` package to enforce boundary |
| Not using `loading.tsx` / `error.tsx` | Add route-segment-level loading/error UI |
| Large client bundles | Code split, lazy load, keep server components |
| `console.log` in production | Use structured logger (→ skills/common/observability/) |
