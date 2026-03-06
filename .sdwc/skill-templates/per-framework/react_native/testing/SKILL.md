# Testing — React Native

> This skill defines testing rules for the **{{ name }}** service (React Native / TypeScript).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify screens render correctly with valid props.
- Confirm key user interactions trigger expected behavior.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: screens render and interactions work.
- Edge cases: empty data, offline state, loading/error states, different screen sizes.
- Failure cases: API errors, network failures, permission denials.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: screens render and interactions work.
- Edge cases: empty data, offline state, loading/error states, different screen sizes.
- Failure cases: API errors, network failures, permission denials.
- Security cases: token tampering, deep link injection, local storage exposure.
{% endif %}

---

## 2. Test Structure

```
src/
├── components/
│   └── UserCard/
│       ├── UserCard.tsx
│       └── UserCard.test.tsx       ← colocated unit test
├── screens/
│   └── Profile/
│       └── ProfileScreen.test.tsx
__tests__/
├── e2e/                            ← end-to-end (Detox/Maestro)
│   └── {flow}.test.ts
└── setup.ts
```

**Naming:** `describe("{ComponentName}")` → `it("should {behavior} when {condition}")`

---

## 3. Component Testing

Use **React Native Testing Library**.

```typescript
import { render, screen, fireEvent } from "@testing-library/react-native";
import { UserCard } from "./UserCard";

describe("UserCard", () => {
  const mockUser = { id: "1", name: "Alice" };

  it("should display user name", () => {
    render(<UserCard user={mockUser} onPress={jest.fn()} />);
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("should call onPress with user id when pressed", () => {
    const onPress = jest.fn();
    render(<UserCard user={mockUser} onPress={onPress} />);
    fireEvent.press(screen.getByText("Alice"));
    expect(onPress).toHaveBeenCalledWith("1");
  });
});
```

**Rules:**
- Query by text, testID, or role — not by component type.
- Test behavior, not implementation details.
- Wrap navigation-dependent screens in `NavigationContainer` for testing.

```typescript
// Testing a screen with navigation
import { NavigationContainer } from "@react-navigation/native";

function renderWithNavigation(component: React.ReactElement) {
  return render(
    <NavigationContainer>{component}</NavigationContainer>
  );
}
```

---

## 4. Mocking Rules

### API Mocking

Use **MSW** (same as React web).

### Native Modules

```typescript
// jest.setup.js
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("react-native/Libraries/Animated/NativeAnimatedHelper");
```

**What to mock:**
- Native modules (camera, GPS, biometrics).
- Platform APIs (`Linking`, `Alert`, `Clipboard`).
- External services (API calls via MSW).

**What NOT to mock:**
- React Native components — render real components.
- Navigation — use `NavigationContainer` wrapper.
- State management — use real stores with test data.

---

## 5. E2E Testing

Use **Detox** or **Maestro** for end-to-end tests on real device/simulator.

```typescript
// Detox example
describe("Login Flow", () => {
  it("should login with valid credentials", async () => {
    await element(by.id("email-input")).typeText("user@test.com");
    await element(by.id("password-input")).typeText("password");
    await element(by.id("login-button")).tap();
    await expect(element(by.text("Dashboard"))).toBeVisible();
  });
});
```

**Rules:**
- E2E tests cover critical user flows only (login, main feature, checkout).
- Run on CI with a simulator — not on every commit, but on PR and release.
- Use `testID` props for E2E selectors.

---

## 6. Test Execution

```bash
# Unit tests
jest

# With coverage
jest --coverage

# Watch mode
jest --watch

# E2E (Detox)
detox test --configuration ios.sim.debug

# E2E (Maestro)
maestro test flows/login.yaml
```
