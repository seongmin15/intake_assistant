# Testing — Nuxt

> This skill defines testing rules for the **{{ name }}** service (Nuxt / TypeScript).
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
components/
└── UserCard/
    ├── UserCard.vue
    └── UserCard.test.ts            ← colocated unit test
server/
└── api/
    └── v1/users/
        └── index.get.test.ts       ← API route test
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
  it("should emit select event when clicked", () => { ... });
});
```

---

## 3. Component Testing

Use **@nuxt/test-utils** + **@testing-library/vue** + **vitest**.

```typescript
import { renderSuspended } from "@nuxt/test-utils/runtime";
import { screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import UserCard from "./UserCard.vue";

describe("UserCard", () => {
  const mockUser = { id: "1", name: "Alice", email: "alice@test.com" };

  it("should display user name and email", async () => {
    await renderSuspended(UserCard, { props: { user: mockUser } });

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
  });

  it("should emit select event when clicked", async () => {
    const component = await renderSuspended(UserCard, { props: { user: mockUser } });

    await userEvent.click(screen.getByRole("button"));

    expect(component.emitted().select).toBeTruthy();
  });
});
```

**Server API route testing:**

```typescript
import { $fetch, setup } from "@nuxt/test-utils";

describe("GET /api/v1/users", async () => {
  await setup({ server: true });

  it("should return users list", async () => {
    const users = await $fetch("/api/v1/users");
    expect(Array.isArray(users)).toBe(true);
  });
});
```

**Rules:**
- Use `renderSuspended` from `@nuxt/test-utils` — it handles Nuxt context (auto-imports, plugins).
- Query by role, label, or text — not by test ID or class name.
- Use `userEvent` over `fireEvent`.
- Test server API routes with `@nuxt/test-utils` setup.

---

## 4. Mocking Rules

### API Mocking

Use **MSW** or **`@nuxt/test-utils`** mock server for API mocking.

```typescript
import { registerEndpoint } from "@nuxt/test-utils/runtime";

registerEndpoint("/api/v1/users/1", () => ({
  id: "1",
  name: "Alice",
  email: "alice@test.com",
}));
```

### Module Mocking

```typescript
// Mock a composable
vi.mock("#app", async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    useNuxtApp: () => ({ $config: { public: { apiUrl: "http://test" } } }),
  };
});
```

**What to mock:**
- API calls (via MSW or `registerEndpoint`).
- External services (analytics, auth providers).
- Browser APIs not available in jsdom.

**What NOT to mock:**
- Child components — render real components.
- Pinia stores — use `createTestingPinia` with real store logic.
- Auto-imported composables — `@nuxt/test-utils` handles the Nuxt context.

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
vitest components/UserCard/UserCard.test.ts

# E2E tests
npx playwright test
```

**Rules:**
- All tests must pass before committing.
- Unit/component tests run with `vitest` + `@nuxt/test-utils`.
- E2E tests use Playwright — run separately.
- Component tests must not depend on network or external state.
