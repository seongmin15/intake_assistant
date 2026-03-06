# Testing — Next.js

> This skill defines testing rules for the **{{ name }}** service (Next.js / TypeScript).
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
- Security cases: XSS via user input, auth state tampering, unauthorized route access, Server Action validation bypass.
{% endif %}

---

## 2. Test Structure

```
src/
├── components/
│   └── UserCard/
│       ├── UserCard.tsx
│       └── UserCard.test.tsx       ← colocated unit test
├── app/
│   └── users/
│       └── page.test.tsx           ← page-level test (optional)
├── services/
│   └── userApi.test.ts             ← API/data access tests
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
  it("should call onSelect when clicked", () => { ... });
});
```

---

## 3. Component Testing

Use **React Testing Library** + **vitest** (or jest). Test behavior, not implementation.

**Client Component testing:**

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserCard } from "./UserCard";

describe("UserCard", () => {
  const mockUser = { id: "1", name: "Alice", email: "alice@test.com" };

  it("should display user name and email", () => {
    render(<UserCard user={mockUser} onSelect={vi.fn()} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
  });

  it("should call onSelect with user id when clicked", async () => {
    const onSelect = vi.fn();
    render(<UserCard user={mockUser} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("1");
  });
});
```

**Server Component testing (test data fetching logic separately):**

```typescript
// services/userApi.test.ts
describe("userApi", () => {
  it("should return user by id", async () => {
    const user = await userApi.getById("1");
    expect(user).toMatchObject({ id: "1", name: "Alice" });
  });
});
```

**Rules:**
- Test Client Components with React Testing Library (render + user interaction).
- Test Server Components by testing their data fetching logic as plain async functions.
- Query by role, label, or text — not by test ID or class name.
- Use `userEvent` over `fireEvent`.

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

### Next.js Module Mocking

```typescript
// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/users",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));
```

**What to mock:**
- API calls (via MSW).
- `next/navigation` hooks and functions.
- `next/image` (simplify to plain `<img>` in tests).
- Browser APIs not available in jsdom.

**What NOT to mock:**
- Child components — render real components.
- React hooks themselves — test through component behavior.
- State management stores — use real stores with test data.

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
- Unit/component tests run with `vitest`.
- E2E tests use Playwright — run separately.
- Test Server Actions by calling them directly with mock `FormData`.
