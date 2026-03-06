# Testing — Angular

> This skill defines testing rules for the **{{ name }}** service (Angular / TypeScript).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify components render correctly with valid inputs.
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
- Security cases: XSS via user input, auth guard bypass, unauthorized route access.
{% endif %}

---

## 2. Test Structure

```
src/app/
├── features/
│   └── users/
│       ├── user-card.component.ts
│       └── user-card.component.spec.ts   ← colocated unit test
├── core/
│   └── services/
│       ├── auth.service.ts
│       └── auth.service.spec.ts
tests/
└── e2e/                                   ← end-to-end tests
    └── {flow}.spec.ts
```

**Naming:** `describe("{ClassName}")` → `it("should {expected behavior} when {condition}")`

```typescript
describe("UserCardComponent", () => {
  it("should display user name", () => { ... });
  it("should emit selected event when button clicked", () => { ... });
});
```

---

## 3. Component Testing

Use **Angular TestBed** with standalone component APIs.

```typescript
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { UserCardComponent } from "./user-card.component";

describe("UserCardComponent", () => {
  let fixture: ComponentFixture<UserCardComponent>;

  const mockUser = { id: "1", name: "Alice", email: "alice@test.com" };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCardComponent],  // standalone component
    }).compileComponents();

    fixture = TestBed.createComponent(UserCardComponent);
    fixture.componentRef.setInput("user", mockUser);
    fixture.detectChanges();
  });

  it("should display user name", () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain("Alice");
  });

  it("should emit selected event when clicked", () => {
    const spy = jest.spyOn(fixture.componentInstance.selected, "emit");
    const button = fixture.nativeElement.querySelector("button");
    button.click();
    expect(spy).toHaveBeenCalledWith("1");
  });
});
```

**Rules:**
- Import standalone components directly in `TestBed.configureTestingModule({ imports: [...] })`.
- Use `setInput()` for signal-based inputs.
- Call `fixture.detectChanges()` after setup and after triggering changes.
- Query DOM via `fixture.nativeElement` — prefer semantic selectors.

---

## 4. Mocking Rules

### Service Mocking

```typescript
const mockAuthService = {
  isAuthenticated: signal(true),
  currentUser: signal(mockUser),
};

TestBed.configureTestingModule({
  imports: [ProtectedComponent],
  providers: [
    { provide: AuthService, useValue: mockAuthService },
  ],
});
```

### HTTP Mocking

```typescript
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";

let httpMock: HttpTestingController;

beforeEach(() => {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [UserService],
  });
  httpMock = TestBed.inject(HttpTestingController);
});

it("should fetch users", () => {
  const service = TestBed.inject(UserService);
  service.getUsers().subscribe((users) => {
    expect(users.length).toBe(1);
  });
  const req = httpMock.expectOne("/api/v1/users");
  req.flush([mockUser]);
});

afterEach(() => httpMock.verify());
```

**What to mock:**
- HTTP calls (via `HttpClientTestingModule`).
- Services with external dependencies.
- `Router` for navigation tests.

**What NOT to mock:**
- Child standalone components — import real components.
- Pipes and directives — test with real implementations.

---

## 5. Test Execution

```bash
# Run all tests
ng test                       # Karma (default)
# or
npx jest                      # if using Jest

# Run with coverage
ng test --code-coverage

# Run specific file
ng test --include="**/user-card.component.spec.ts"

# E2E tests
npx playwright test
```

**Rules:**
- All tests must pass before committing.
- Consider migrating from Karma to Jest or Vitest for faster execution.
- E2E tests use Playwright — run separately.
- Component tests must not depend on network or external state.
