# Testing — Solid

> This skill defines testing rules for the **{{ name }}** service (SolidJS / TypeScript).
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
├── components/
│   └── UserCard/
│       ├── UserCard.tsx
│       └── UserCard.test.tsx       ← colocated unit test
├── pages/
│   └── Users/
│       └── Users.test.tsx
tests/
├── e2e/
│   └── {flow}.spec.ts
└── setup.ts
```

**Naming:** `describe("{ComponentName}")` → `it("should {expected behavior} when {condition}")`

---

## 3. Component Testing

Use **@solidjs/testing-library** + **vitest**. Test behavior, not reactivity internals.

```typescript
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { UserCard } from "./UserCard";

describe("UserCard", () => {
  const mockUser = { id: "1", name: "Alice", email: "alice@test.com" };

  it("should display user name and email", () => {
    render(() => <UserCard user={mockUser} onSelect={() => {}} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
  });

  it("should call onSelect with user id when clicked", async () => {
    const onSelect = vi.fn();
    render(() => <UserCard user={mockUser} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("1");
  });
});
```

**Rules:**
- Wrap component in arrow function: `render(() => <Component />)`.
- Query by role, label, or text.
- Use `userEvent` over `fireEvent`.
- Test what the user sees, not internal signal values.

---

## 4. Mocking Rules

### API Mocking

Use **MSW (Mock Service Worker)** for API mocking.

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

**What to mock:**
- API calls (via MSW).
- Browser APIs not available in jsdom.

**What NOT to mock:**
- Child components — render real components.
- Solid primitives — test through component behavior.
- Stores — use real stores with test data.

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
vitest src/components/UserCard/UserCard.test.tsx

# E2E tests
npx playwright test
```

**Rules:**
- All tests must pass before committing.
- Configure vitest with `solid` plugin: `vite-plugin-solid` in `vite.config.ts`.
- E2E tests use Playwright — run separately.
