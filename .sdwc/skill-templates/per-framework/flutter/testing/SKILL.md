# Testing — Flutter

> This skill defines testing rules for the **{{ name }}** service (Flutter / Dart).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify widgets render correctly with valid data.
- Confirm key user interactions trigger expected callbacks/state changes.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: widgets render and interactions work.
- Edge cases: empty data, loading/error states, null-safe boundaries, different screen sizes.
- Failure cases: API errors, network failures, permission denials.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: widgets render and interactions work.
- Edge cases: empty data, loading/error states, null-safe boundaries, different screen sizes.
- Failure cases: API errors, network failures, permission denials.
- Security cases: token tampering, deep link injection, secure storage exposure.
{% endif %}

---

## 2. Test Structure

```
test/
├── features/
│   └── auth/
│       ├── screens/
│       │   └── login_screen_test.dart
│       ├── widgets/
│       │   └── login_form_test.dart
│       └── providers/
│           └── auth_provider_test.dart
├── shared/
│   └── widgets/
│       └── loading_indicator_test.dart
├── services/
│   └── user_api_test.dart
└── helpers/
    ├── test_app.dart             ← MaterialApp wrapper for widget tests
    └── mocks.dart                ← shared mock classes

integration_test/
└── {flow}_test.dart              ← on-device integration tests
```

**Naming:** `group('{ClassName}')` → `test('should {behavior} when {condition}')`

---

## 3. Widget Testing

Use **flutter_test** (built-in).

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:{{ name }}/features/profile/widgets/user_card.dart';

void main() {
  group('UserCard', () {
    final mockUser = User(id: '1', name: 'Alice');

    testWidgets('should display user name', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(home: UserCard(user: mockUser, onTap: () => tapped = true)),
      );
      expect(find.text('Alice'), findsOneWidget);
    });

    testWidgets('should call onTap when pressed', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(home: UserCard(user: mockUser, onTap: () => tapped = true)),
      );
      await tester.tap(find.text('Alice'));
      expect(tapped, isTrue);
    });
  });
}
```

**Rules:**
- Always wrap tested widgets in `MaterialApp` (or use a test helper).
- Use `find.text()`, `find.byType()`, `find.byKey()` — not direct widget references.
- Call `tester.pump()` after state changes, `tester.pumpAndSettle()` after animations.
- Test behavior, not implementation details.

```dart
// Test helper — shared MaterialApp wrapper
Widget buildTestApp(Widget child) {
  return MaterialApp(home: Scaffold(body: child));
}
```

---

## 4. Unit Testing (Providers / Services)

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';

@GenerateMocks([UserApi])
import 'auth_provider_test.mocks.dart';

void main() {
  late MockUserApi mockApi;

  setUp(() {
    mockApi = MockUserApi();
  });

  test('should return user when API succeeds', () async {
    when(mockApi.getById('1')).thenAnswer(
      (_) async => User(id: '1', name: 'Alice'),
    );
    final result = await mockApi.getById('1');
    expect(result.name, 'Alice');
    verify(mockApi.getById('1')).called(1);
  });
}
```

---

## 5. Mocking Rules

### Mock generation

Use **mockito** with `@GenerateMocks` + `build_runner`.

```bash
dart run build_runner build --delete-conflicting-outputs
```

### HTTP mocking

Use **http_mock_adapter** (for Dio) or **nock** / manual `MockClient` (for http package).

```dart
// MockClient example
final mockClient = MockClient((request) async {
  return http.Response('{"id": "1", "name": "Alice"}', 200);
});
```

**What to mock:**
- HTTP clients / API services.
- Platform plugins (camera, GPS, local storage).
- External SDKs (analytics, crash reporting).

**What NOT to mock:**
- Flutter widgets — render real widgets with `tester.pumpWidget()`.
- Navigation — use `MaterialApp` with real router for integration.
- State management — use real providers/blocs with injected mock dependencies.

---

## 6. Integration Testing

Use **integration_test** package (on-device tests).

```dart
// integration_test/login_flow_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:{{ name }}/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('login flow', (tester) async {
    app.main();
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(Key('email-input')), 'user@test.com');
    await tester.enterText(find.byKey(Key('password-input')), 'password');
    await tester.tap(find.byKey(Key('login-button')));
    await tester.pumpAndSettle();

    expect(find.text('Dashboard'), findsOneWidget);
  });
}
```

**Rules:**
- Integration tests cover critical user flows only (login, main feature, checkout).
- Run on CI with emulator — not on every commit, but on PR and release.
- Use `Key('...')` for integration test selectors.

---

## 7. Test Execution

```bash
# Unit + widget tests
flutter test

# With coverage
flutter test --coverage

# Specific file
flutter test test/features/auth/providers/auth_provider_test.dart

# Integration tests (on device/emulator)
flutter test integration_test/login_flow_test.dart

# Generate mocks
dart run build_runner build --delete-conflicting-outputs
```
