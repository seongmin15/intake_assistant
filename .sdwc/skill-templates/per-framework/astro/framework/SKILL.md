# Framework — Astro

> This skill defines Astro-specific patterns for the **{{ name }}** service.
> Rendering: **{{ rendering_strategy }}** | CSS: **{{ css_strategy }}**
> Read this before building or modifying any pages or components.

---

## 1. Application Structure

Astro is **content-first** with **Islands Architecture**. The default is zero client-side JS.

```astro
---
// src/pages/index.astro
import BaseLayout from "@/layouts/BaseLayout.astro";
import Card from "@/components/Card.astro";
import SearchBar from "@/components/interactive/SearchBar";
import { getLatestPosts } from "@/services/contentApi";

const posts = await getLatestPosts(5);
---
<BaseLayout title="Home">
  <h1>Welcome to {{ name }}</h1>

  <!-- Static Astro component — zero JS -->
  {posts.map((post) => <Card title={post.title} href={`/blog/${post.slug}`} />)}

  <!-- Interactive island — JS sent to client -->
  <SearchBar client:visible placeholder="Search posts..." />
</BaseLayout>
```

**Core principle:** Everything is static by default. Add `client:*` directives only for interactive components.

---

## 2. Routing

### File-based routing

```
src/pages/
├── index.astro              → /
├── about.astro              → /about
├── users/
│   ├── index.astro          → /users
│   └── [id].astro           → /users/:id (dynamic)
├── blog/
│   ├── index.astro          → /blog
│   └── [...slug].astro      → /blog/* (catch-all)
└── api/
    └── v1/
        └── users.ts         → /api/v1/users
```

### Static generation with dynamic routes

```astro
---
// src/pages/blog/[...slug].astro
import { getCollection } from "astro:content";
import BlogLayout from "@/layouts/BlogLayout.astro";

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await post.render();
---
<BlogLayout title={post.data.title}>
  <h1>{post.data.title}</h1>
  <time>{post.data.date.toLocaleDateString()}</time>
  <Content />
</BlogLayout>
```

### API endpoints

```typescript
// src/pages/api/v1/users.ts
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const users = await db.user.findMany();
  return new Response(JSON.stringify(users), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  // validate and create user
  return new Response(JSON.stringify(user), { status: 201 });
};
```

**Rules:**
- Use `getStaticPaths()` for SSG dynamic routes.
- For SSR, set `output: "server"` or `output: "hybrid"` in `astro.config.mjs`.
- API endpoints export HTTP method handlers (`GET`, `POST`, `PUT`, `DELETE`).
- Use `Astro.redirect()` for server-side redirects.

---

## 3. Content Collections

```typescript
// src/content/config.ts
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",  // Markdown/MDX
  schema: z.object({
    title: z.string(),
    date: z.date(),
    author: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    image: z.string().optional(),
  }),
});

const authors = defineCollection({
  type: "data",  // JSON/YAML
  schema: z.object({
    name: z.string(),
    bio: z.string(),
    avatar: z.string(),
  }),
});

export const collections = { blog, authors };
```

**Querying collections:**

```astro
---
import { getCollection, getEntry } from "astro:content";

// Get all published posts, sorted by date
const posts = (await getCollection("blog", ({ data }) => !data.draft))
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

// Get single entry
const author = await getEntry("authors", "alice");
---
```

**Rules:**
- Define schemas in `src/content/config.ts` — validated at build time.
- Use `type: "content"` for Markdown/MDX, `type: "data"` for JSON/YAML.
- Filter drafts in queries, not in templates.
- Content collections are type-safe — TypeScript infers schema types.

---

## 4. Layouts

```astro
---
// src/layouts/BaseLayout.astro
interface Props {
  title: string;
  description?: string;
}

const { title, description = "{{ name }}" } = Astro.props;
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content={description} />
  <title>{title}</title>
</head>
<body>
  <header>
    <nav>...</nav>
  </header>
  <main>
    <slot />
  </main>
  <footer>...</footer>
</body>
</html>
```

**Rules:**
- Layouts are Astro components with a `<slot />`.
- Include `<head>` meta, `<ViewTransitions />`, and global styles in layouts.
- Nest layouts: `BlogLayout` extends `BaseLayout` via slots.

---

## 5. Islands Architecture

### When to use islands

| Content type | Component type | Client directive |
|-------------|---------------|-----------------|
| Static text, images, cards | `.astro` component | None (zero JS) |
| Search, filters, forms | Framework component | `client:visible` or `client:load` |
| Analytics, chat widget | Framework component | `client:idle` |
| Mobile-only interactive | Framework component | `client:media="(max-width: 768px)"` |

### Multi-framework support

```astro
---
// Mix frameworks in one page
import ReactSearch from "@/components/interactive/SearchBar";    // React
import SvelteCounter from "@/components/interactive/Counter.svelte";  // Svelte
---
<ReactSearch client:visible />
<SvelteCounter client:load />
```

**Rules:**
- Each island is independently hydrated — they don't share state directly.
- Pass serializable props only — no functions or complex objects across islands.
- Share state via URL params, cookies, or `nanostores` (framework-agnostic store).
- Default to zero JS — every `client:*` directive is a conscious decision.

---

## 6. Styling

{% if css_strategy %}
**CSS strategy: {{ css_strategy }}**
{% endif %}

{% if css_strategy == "tailwind" %}
**Rules:**
- Install `@astrojs/tailwind` integration.
- Use Tailwind utility classes directly in `.astro` templates and island components.
- Global styles in `src/styles/global.css`.
{% endif %}

**Default: `<style>` in `.astro` files is scoped by default.**

```astro
<style>
  /* Scoped to this component only */
  h1 { color: navy; }
</style>

<style is:global>
  /* Applied globally — use sparingly */
</style>
```

---

## 7. SSG vs SSR vs Hybrid

```javascript
// astro.config.mjs
export default defineConfig({
  output: "static",    // Full SSG (default) — all pages pre-rendered
  // output: "server",  // Full SSR — all pages rendered on request
  // output: "hybrid",  // Default SSG, opt-in SSR per page
});
```

**Hybrid mode (recommended for most projects):**

```astro
---
// This page is SSR (opt-in)
export const prerender = false;
---
```

**Rules:**
- Default to `static` for content-heavy sites.
- Use `hybrid` when most pages are static but some need SSR (auth, user-specific).
- Use `server` only when most pages need dynamic rendering.

---

## 8. Performance

Astro is built for performance — zero JS by default.

- **Zero JS baseline:** `.astro` components ship no JavaScript.
- **Partial hydration:** Only island components send JS, and only when their directive triggers.
- **Image optimization:** Use `<Image>` from `astro:assets` for automatic optimization.
- **View Transitions:** Use `<ViewTransitions />` for smooth page navigation.
- **Prefetching:** Astro auto-prefetches links in viewport.
- **Content caching:** Static pages are fully cacheable at CDN level.

---

## 9. Accessibility

{% if accessibility_level %}
**Target: {{ accessibility_level }}**
{% endif %}

**Minimum rules (all levels):**
- Use semantic HTML.
- All images use `<Image>` component with `alt` text.
- Form inputs must have associated labels.
- Interactive islands must be keyboard-accessible.
- Test with screen reader — static content should be fully accessible without JS.

---

## 10. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| `client:load` on everything | Defeats Astro's zero-JS benefit | Use `client:visible` or `client:idle` |
| Interactive logic in `.astro` | Astro components have no client-side JS | Use framework islands for interactivity |
| Sharing state between islands | Islands are isolated | Use `nanostores`, URL params, or cookies |
| Missing `getStaticPaths` | Build error for dynamic routes in SSG | Always implement for `[param]` routes |
| Non-serializable island props | Hydration failure | Pass only JSON-serializable data |
| Complex data fetching in templates | Hard to test, slow builds | Extract to services, cache results |
| Ignoring content schemas | Silent data errors | Define strict zod schemas in `config.ts` |
| Global styles leaking | Unintended style overrides | Use scoped `<style>` (default) |
