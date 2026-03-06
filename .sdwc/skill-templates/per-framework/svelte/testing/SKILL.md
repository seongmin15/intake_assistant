# Testing — Svelte

> This skill defines testing rules for the **{{ name }}** service (Svelte / TypeScript).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify components render correctly with valid props.
- Confirm key user interactions trigger expected behavior.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: component renders and interactions work.
- Edge cases: empty data, max-length inputs, loading/error states.
- Failure cases: API errors, network failures, invalid user input.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: component renders and interactions work.
- Edge cases: empty data, max-length inputs, loading/error states.
- Failure cases: API errors, network failures, invalid user input.
- Security cases: XSS via user input, auth state tampering, unauthorized route access.
{% endif %}

---

## 2. Test Structure

```
src/
├── lib/
│   └── components/
│       └── UserCard/
│           ├── UserCard.svelte
│           └── UserCard.test.ts    ← colocated unit test
├── routes/
│   └── users/
│       └── +page.test.ts          ← page-level test (optional)
tests/
├── e2e/                            ← end-to-end tests
│   └── {flow}.spec.ts
└── setup.ts                        ← global test setup
```

**Naming:** `describe("{ComponentName}")` → `it("should {expected behavior} when {condition}")`

```typescript
// ✅
describe("UserCard", () => {
  it("should display user name and email", () => { ... });
  it("should dispatch select event when clicked", () => { ... });
});
```

---

## 3. Component Testing

Use **@testing-library/svelte** + **vitest**. Test behavior, not implementation.

```typescript
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import UserCard from "./UserCard.svelte";

describe("UserCard", () => {
  const mockUser = { id: "1", name: "Alice", email: "alice@test.com" };

  it("should display user name and email", () => {
    render(UserCard, { props: { user: mockUser } });

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
  });

  it("should dispatch select event when clicked", async () => {
    const { component } = render(UserCard, { props: { user: mockUser } });
    const handler = vi.fn();
    component.$on("select", handler);

    await userEvent.click(screen.getByRole("button"));

    expect(handler).toHaveBeenCalled();
  });
});
```

**Rules:**
- Query by role, label, or text — not by test ID or class name.
- Use `userEvent` over `fireEvent` for realistic interactions.
- Test what the user sees and does, not internal reactive state.
- For SvelteKit `load` functions, test them as plain async functions.

---

## 4. Mocking Rules

### API Mocking

Use **MSW (Mock Service Worker)** for API mocking in tests.

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("/api/v1/users/:id", () => {
    return HttpResponse.json({ id: "1", name: "Alice" });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### SvelteKit Mocking

```typescript
// Mock $app/navigation
vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

// Mock $app/stores
vi.mock("$app/stores", () => ({
  page: writable({ url: new URL("http://localhost/") }),
}));
```

**What to mock:**
- API calls (via MSW).
- SvelteKit modules (`$app/navigation`, `$app/stores`).
- Browser APIs not available in jsdom.

**What NOT to mock:**
- Child components — render real components.
- Svelte stores — use real stores with test data.

---

## 5. Test Execution

```bash
# Run all tests
vitest

# Run with coverage
vitest --coverage

# Run in watch mode
vitest --watch

# Run specific file
vitest src/lib/components/UserCard/UserCard.test.ts

# E2E tests
npx playwright test
```

**Rules:**
- All tests must pass before committing.
- Unit/component tests run with `vitest`.
- E2E tests use Playwright — run separately.
- Component tests must not depend on network or external state.
