# Testing — React

> This skill defines testing rules for the **intake-assistant-web** service (React / TypeScript).
> Test case coverage level: **basic**

---

## 1. Test Case Coverage

Write **happy path** tests only.
- Verify components render correctly with valid props.
- Confirm key user interactions trigger expected behavior.

---

## 2. Test Structure

```
src/
├── components/
│   └── UserCard/
│       ├── UserCard.tsx
│       └── UserCard.test.tsx       ← colocated unit test
├── pages/
│   └── Dashboard/
│       └── Dashboard.test.tsx      ← page-level test
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
  it("should show fallback avatar when image fails to load", () => { ... });
});

// ❌ too vague
describe("UserCard", () => {
  it("works", () => { ... });
});
```

---

## 3. Component Testing

Use **React Testing Library**. Test behavior, not implementation.

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

**Rules:**
- Query by role, label, or text — not by test ID or class name (unless unavoidable).
- Use `userEvent` over `fireEvent` for realistic interactions.
- Wrap state updates in `act()` — RTL does this automatically in most cases.
- Test what the user sees and does, not internal state or hook calls.

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

### Module Mocking

```typescript
// Mock a hook
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: true }),
}));
```

**What to mock:**
- API calls (via MSW).
- Browser APIs not available in jsdom (IntersectionObserver, matchMedia).
- Third-party services (analytics, auth providers).

**What NOT to mock:**
- Child components — render real components to catch integration issues.
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

# E2E tests (Playwright/Cypress)
npx playwright test
```

**Rules:**
- All tests must pass before committing.
- Unit/component tests run with `vitest` (fast, in-process).
- E2E tests use Playwright or Cypress — run separately.
- Component tests must not depend on network or external state.
