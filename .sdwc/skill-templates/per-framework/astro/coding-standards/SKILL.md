# Coding Standards — Astro

> This skill defines coding rules for the **{{ name }}** service (Astro / TypeScript).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── pages/                    ← file-based routing (.astro files)
│   │   ├── index.astro           ← /
│   │   ├── users/
│   │   │   ├── index.astro       ← /users
│   │   │   └── [id].astro        ← /users/:id
│   │   └── api/                  ← API endpoints
│   │       └── v1/
│   │           └── users.ts
│   ├── layouts/                  ← page layouts
│   │   └── BaseLayout.astro
│   ├── components/               ← reusable components
│   │   ├── Header.astro          ← static (zero JS)
│   │   ├── Footer.astro
│   │   └── interactive/          ← island components (with JS)
│   │       ├── SearchBar.tsx     ← React/Solid/Vue island
│   │       └── Counter.tsx
│   ├── content/                  ← content collections (Markdown/MDX)
│   │   ├── config.ts
│   │   └── blog/
│   │       └── first-post.md
│   ├── services/                 ← data fetching functions
│   │   └── {resource}Api.ts
│   ├── types/                    ← shared TypeScript types
│   ├── utils/                    ← pure utility functions
│   └── styles/                   ← global styles
│       └── global.css
├── public/                       ← static assets (copied as-is)
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

**Rules:**
- `.astro` files for static content and layouts — **zero JS by default**.
- Interactive components (islands) use framework files (`.tsx`, `.vue`, `.svelte`) in `components/interactive/`.
- Separate static components from interactive islands in the directory structure.
- `content/` for content collections (blog posts, docs, etc.) managed by Astro's Content Layer.
- `services/` for data fetching — callable from `.astro` frontmatter.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Pages | kebab-case | `about-us.astro`, `[slug].astro` |
| Layouts | PascalCase | `BaseLayout.astro`, `BlogLayout.astro` |
| Astro components | PascalCase | `Header.astro`, `Card.astro` |
| Island components | PascalCase + framework ext | `SearchBar.tsx`, `Counter.vue` |
| Content collections | kebab-case folder | `content/blog/`, `content/docs/` |
| API endpoints | kebab-case | `api/v1/users.ts` |
| Utility functions | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `BlogPost`, `User` |
| Constants | UPPER_SNAKE | `SITE_TITLE` |

---

## 3. TypeScript Rules

**Rule: strict mode enabled.**

```json
// tsconfig.json
{
  "extends": "astro/tsconfigs/strict"
}
```

**Astro component typing (frontmatter):**

```astro
---
// src/components/Card.astro
interface Props {
  title: string;
  description?: string;
  href: string;
}

const { title, description, href } = Astro.props;
---
<a href={href}>
  <h3>{title}</h3>
  {description && <p>{description}</p>}
</a>
```

**Content collection schemas:**

```typescript
// src/content/config.ts
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.date(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
```

---

## 4. Import Order

In `.astro` frontmatter (`---` block):

```astro
---
// 1. Astro built-ins
import { getCollection } from "astro:content";

// 2. Layouts
import BaseLayout from "@/layouts/BaseLayout.astro";

// 3. Astro components (static)
import Card from "@/components/Card.astro";

// 4. Island components (interactive)
import SearchBar from "@/components/interactive/SearchBar";

// 5. Services and utilities
import { userApi } from "@/services/userApi";
import { formatDate } from "@/utils/formatDate";

// 6. Types
import type { BlogPost } from "@/types/blog";
---
```

**Rules:**
- Use `@/` alias for `src/` imports.
- Keep frontmatter imports minimal — heavy logic belongs in services/utils.

---

## 5. Component Patterns

### Astro components (static, zero JS)

```astro
---
// Card.astro — zero JavaScript sent to client
interface Props {
  title: string;
  body: string;
}
const { title, body } = Astro.props;
---
<div class="card">
  <h3>{title}</h3>
  <p>{body}</p>
</div>

<style>
  .card { padding: 1rem; border: 1px solid #ddd; }
</style>
```

### Islands (interactive components)

```astro
---
import Counter from "@/components/interactive/Counter";
import SearchBar from "@/components/interactive/SearchBar";
---
<!-- Hydrate on page load -->
<Counter client:load initialCount={0} />

<!-- Hydrate when visible in viewport -->
<SearchBar client:visible placeholder="Search..." />

<!-- Hydrate on idle -->
<HeavyWidget client:idle />

<!-- No hydration — render server-only -->
<StaticChart data={chartData} />
```

**Client directives:**

| Directive | When hydrated | Use for |
|-----------|--------------|---------|
| `client:load` | Immediately | Critical interactive UI |
| `client:visible` | When scrolled into view | Below-fold interactive content |
| `client:idle` | When browser is idle | Low-priority interactive content |
| `client:media` | When media query matches | Responsive interactive components |
| (none) | Never — server-only render | Static content, charts with no interaction |

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ESLint** | Linter | `eslint.config.js` |
| **eslint-plugin-astro** | Astro-specific rules | via ESLint config |
| **Prettier** | Formatter | `.prettierrc` |
| **prettier-plugin-astro** | Astro file formatting | via Prettier config |

**Commands:**

```bash
eslint src/ --fix            # lint
prettier --write src/        # format
astro check                  # Astro + TypeScript diagnostics
```

**Rules:**
- Run lint + format before every commit.
- `astro check` catches both TypeScript and Astro-specific issues.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| `client:load` on everything | Use `client:visible` or `client:idle` for non-critical components |
| Interactive component for static content | Use `.astro` component (zero JS) |
| Complex logic in frontmatter | Extract to services/utils |
| Ignoring content collections | Use Astro's Content Layer for structured content |
| Global CSS without scoping | Use `<style>` in components (scoped by default) or Tailwind |
| Fetching data at runtime when static works | Use `getStaticPaths()` for SSG |
| Missing `alt` on images | Use `<Image>` component from `astro:assets` |
| `console.log` in production | Use structured logger (→ skills/common/observability/) |
