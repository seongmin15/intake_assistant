# Testing — Astro

> This skill defines testing rules for the **{{ name }}** service (Astro / TypeScript).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify pages render correctly with expected content.
- Confirm island components behave as expected.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: pages render, islands interact correctly.
- Edge cases: empty content collections, missing data, 404 pages.
- Failure cases: API errors, broken content schemas, build failures.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: pages render, islands interact correctly.
- Edge cases: empty content collections, missing data, 404 pages.
- Failure cases: API errors, broken content schemas, build failures.
- Security cases: XSS via content, unauthorized API endpoint access, injection in dynamic routes.
{% endif %}

---

## 2. Test Structure

```
src/
├── components/
│   └── interactive/
│       ├── SearchBar.tsx
│       └── SearchBar.test.tsx      ← island component test
├── pages/
│   └── __tests__/                  ← page rendering tests
│       └── index.test.ts
├── services/
│   └── userApi.test.ts             ← service tests
tests/
├── e2e/                            ← end-to-end tests
│   └── {flow}.spec.ts
└── setup.ts
```

**Testing strategy by layer:**

| Layer | What to test | Tool |
|-------|-------------|------|
| Island components | Interactive behavior | Testing Library (React/Solid/Vue) |
| Astro pages | Rendered HTML output | Astro Container API or E2E |
| Services/Utils | Business logic, data fetching | Vitest (unit) |
| Content collections | Schema validation | Build-time (astro check) |
| Full user flows | End-to-end | Playwright |

---

## 3. Island Component Testing

Test interactive components using their framework's testing library.

```typescript
// React island example
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
  it("should call onSearch when submitted", async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);

    await userEvent.type(screen.getByRole("searchbox"), "hello");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    expect(onSearch).toHaveBeenCalledWith("hello");
  });
});
```

**Rules:**
- Test island components with their respective framework's testing library.
- Focus on interactive behavior — the static wrapper is Astro's concern.
- Mock API calls with MSW.

---

## 4. Page Rendering Tests

Use **Astro Container API** (experimental) or test via E2E.

```typescript
// Using Astro Container API
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import IndexPage from "../pages/index.astro";

describe("Index page", () => {
  it("should render heading", async () => {
    const container = await AstroContainer.create();
    const result = await container.renderToString(IndexPage);
    expect(result).toContain("<h1>");
    expect(result).toContain("Welcome");
  });
});
```

**Rules:**
- Container API is useful for testing rendered HTML of Astro components.
- For complex pages with data fetching, prefer E2E tests.
- Test content collection schemas via `astro check` in CI.

---

## 5. Mocking Rules

### API Mocking

Use **MSW** for API mocking in island component tests.

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("/api/v1/users", () => {
    return HttpResponse.json([{ id: "1", name: "Alice" }]);
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**What to mock:**
- API calls in island components (via MSW).
- External data sources in service tests.

**What NOT to mock:**
- Astro's build pipeline — test output instead.
- Content collections — validate schemas, test rendered output.

---

## 6. Test Execution

```bash
# Run unit/component tests
vitest

# Run with coverage
vitest --coverage

# Astro-specific checks
astro check                   # type check + Astro diagnostics

# E2E tests
npx playwright test

# Build test (catches content/schema errors)
astro build
```

**Rules:**
- All tests must pass before committing.
- `astro check` runs in CI — catches type errors and content schema issues.
- `astro build` in CI — catches SSG errors (missing `getStaticPaths`, broken content).
- E2E tests run against `astro preview` (production build preview).
